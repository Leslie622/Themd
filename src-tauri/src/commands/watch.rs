//! 工作区文件监听:外部改动 → 防抖归并 → `fs-changed` 事件推给前端。
//!
//! 设计:folder-first 模式下所有笔记都在工作区内,这里对工作区根建**递归**
//! watch(单根句柄,notify 在 Windows 原生支持递归);事件经 debouncer 归并后
//! 映射为 modified/removed/renamed 推送。工作区内 assets 等非 .md 文件的
//! 事件由前端过滤(未绑定的路径不会触发任何动作)。
//!
//! 回声抑制不做在 Rust 侧:应用自己的原子写(tmp+rename)也会触发事件,
//! 前端用「内容与最近一次写回一致则忽略」过滤,见 NotebookController。

use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_full::notify::EventKind;
use notify_debouncer_full::{DebouncedEvent, Debouncer, new_debouncer};
use tauri::{AppHandle, Emitter};

/// 事件归并窗口:外部编辑器保存常常连发多事件,300ms 内合并
const DEBOUNCE_MS: u64 = 300;

#[derive(Clone, serde::Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum FsEvent {
    Modified { path: String },
    Removed { path: String },
    Renamed {
        #[serde(rename = "oldPath")]
        old_path: String,
        #[serde(rename = "newPath")]
        new_path: String,
    },
}

struct WatchState {
    debouncer: Option<Debouncer<notify_debouncer_full::notify::RecommendedWatcher, notify_debouncer_full::FileIdMap>>,
    watched_root: Option<String>,
}

static WATCH: Mutex<Option<WatchState>> = Mutex::new(None);

/// 监听工作区根(递归);root 为 None = 停止监听。
/// 重复传同一根幂等(不重建 watcher);换根时退订旧根、订阅新根。
#[tauri::command]
pub(crate) fn watch_workspace(app: AppHandle, root: Option<String>) -> Result<(), String> {
    let mut guard = WATCH.lock().map_err(|e| e.to_string())?;
    let state = guard.get_or_insert_with(|| WatchState { debouncer: None, watched_root: None });

    if root.is_none() {
        // drop 掉 debouncer 即停掉后台线程与全部 watch
        state.debouncer = None;
        state.watched_root = None;
        return Ok(());
    }

    if state.debouncer.is_none() {
        let app_handle = app.clone();
        let debouncer = new_debouncer(
            Duration::from_millis(DEBOUNCE_MS),
            None,
            move |result: notify_debouncer_full::DebounceEventResult| {
                if let Ok(events) = result {
                    emit_fs_events(&app_handle, events);
                }
            },
        )
        .map_err(|e| format!("启动文件监听失败: {}", e))?;
        state.debouncer = Some(debouncer);
    }

    if state.watched_root.as_deref() == root.as_deref() {
        return Ok(());
    }

    let debouncer = state.debouncer.as_mut().expect("debouncer just created");
    if let Some(old) = &state.watched_root {
        let _ = debouncer.unwatch(Path::new(old));
    }
    let root_path = root.expect("root checked non-none above");
    debouncer
        .watch(Path::new(&root_path), notify_debouncer_full::notify::RecursiveMode::Recursive)
        .map_err(|e| format!("监听工作区失败: {}", e))?;
    state.watched_root = Some(root_path);
    Ok(())
}

fn emit_fs_events(app: &AppHandle, events: Vec<DebouncedEvent>) {
    let mut mapped: Vec<FsEvent> = Vec::new();
    for event in events {
        use notify_debouncer_full::notify::event::{ModifyKind, RenameMode};
        let path_of = |i: usize| event.paths.get(i).map(|p| p.to_string_lossy().to_string());
        match &event.event.kind {
            // 重命名(from+to 成对出现)
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)) if event.paths.len() >= 2 => {
                if let (Some(old), Some(new)) = (path_of(0), path_of(1)) {
                    mapped.push(FsEvent::Renamed { old_path: old, new_path: new });
                }
            }
            // 改名前的名字消失 = 原路径文件没了
            EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
                if let Some(path) = path_of(0) {
                    mapped.push(FsEvent::Removed { path });
                }
            }
            // 其余改动/创建/改名后的新路径 = 内容可能变了,由前端按内容比对决定
            EventKind::Modify(_) | EventKind::Create(_) => {
                if let Some(path) = path_of(0) {
                    mapped.push(FsEvent::Modified { path });
                }
            }
            EventKind::Remove(_) => {
                if let Some(path) = path_of(0) {
                    mapped.push(FsEvent::Removed { path });
                }
            }
            // Access(时间戳/打开)与兜底对内容无意义,忽略
            EventKind::Access(_) | EventKind::Any | EventKind::Other => {}
        }
    }
    if !mapped.is_empty() {
        let _ = app.emit("fs-changed", &mapped);
    }
}
