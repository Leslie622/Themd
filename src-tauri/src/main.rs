// 隐藏 Windows 控制台窗口:默认 console 子系统会随应用弹一个终端宿主,
// 且终端关闭会连带杀掉应用;GUI 子系统才是桌面应用的正确形态。
// dev 模式保留终端看日志,发布构建 windows_subsystem = "windows" 生效
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod commands;
mod tray;
mod window;

fn main() {
    tauri::Builder::default()
        // 单实例锁:应用「关闭到托盘」后进程常驻,再点快捷方式必须唤起已有
        // 实例而不是再起一个(否则托盘会堆出多个隐藏实例)。回调里拿到的是
        // 第二实例的 argv,需要时可用于文件关联打开;这里只做聚焦唤起。
        // 插件必须第一个注册,晚于其他插件时锁的行为不保证
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // 图床上传:HTTP 请求经本插件在 Rust 层发出,绕开 WebView CORS;
        // 域名白名单放在 capabilities/default.json 的 http:default 配置里
        .plugin(tauri_plugin_http::init())
        // 开机自启:写 HKCU\...\Run 注册表键,开关由设置抽屉经 IPC 控制。
        // 启动参数最小化启动:自启时窗口直接进托盘,不弹窗打扰
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            commands::fonts::list_system_fonts,
            commands::files::read_folder_notes,
            commands::files::read_text_files,
            commands::files::write_text_file,
            commands::files::write_image_file,
            commands::pdf::export_pdf
        ])
        .setup(|app| {
            tray::build_tray(app)?;
            // 开机自启带 --minimized:窗口建好后直接藏进托盘,不弹窗打扰。
            // 手动启动无此参数,正常显示主界面
            if std::env::args().any(|arg| arg == "--minimized") {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭到托盘:点 X 只隐藏,真正退出走托盘菜单的「退出」
            window::handle_event(window, event);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
