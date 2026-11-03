use tauri::AppHandle;

use crate::tray;

/// 自绘托盘菜单落位:前端量出菜单尺寸(逻辑像素)后回传,按光标所在显示器
/// 缩放换算物理尺寸,落位到光标处并显示窗口。
#[tauri::command]
pub fn position_tray_menu(
    app: AppHandle,
    cursor_x: f64,
    cursor_y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    tray::place_tray_menu(&app, cursor_x, cursor_y, width, height).map_err(|e| e.to_string())
}

/// 自绘托盘菜单尺寸校正:前端发现窗口视口与内容不匹配时,按窗口真实
/// devicePixelRatio 换算的物理像素调 size_tray_menu;仅对可见窗口生效。
#[tauri::command]
pub fn resize_tray_menu(
    app: AppHandle,
    cursor_x: f64,
    cursor_y: f64,
    width_px: f64,
    height_px: f64,
) -> Result<(), String> {
    tray::resize_tray_menu(&app, cursor_x, cursor_y, width_px, height_px)
        .map_err(|e| e.to_string())
}

/// 收回托盘菜单窗口(Esc / 选中菜单项时前端调用)
#[tauri::command]
pub fn close_tray_menu(app: AppHandle) -> Result<(), String> {
    tray::hide_tray_menu(&app);
    Ok(())
}

/// 自绘托盘菜单的菜单项动作
#[tauri::command]
pub fn tray_menu_action(app: AppHandle, action: String) -> Result<(), String> {
    match action.as_str() {
        "show" => tray::summon_main(&app),
        "quit" => tray::quit_gracefully(&app),
        other => return Err(format!("未知托盘菜单动作: {other}")),
    }
    Ok(())
}
