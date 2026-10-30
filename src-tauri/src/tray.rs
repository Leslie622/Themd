use tauri::Manager;

pub(crate) fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{menu::{Menu, MenuItem}, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}};
    let show = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().expect("bundle icon missing").clone())
        .tooltip("Themd")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() { "show" => show_main(app), "quit" => app.exit(0), _ => {} })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event { summon_main_if_hidden(tray.app_handle()); }
        })
        .build(app)?;
    Ok(())
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") { let _ = win.show(); let _ = win.unminimize(); let _ = win.set_focus(); }
}

fn summon_main_if_hidden(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let hidden = !win.is_visible().unwrap_or(false) || win.is_minimized().unwrap_or(false);
        if hidden { show_main(app); }
    }
}
