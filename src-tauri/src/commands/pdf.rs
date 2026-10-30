#[tauri::command]
/// 导出 PDF:调 WebView2 的 PrintToPdf(ICoreWebView2_7)直接生成,不走打印对话框。
/// 渲染用的就是页面 @media print 样式(前端切到预览视图后再调用),与打印一致;
/// PrintToPdf 是异步 COM,wait_for_async_operation 内部自带消息泵,须在 UI 线程跑,
/// 因此整体包进 with_webview。仅 Windows(WebView2)。
pub(crate) async fn export_pdf(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::Manager;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6, ICoreWebView2_7, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING, PCWSTR};

    let window = app.get_webview_window("main").ok_or("主窗口不存在")?;
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    window
        .with_webview(move |webview| {
            let send = |result: Result<(), String>| {
                tx.send(result).ok();
            };
            let run = || -> Result<(), String> {
                unsafe {
                    let controller = webview.controller();
                    let core = controller.CoreWebView2().map_err(|e| e.to_string())?;
                    // 打印设置:A4 纵向、无页眉页脚;颜色/背景交给页面的 print 样式
                    let env6: ICoreWebView2Environment6 = webview
                        .environment()
                        .cast()
                        .map_err(|e| format!("不支持的 WebView2 运行时: {e}"))?;
                    let settings = env6.CreatePrintSettings().map_err(|e| e.to_string())?;
                    settings
                        .SetShouldPrintHeaderAndFooter(false.into())
                        .map_err(|e| e.to_string())?;
                    settings
                        .SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)
                        .map_err(|e| e.to_string())?;
                    settings.SetPageWidth(8.27).map_err(|e| e.to_string())?;
                    settings.SetPageHeight(11.69).map_err(|e| e.to_string())?;
                    let core7: ICoreWebView2_7 = core.cast().map_err(|e| {
                        format!("不支持的 WebView2 运行时: {e}")
                    })?;
                    let hstr = HSTRING::from(path);
                    PrintToPdfCompletedHandler::wait_for_async_operation(
                        Box::new(move |handler| {
                            core7.PrintToPdf(PCWSTR::from_raw(hstr.as_ptr()), &settings, &handler)
                                .map_err(Into::into)
                        }),
                        Box::new(|error_code, is_successful| {
                            if let Err(e) = error_code {
                                return Err(e);
                            }
                            if !is_successful {
                                return Err(windows::core::Error::from_hresult(
                                    windows::core::HRESULT(-2147467259), // E_FAIL
                                ));
                            }
                            Ok(())
                        }),
                    )
                    .map_err(|e| format!("PDF 生成失败: {e}"))
                }
            };
            send(run());
        })
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|_| "PDF 生成中断".to_string())?
}

