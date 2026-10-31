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
