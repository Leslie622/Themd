use std::collections::BTreeSet;
use std::path::PathBuf;

#[tauri::command]
/// 枚举系统已注册的字体族名(去重、排序)。
///
/// 浏览器环境拿不到这份列表(安全沙盒),桌面端直接读系统字体目录:
/// - 系统级:C:\Windows\Fonts
/// - 用户级:%LOCALAPPDATA%\Microsoft\Windows\Fonts
/// 注册表(GDI/DirectWrite 的真实来源)与目录内容一致度足够;
/// 文件名 ≠ 族名,故解析字体文件内部的 name 表取真实族名。
pub(crate) fn list_system_fonts() -> Vec<String> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(dir) = system_font_dir() {
        dirs.push(dir);
    }
    if let Some(dir) = user_font_dir() {
        dirs.push(dir);
    }

    let mut families: BTreeSet<String> = BTreeSet::new();
    for dir in dirs {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            match path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()) {
                Some(ext) if ext == "ttf" || ext == "otf" || ext == "ttc" || ext == "otc" => {}
                _ => continue,
            }
            // 单个文件解析失败不致命:坏字体文件只影响自己
            if let Some(names) = read_family_names(&path) {
                families.extend(names);
            }
        }
    }
    families.into_iter().collect()
}

fn system_font_dir() -> Option<PathBuf> {
    // GetWindowsDirectory 走环境变量等价实现,避免引入 winapi 依赖链
    let windir = std::env::var("WINDIR").ok()?;
    Some(PathBuf::from(windir).join("Fonts"))
}

fn user_font_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    Some(PathBuf::from(local).join("Microsoft").join("Windows").join("Fonts"))
}

/// 解析字体文件的 name 表,取 family 名(nameID 16 优先,回落 nameID 1)。
/// 手写最小解析,零第三方依赖:SFNT 结构是固定的,~80 行搞定,
/// 换 ttf-parser / font-kit 会把 crates 依赖树和编译时间拉大一截。
fn read_family_names(path: &std::path::Path) -> Option<Vec<String>> {
    let data = std::fs::read(path).ok()?;
    parse_sfnt_family_names(&data)
}

/// 支持 ttf/otf(单 SFNT)与 ttc/otc(容器内多个 SFNT,取所有子字体的族名)
fn parse_sfnt_family_names(data: &[u8]) -> Option<Vec<String>> {
    const TAG_TTCF: u32 = u32::from_be_bytes(*b"ttcf");
    let first_tag = read_u32(data, 0)?;
    let mut offsets: Vec<usize> = Vec::new();
    if first_tag == TAG_TTCF {
        // TTC 头:tag(4) version(4) numFonts(4),然后每字体一个偏移(4)
        let count = read_u32(data, 8)? as usize;
        if count > 64 {
            return None; // 异常值防御,避免超大循环
        }
        for i in 0..count {
            let off = read_u32(data, 12 + i * 4)? as usize;
            if off < data.len() {
                offsets.push(off);
            }
        }
    } else {
        offsets.push(0);
    }

    let mut names = Vec::new();
    for off in offsets {
        if let Some(n) = parse_single_sfnt(data, off) {
            names.push(n);
        }
    }
    Some(names)
}

/// 解析单个 SFNT:表目录里找 name 表,取 nameID 16(排版族名)或 nameID 1(族名)
fn parse_single_sfnt(data: &[u8], base: usize) -> Option<String> {
    let num_tables = read_u16(data, base + 4)? as usize;
    let mut name_off: Option<(usize, usize)> = None; // (表偏移, 表长度)
    for i in 0..num_tables {
        let rec = base + 12 + i * 16;
        let tag = read_u32(data, rec)?;
        if tag == u32::from_be_bytes(*b"name") {
            let offset = read_u32(data, rec + 8)? as usize;
            let length = read_u32(data, rec + 12)? as usize;
            name_off = Some((offset, length));
            break;
        }
    }
    let (name_start, name_len) = name_off?;
    if name_start + name_len > data.len() {
        return None;
    }

    let count = read_u16(data, name_start + 2)? as usize;
    let string_offset = name_start + read_u16(data, name_start + 4)? as usize;

    // 两轮:先找 nameID 16(更准确的排版族名),找不到用 nameID 1
    let mut fallback: Option<String> = None;
    for platform in [3usize, 1] {
        for i in 0..count {
            let rec = name_start + 6 + i * 12;
            if rec + 12 > name_start + name_len {
                break;
            }
            let pid = read_u16(data, rec)? as usize;
            if pid != platform {
                continue;
            }
            let name_id = read_u16(data, rec + 6)? as usize;
            let length = read_u16(data, rec + 8)? as usize;
            let offset = read_u16(data, rec + 10)? as usize;
            let target = match name_id {
                16 => 0,
                1 => 1,
                _ => continue,
            };
            if target == 0 && fallback.is_none() {
                // 记录 16 号,但先继续找是否有更完整的;直接采用即可
            }
            let s_start = string_offset + offset;
            if s_start + length > data.len() {
                continue;
            }
            let raw = &data[s_start..s_start + length];
            let decoded = decode_name_string(raw, pid as u16, read_u16(data, rec + 2)?);
            if name_id == 16 {
                if !decoded.is_empty() {
                    return Some(decoded);
                }
            } else if fallback.is_none() {
                fallback = Some(decoded);
            }
        }
    }
    fallback.filter(|s| !s.is_empty())
}

fn decode_name_string(raw: &[u8], platform_id: u16, encoding_id: u16) -> String {
    if platform_id == 3 && (encoding_id == 1 || encoding_id == 10) || platform_id == 0 {
        // UTF-16BE
        let units: Vec<u16> = raw
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&units)
    } else {
        // Latin-1 / ASCII 兜底
        raw.iter().map(|&b| b as char).collect()
    }
}

fn read_u16(data: &[u8], at: usize) -> Option<u16> {
    data.get(at..at + 2).map(|b| u16::from_be_bytes([b[0], b[1]]))
}

fn read_u32(data: &[u8], at: usize) -> Option<u32> {
    data.get(at..at + 4).map(|b| u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
}

