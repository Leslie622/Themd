mod commands;
mod tray;
mod window;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fonts::list_system_fonts,
            commands::files::read_folder_notes,
            commands::files::read_text_files,
            commands::files::write_text_file,
            commands::pdf::export_pdf
        ])
        .setup(|app| {
            tray::build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭到托盘:点 X 只隐藏,真正退出走托盘菜单的「退出」
            window::handle_event(window, event);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
