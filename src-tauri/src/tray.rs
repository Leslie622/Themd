use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

/// 托盘右键菜单窗口 label,主窗口外的第二个常驻窗口
pub(crate) const TRAY_MENU_LABEL: &str = "tray-menu";
const TRAY_OPEN_EVENT: &str = "tray://open";

/// 菜单窗口上一次的物理尺寸:开菜单前按它预落位,让前端 Radix 打开时量到
/// 的视口就是正确大小(否则按旧视口计算的可用高度会把菜单钳进滚动条)
static MENU_LAST_SIZE: std::sync::Mutex<Option<(i32, i32)>> = std::sync::Mutex::new(None);

fn menu_last_size() -> Option<(i32, i32)> {
    MENU_LAST_SIZE.lock().unwrap_or_else(|e| e.into_inner()).map(|(w, h)| (w, h))
}

fn remember_menu_size(w: i32, h: i32) {
    *MENU_LAST_SIZE.lock().unwrap_or_else(|e| e.into_inner()) = Some((w, h));
}

pub(crate) fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    // 原生菜单弃用:右键菜单由 tray-menu 窗口自绘(shadcn,样式随应用主题),
    // 不绑定 .menu() 时 tray-icon 右键不会弹原生菜单,Click 事件照常下发
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().expect("bundle icon missing").clone())
        .tooltip("Themd")
        .on_tray_icon_event(|tray, event| match event {
            // 左键单击无条件唤起:窗口只是被压在别的窗口下面时(可见、未最小化)
            // 同样要提到最上层,只在隐藏/最小化时响应会让这种状态点了没反应
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => summon_main(tray.app_handle()),
            // 右键按下即开合自绘菜单(Down 响应比 Up 跟手,与原生托盘菜单一致)
            TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Down,
                position,
                ..
            } => toggle_tray_menu(tray.app_handle(), position),
            _ => {}
        })
        .build(app)?;
    build_tray_menu_window(app)?;
    Ok(())
}

/// 唤起主窗口并置于最上层。set_focus 必须放在 show/unminimize 之后:tao 在
/// Windows 上只在「可见且未最小化」时才执行抢前台(先试 SetForegroundWindow,
/// 被系统前台锁拒绝时注入 Alt 键绕过),窗口隐藏或最小化状态下它是空操作。
pub(crate) fn summon_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// 退出前通知前端冲刷未写回的绑定编辑,再留出写回窗口(写回防抖 500ms + IPC 余量)。
/// app.exit 会直接结束进程,不给这 600ms 的话最后一次编辑可能丢在防抖里。
pub(crate) fn quit_gracefully(app: &tauri::AppHandle) {
    let _ = Emitter::emit(app, "app-before-quit", ());
    std::thread::sleep(std::time::Duration::from_millis(600));
    app.exit(0);
}

/// 托盘右键 = 开合自绘菜单:已显示就收回,否则预落位(不显示,按上次尺寸把
/// 窗口先摆到光标处,保证前端量视口时大小正确)后通知前端弹出。
fn toggle_tray_menu(app: &tauri::AppHandle, position: PhysicalPosition<f64>) {
    let Some(win) = app.get_webview_window(TRAY_MENU_LABEL) else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
        return;
    }
    if let Some((w, h)) = menu_last_size() {
        let _ = place_menu_window(&win, position.x, position.y, w, h, false);
    }
    let _ = Emitter::emit_to(
        app,
        TRAY_MENU_LABEL,
        TRAY_OPEN_EVENT,
        TrayAnchor { cursor_x: position.x, cursor_y: position.y },
    );
}

#[derive(serde::Serialize, Clone)]
struct TrayAnchor {
    cursor_x: f64,
    cursor_y: f64,
}

