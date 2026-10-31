//! 文件绑定监听:外部改动 → 防抖归并 → `fs-changed` 事件推给前端。
//!
//! 设计:前端把「所有绑定笔记的绝对路径」全量同步过来(见 FileLinkGateway.watchPaths),
//! 这里按父目录分组建**非递归** watch(一个文件夹一个句柄,数量可控);
//! 事件经 debouncer 归并后映射为 modified/removed/renamed 推送。
//!
//! 回声抑制不做在 Rust 侧:应用自己的原子写(tmp+rename)也会触发事件,
//! 前端用「内容与最近一次写回一致则忽略」过滤,见 NotebookController。

use std::collections::HashSet;
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
    watched_dirs: HashSet<String>,
}

static WATCH: Mutex<Option<WatchState>> = Mutex::new(None);

/// 全量替换监听集合:paths 为绑定文件绝对路径;空数组 = 停止监听。
#[tauri::command]
pub(crate) fn watch_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let mut guard = WATCH.lock().map_err(|e| e.to_string())?;
    let state = guard.get_or_insert_with(|| WatchState { debouncer: None, watched_dirs: HashSet::new() });

    let dirs: HashSet<String> = paths
        .iter()
        .filter_map(|p| Path::new(p).parent().map(|d| d.to_string_lossy().to_string()))
        .collect();

    if paths.is_empty() {
        // drop 掉 debouncer 即停掉后台线程与全部 watch
        state.debouncer = None;
        state.watched_dirs.clear();
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

    let debouncer = state.debouncer.as_mut().expect("debouncer just created");
    // 差量增删:不再需要的目录退订,新增目录订阅(非递归,子目录由各自文件路径带出)
    for dir in state.watched_dirs.difference(&dirs) {
        let _ = debouncer.unwatch(Path::new(dir));
    }
    for dir in &dirs {
        if !state.watched_dirs.contains(dir) {
            let _ = debouncer.watch(Path::new(dir), notify_debouncer_full::notify::RecursiveMode::NonRecursive);
        }
    }
    state.watched_dirs = dirs;
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
