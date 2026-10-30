use std::path::PathBuf;

#[derive(serde::Serialize)]
pub(crate) struct ImportedNoteFile {
    #[serde(rename = "folderPath")]
    pub(crate) folder_path: String,
    pub(crate) title: String,
    pub(crate) content: String,
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
        let bytes = std::fs::read(&path).map_err(|e| format!("读取失败: {}", e))?;
        out.push(ImportedNoteFile {
            folder_path: String::new(),
            title,
            content: String::from_utf8_lossy(&bytes).to_string(),
        });
    }
    Ok(out)
}

/// 导出落盘:把前端经原生「保存对话框」选中的路径写入文本(UTF-8)。
/// 路径来自插件对话框,内容为笔记/HTML 文本,无注入面。
#[tauri::command]
pub(crate) fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("写入失败: {}", e))
}

