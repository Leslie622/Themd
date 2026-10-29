use std::collections::BTreeSet;
use std::path::PathBuf;

use tauri::Manager;

/// 枚举系统已注册的字体族名(去重、排序)。
///
/// 浏览器环境拿不到这份列表(安全沙盒),桌面端直接读系统字体目录:
/// - 系统级:C:\Windows\Fonts
/// - 用户级:%LOCALAPPDATA%\Microsoft\Windows\Fonts
/// 注册表(GDI/DirectWrite 的真实来源)与目录内容一致度足够;
/// 文件名 ≠ 族名,故解析字体文件内部的 name 表取真实族名。
#[tauri::command]
fn list_system_fonts() -> Vec<String> {
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

/// 导入文件夹的单个笔记文件,字段语义与前端 readFolder(webkitdirectory)对齐
#[derive(serde::Serialize)]
struct ImportedNoteFile {
    #[serde(rename = "folderPath")]
    folder_path: String,
    title: String,
    content: String,
}

/// 桌面端原生导入文件夹:递归读全部 .md/.markdown/.txt。
/// folderPath = 相对根的父目录路径且含根目录名本身(如 rootName/sub),分隔符统一 '/';
/// 非 UTF-8 内容按 lossy 解码,与网页 file.text() 行为一致。上限 5000 文件防呆。
#[tauri::command]
fn read_folder_notes(root: String) -> Result<Vec<ImportedNoteFile>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("目录不存在: {}", root));
    }
    let root_name = root_path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut out: Vec<ImportedNoteFile> = Vec::new();
    let mut stack = vec![root_path.clone()];
    while let Some(dir) = stack.pop() {
        if out.len() >= 5000 {
            break;
        }
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            let is_note = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| {
                    let e = e.to_ascii_lowercase();
                    e == "md" || e == "markdown" || e == "txt"
                })
                .unwrap_or(false);
            if !is_note {
                continue;
            }
            let rel_parent = path
                .parent()
                .and_then(|p| p.strip_prefix(&root_path).ok())
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            let folder_path = if rel_parent.is_empty() {
                root_name.clone()
            } else {
                format!("{}/{}", root_name, rel_parent)
            };
            let title = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let bytes = std::fs::read(&path).unwrap_or_default();
            out.push(ImportedNoteFile {
                folder_path,
                title,
                content: String::from_utf8_lossy(&bytes).to_string(),
            });
        }
    }
    Ok(out)
}

/// 导出落盘:把前端经原生「保存对话框」选中的路径写入文本(UTF-8)。
/// 路径来自插件对话框,内容为笔记/HTML 文本,无注入面。
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("写入失败: {}", e))
}

/// 导出 PDF:调 WebView2 的 PrintToPdf(ICoreWebView2_7)直接生成,不走打印对话框。
/// 渲染用的就是页面 @media print 样式(前端切到预览视图后再调用),与打印一致;
/// PrintToPdf 是异步 COM,wait_for_async_operation 内部自带消息泵,须在 UI 线程跑,
/// 因此整体包进 with_webview。仅 Windows(WebView2)。
#[tauri::command]
async fn export_pdf(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::Manager;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_7, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING, PCWSTR};

    let window = app.get_webview_window("main").ok_or("主窗口不存在")?;
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    window
        .with_webview(move |webview| {
            let send = |result: Result<(), String>| {
                tx.send(result).ok();
            };
            let run = || -> Result<(), String> {
                unsafe {
                    let controller = webview.controller();
                    let core = controller.CoreWebView2().map_err(|e| e.to_string())?;
                    // 打印设置:A4 纵向、无页眉页脚;颜色/背景交给页面的 print 样式
                    let env6: ICoreWebView2Environment6 = webview
                        .environment()
                        .cast()
                        .map_err(|e| format!("不支持的 WebView2 运行时: {e}"))?;
                    let settings = env6.CreatePrintSettings().map_err(|e| e.to_string())?;
                    settings
                        .SetShouldPrintHeaderAndFooter(false.into())
                        .map_err(|e| e.to_string())?;
                    settings
                        .SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)
                        .map_err(|e| e.to_string())?;
                    settings.SetPageWidth(8.27).map_err(|e| e.to_string())?;
                    settings.SetPageHeight(11.69).map_err(|e| e.to_string())?;
                    let core7: ICoreWebView2_7 = core.cast().map_err(|e| {
                        format!("不支持的 WebView2 运行时: {e}")
                    })?;
                    let hstr = HSTRING::from(path);
                    PrintToPdfCompletedHandler::wait_for_async_operation(
                        Box::new(move |handler| {
                            core7.PrintToPdf(PCWSTR::from_raw(hstr.as_ptr()), &settings, &handler)
                                .map_err(Into::into)
                        }),
                        Box::new(|error_code, is_successful| {
                            if let Err(e) = error_code {
                                return Err(e);
                            }
                            if !is_successful {
                                return Err(windows::core::Error::from_hresult(
                                    windows::core::HRESULT(-2147467259), // E_FAIL
                                ));
                            }
                            Ok(())
                        }),
                    )
                    .map_err(|e| format!("PDF 生成失败: {e}"))
                }
            };
            send(run());
        })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|_| "PDF 生成中断".to_string())?
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_system_fonts,
            read_folder_notes,
            write_text_file,
            export_pdf
        ])
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭到托盘:点 X 只隐藏,真正退出走托盘菜单的「退出」
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 托盘:左键单击切换窗口显隐,右键菜单「显示主界面 / 退出」。
fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };

    let show = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().expect("bundle icon missing").clone())
        .tooltip("Themd")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                summon_main_if_hidden(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// 托盘左键单击 = 唤回:仅当窗口隐藏(含关到托盘)或最小化时恢复显示并聚焦;
/// 窗口正常可见时不动作(不做「点击隐藏」)。
fn summon_main_if_hidden(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let hidden = !win.is_visible().unwrap_or(false) || win.is_minimized().unwrap_or(false);
        if hidden {
            show_main(app);
        }
    }
}
