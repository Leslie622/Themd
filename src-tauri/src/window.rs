use crate::tray;

pub(crate) fn handle_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    match event {
        // 关闭到托盘:主窗口点 X 只隐藏,真正退出走托盘菜单的「退出」
        tauri::WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = window.hide();
        }
        // 托盘菜单窗口失焦 = 点了窗口外(点外部关闭菜单的语义),直接藏起来;
        // 前端监听同一事件收回菜单态,下次打开重新量尺寸
        tauri::WindowEvent::Focused(false) => {
            if window.label() == tray::TRAY_MENU_LABEL {
                let _ = window.hide();
            }
        }
        _ => {}
    }
}
