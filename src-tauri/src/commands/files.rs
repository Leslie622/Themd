use std::path::{Path, PathBuf};

#[derive(serde::Serialize)]
pub(crate) struct ImportedNoteFile {
    #[serde(rename = "folderPath")]
    pub(crate) folder_path: String,
    pub(crate) title: String,
    pub(crate) content: String,
    /// 来源文件绝对路径(文件绑定/双向同步用)。仅内容为合法 UTF-8 时给出:
    /// 非 UTF-8 文件读入已 lossy 降质,绑定后写回会毁掉原文件,故不绑定。
    #[serde(rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub(crate) file_path: Option<String>,
}

/// 读文件并 lossy 解码;返回 (内容, 是否合法 UTF-8)
fn read_note_lossy(path: &Path) -> (String, bool) {
    match std::fs::read(path) {
        Ok(bytes) => match String::from_utf8(bytes) {
            Ok(text) => (text, true),
            Err(err) => (String::from_utf8_lossy(err.as_bytes()).to_string(), false),
        },
        Err(_) => (String::new(), false),
    }
}

/// 导入文件夹的单个笔记文件,字段语义与前端 readFolder(webkitdirectory)对齐
/// 桌面端原生导入文件夹:递归读全部 .md/.markdown/.txt。
/// folderPath = 相对根的父目录路径且含根目录名本身(如 rootName/sub),分隔符统一 '/';
/// 非 UTF-8 内容按 lossy 解码,与网页 file.text() 行为一致。上限 5000 文件防呆。
#[tauri::command]
pub(crate) fn read_folder_notes(root: String) -> Result<Vec<ImportedNoteFile>, String> {
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
            let (content, is_utf8) = read_note_lossy(&path);
            out.push(ImportedNoteFile {
                folder_path,
                title,
                content,
                file_path: is_utf8.then(|| path.to_string_lossy().to_string()),
            });
        }
    }
    Ok(out)
}

/// 桌面端原生导入多个文本文件。
#[tauri::command]
pub(crate) fn read_text_files(paths: Vec<String>) -> Result<Vec<ImportedNoteFile>, String> {
    let mut out = Vec::new();
    for raw_path in paths.into_iter().take(5000) {
        let path = PathBuf::from(&raw_path);
        if !path.is_file() {
            continue;
        }
        let is_note = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| matches!(e.to_ascii_lowercase().as_str(), "md" | "markdown" | "txt"))
            .unwrap_or(false);
        if !is_note {
            continue;
        }
        let title = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        let (content, is_utf8) = read_note_lossy(&path);
        out.push(ImportedNoteFile {
            folder_path: String::new(),
            title,
            content,
            file_path: is_utf8.then(|| path.to_string_lossy().to_string()),
        });
    }
    Ok(out)
}

/// 严格读取单个文本文件(文件绑定笔记的外部改动重载用)。
/// 非 UTF-8 直接报错——绑定的前提就是合法 UTF-8,出现非 UTF-8 说明文件被
/// 换成了别的编码,重载降质不如报错保守。
#[tauri::command]
pub(crate) fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取失败: {}", e))
}

/// 原子写文本:先写临时文件再 rename 替换,外部编辑器/watcher 不会读到半截内容。
/// Windows 的 rename 不能覆盖已存在目标:先删再试,仍失败回落直接覆盖写。
fn atomic_write_text(path: &str, contents: &str) -> std::io::Result<()> {
    let tmp = PathBuf::from(format!("{}.themd-tmp", path));
    std::fs::write(&tmp, contents)?;
    if std::fs::rename(&tmp, path).is_ok() {
        return Ok(());
    }
    let _ = std::fs::remove_file(path);
    if std::fs::rename(&tmp, path).is_ok() {
        return Ok(());
    }
    std::fs::write(path, contents)
}

/// 导出落盘:把前端经原生「保存对话框」选中的路径写入文本(UTF-8)。
/// 路径来自插件对话框,内容为笔记/HTML 文本,无注入面。
#[tauri::command]
pub(crate) fn write_text_file(path: String, contents: String) -> Result<(), String> {
    atomic_write_text(&path, &contents).map_err(|e| format!("写入失败: {}", e))
}

/// 图片落盘(本地 assets 模式):写入图片二进制,自动创建父目录。
/// bytes 走 Tauri IPC 的二进制数组(Vec<u8>),无需 base64 编解码;
/// 文件名由前端生成(带随机后缀防重名),路径来自设置里用户选定的根目录。
#[tauri::command]
pub(crate) fn write_image_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    std::fs::write(&path, bytes).map_err(|e| format!("写入失败: {}", e))
}

/// 读取二进制文件(绑定/另存为时迁移正文引用的 assets 图片用)。
/// 与 write_image_file 对偶:读原字节 → 原样写到新目录,零重编码保真。
#[tauri::command]
pub(crate) fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("读取失败: {}", e))
}

