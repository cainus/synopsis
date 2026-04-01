mod git;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            git::pick_folder,
            git::get_delta,
            git::get_summary,
            git::get_details,
            git::get_file_diff,
            git::get_tests_result,
            git::get_diagrams,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