/// 把菜单窗口落位到光标处并显示。前端量的是逻辑像素,按光标所在显示器缩放比
/// 换算物理尺寸——缩放只是**估计**(探测器链可能拿不准高 DPI),首帧先按它
/// 落位,前端显示后会用窗口真实 devicePixelRatio 经 resize_tray_menu 校正。
/// 对齐原生托盘菜单习惯(左缘贴光标、底缘贴光标,即 TPM_LEFTALIGN |
/// TPM_BOTTOMALIGN,托盘在屏幕底缘时菜单向上弹),再钳回显示器边界。
pub(crate) fn place_tray_menu(
    app: &tauri::AppHandle,
    cursor_x: f64,
    cursor_y: f64,
    width: f64,
    height: f64,
) -> tauri::Result<()> {
    let Some(win) = app.get_webview_window(TRAY_MENU_LABEL) else {
        return Ok(());
    };
    // 缩放回落链:光标所在显示器 → 窗口当前显示器 → 窗口自身缩放 → 1.0
    let scale = win
        .monitor_from_point(cursor_x, cursor_y)?
        .or(win.current_monitor()?)
        .map_or_else(
            || win.scale_factor().unwrap_or(1.0),
            |m| m.scale_factor(),
        );
    let w = ((width * scale).round() as i32).max(1);
    let h = ((height * scale).round() as i32).max(1);
    place_menu_window(&win, cursor_x, cursor_y, w, h, true)
}

/// 校正通道:前端量到窗口视口装不下(或装多了)内容时,按窗口真实
/// devicePixelRatio 换算好的物理像素直接改尺寸。窗口已可见时才生效——
/// 失焦已藏的窗口不复活、不挪位。
pub(crate) fn resize_tray_menu(
    app: &tauri::AppHandle,
    cursor_x: f64,
    cursor_y: f64,
    width_px: f64,
    height_px: f64,
) -> tauri::Result<()> {
    let Some(win) = app.get_webview_window(TRAY_MENU_LABEL) else {
        return Ok(());
    };
    if !win.is_visible().unwrap_or(false) {
        return Ok(());
    }
    let w = (width_px.round() as i32).max(1);
    let h = (height_px.round() as i32).max(1);
    place_menu_window(&win, cursor_x, cursor_y, w, h, false)
}

/// 统一落位:左缘贴光标 x、底缘贴光标 y,钳回光标所在显示器边界。
/// max/min 链式钳制(不用 clamp:菜单比显示器还宽时 clamp 的下界会大于上界,
/// 直接 panic)。
fn place_menu_window(
    win: &tauri::WebviewWindow,
    cursor_x: f64,
    cursor_y: f64,
    w: i32,
    h: i32,
    show: bool,
) -> tauri::Result<()> {
    let mut x = cursor_x.round() as i32;
    let mut y = cursor_y.round() as i32 - h;
    if let Ok(Some(m)) = win.monitor_from_point(cursor_x, cursor_y) {
        let pos = m.position();
        let size = m.size();
        let max_x = pos.x + size.width as i32 - w;
        let max_y = pos.y + size.height as i32 - h;
        x = x.max(pos.x).min(max_x);
        y = y.max(pos.y).min(max_y);
    }
    win.set_size(PhysicalSize::new(w as u32, h as u32))?;
    win.set_position(PhysicalPosition::new(x, y))?;
    remember_menu_size(w, h);
    if show {
        win.show()?;
        win.set_focus()?;
    }
    Ok(())
}

/// 收回托盘菜单(前端 Esc/选中菜单项时也走命令调这里)
pub(crate) fn hide_tray_menu(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window(TRAY_MENU_LABEL) {
        let _ = win.hide();
    }
}

/// 菜单窗口启动即创建、常驻隐藏:右键秒弹,不用临时起 WebView。
/// 内容与主窗口同一个前端包(main.tsx 按 label 分流,只挂菜单组件,很轻),
/// 主题令牌(shadcn popover 色)与主窗口同一套,深浅色跟随 store-appearance。
fn build_tray_menu_window(app: &tauri::App) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, TRAY_MENU_LABEL, WebviewUrl::App("index.html".into()))
        .title("Themd")
        .visible(false)
        .decorations(false)
        .transparent(true)
        // 透明窗口关掉系统投影:菜单的阴影由内容自己的 box-shadow 画在窗口内
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .focused(false)
        .build()?;
    Ok(())
}