/// 删除单个普通文件(另存为后可选清理原文件,是否删除由用户确认)。
/// 仅限普通文件:目录等一律拒绝,防止误删整棵子树。
#[tauri::command]
pub(crate) fn delete_file(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.is_file() {
        return Err(format!("不是普通文件: {}", path));
    }
    std::fs::remove_file(p).map_err(|e| format!("删除失败: {}", e))
}

/// 过滤 Windows 文件名非法字符(与前端 sanitizeFileName 语义一致)
fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name.chars().map(|c| if matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c }).collect();
    let trimmed = cleaned.trim().trim_matches(|c: char| c == '.' || c.is_whitespace()).to_string();
    if trimmed.is_empty() { "未命名".to_string() } else { trimmed }
}

/// 目录下求无冲突文件路径:重名自动加 -2/-3 后缀(保留扩展名)。
fn resolve_unique_path(dir: &str, file_name: &str) -> PathBuf {
    let base = sanitize_file_name(file_name);
    let stem = Path::new(&base)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or(base.clone());
    let ext = Path::new(&base).extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let mut candidate = Path::new(dir).join(&base);
    let mut n = 2;
    while candidate.exists() {
        candidate = Path::new(dir).join(format!("{}-{}{}", stem, n, ext));
        n += 1;
    }
    candidate
}

/// 求目标目录下无冲突的文件路径(未绑定笔记「移动即绑定」/ 文件夹内新建用)。
#[tauri::command]
pub(crate) fn unique_destination(dir: String, file_name: String) -> Result<String, String> {
    if dir.is_empty() {
        return Err("目录为空".to_string());
    }
    Ok(resolve_unique_path(&dir, &file_name).to_string_lossy().to_string())
}

/// 移动文件到目标目录(文件夹=目录的「移动到文件夹」):自动建父目录,
/// 重名自动加后缀,返回实际落点。同盘 rename 原子;跨盘回落 copy+delete
/// (先 copy 成功再删源,失败时源仍在,不丢数据)。
#[tauri::command]
pub(crate) fn move_note_file(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    if !src_path.is_file() {
        return Err(format!("源不是普通文件: {}", src));
    }
    std::fs::create_dir_all(&dest_dir).map_err(|e| format!("创建目录失败: {}", e))?;
    let file_name = src_path
        .file_name()
        .ok_or_else(|| format!("路径缺少文件名: {}", src))?
        .to_string_lossy().to_string();
    let dest = resolve_unique_path(&dest_dir, &file_name);
    match std::fs::rename(src_path, &dest) {
        Ok(()) => Ok(dest.to_string_lossy().to_string()),
        Err(_) => {
            std::fs::copy(src_path, &dest).map_err(|e| format!("跨盘移动失败(复制阶段): {}", e))?;
            std::fs::remove_file(src_path).map_err(|e| format!("跨盘移动失败(删除源阶段,新文件已就位): {}", e))?;
            Ok(dest.to_string_lossy().to_string())
        }
    }
}

/// 删除文件(笔记删除 = 磁盘文件移入系统回收站,可恢复);幂等:
/// 文件已不在(外部先删了一步)视为成功,让应用侧的删除照常完成。
#[tauri::command]
pub(crate) fn trash_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.is_file() {
        return Ok(());
    }
    trash::delete(p).map_err(|e| format!("删除失败(移入回收站): {}", e))
}

/// 重命名文件(笔记重命名 = 磁盘文件改名):同目录内改名,重名自动加后缀,
/// 返回实际落点绝对路径。
#[tauri::command]
pub(crate) fn rename_note_file(src: String, new_name: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    if !src_path.is_file() {
        return Err(format!("源不是普通文件: {}", src));
    }
    let dir = src_path
        .parent()
        .ok_or_else(|| format!("路径缺少父目录: {}", src))?
        .to_string_lossy().to_string();
    let dest = resolve_unique_path(&dir, &new_name);
    std::fs::rename(src_path, &dest).map_err(|e| format!("文件重命名失败: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

/// 重命名目录(文件夹重命名):仅同盘 rename;跨盘需要复制整棵树,明确拒绝。
#[tauri::command]
pub(crate) fn rename_directory(old_path: String, new_path: String) -> Result<(), String> {
    let from = Path::new(&old_path);
    if !from.is_dir() {
        return Err(format!("目录不存在: {}", old_path));
    }
    if Path::new(&new_path).exists() {
        return Err(format!("目标已存在: {}", new_path));
    }
    std::fs::rename(from, &new_path).map_err(|e| format!("目录重命名失败(跨盘移动不支持): {}", e))
}

/// 删除目录(文件夹删除):整棵移入系统回收站(可恢复),不做永久删除。
/// 拒绝盘符根,防止误删整盘。
#[tauri::command]
pub(crate) fn delete_directory(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.is_dir() {
        return Err(format!("目录不存在: {}", path));
    }
    // 'C:\' 长度 3,'C:' 长度 2——盘符根一律拒绝
    if p.to_string_lossy().trim_end_matches('\\').len() <= 3 && p.to_string_lossy().ends_with(':') {
        return Err("拒绝删除盘符根目录".to_string());
    }
    trash::delete(p).map_err(|e| format!("删除失败(移入回收站): {}", e))
}
