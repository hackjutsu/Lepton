use crate::runtime::RuntimeFiles;
use tauri::{Manager, WindowEvent};

fn labels(locale: &str) -> (&'static str, &'static str) {
    match locale {
        "es" => ("Abrir ventana de Lepton", "Salir de Lepton"),
        "fr" => ("Ouvrir la fenetre Lepton", "Quitter Lepton"),
        "ja" => ("Leptonウィンドウを開く", "Leptonを終了"),
        "ko" => ("Lepton 창 열기", "Lepton 종료"),
        "tr" => ("Lepton penceresini aç", "Lepton uygulamasından çık"),
        "zh-Hans" => ("打开 Lepton 窗口", "退出 Lepton"),
        "zh-Hant" => ("開啟 Lepton 視窗", "結束 Lepton"),
        _ => ("Open Lepton window", "Quit Lepton"),
    }
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn ensure_tray(app: &tauri::AppHandle) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{TrayIconBuilder, TrayIconEvent};
    if app.tray_by_id("lepton-tray").is_some() {
        return Ok(());
    }
    let files = app.state::<RuntimeFiles>();
    let info = files.info()?;
    let locale = info["config"]["i18n"]["locale"].as_str().unwrap_or("en");
    let (open, quit) = labels(locale);
    let open = MenuItem::with_id(app, "open-lepton", open, true, None::<&str>)
        .map_err(|_| "Unable to create tray menu")?;
    let quit = MenuItem::with_id(app, "quit-lepton", quit, true, None::<&str>)
        .map_err(|_| "Unable to create tray menu")?;
    let menu = Menu::with_items(app, &[&open, &quit]).map_err(|_| "Unable to create tray menu")?;
    let icon = tauri::image::Image::from_bytes(include_bytes!(
        "../../../../build/icon/tray-flowerTemplate.png"
    ))
    .map_err(|_| "Unable to load tray icon")?;
    TrayIconBuilder::with_id("lepton-tray")
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("Lepton")
        .menu(&menu)
        .show_menu_on_left_click(cfg!(target_os = "linux"))
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open-lepton" => show_window(app),
            "quit-lepton" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(event, TrayIconEvent::DoubleClick { .. }) {
                show_window(tray.app_handle());
            }
        })
        .build(app)
        .map_err(|_| "Unable to create system tray")?;
    Ok(())
}

pub fn on_window_event(window: &tauri::Window, event: &WindowEvent) {
    let app = window.app_handle();
    let files = app.state::<RuntimeFiles>();
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            if files.boolean_preference("window:closeToTray") {
                match ensure_tray(app) {
                    Ok(()) => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    Err(error) => files.log_event("warn", &error),
                }
            } else if cfg!(target_os = "macos") {
                api.prevent_close();
                let _ = window.hide();
            }
        }
        WindowEvent::Focused(false) | WindowEvent::Resized(_)
            if files.boolean_preference("window:minimizeToTray") =>
        {
            let window = window.clone();
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(150)).await;
                let main = handle.clone();
                let _ = handle.run_on_main_thread(move || {
                    if window.is_minimized().unwrap_or(false)
                        && main
                            .state::<RuntimeFiles>()
                            .boolean_preference("window:minimizeToTray")
                    {
                        match ensure_tray(&main) {
                            Ok(()) => {
                                let _ = window.hide();
                            }
                            Err(error) => main.state::<RuntimeFiles>().log_event("warn", &error),
                        }
                    }
                });
            });
        }
        _ => {}
    }
}
