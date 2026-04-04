mod git;
mod json_utils;
mod prompts;
mod symbol_finder;
mod test_parser;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            git::pick_folder,
            git::delta::get_delta,
            git::summary::get_summary,
            git::details::get_details,
            git::delta::get_file_diff,
            symbol_finder::find_symbol_definition,
            symbol_finder::read_file_range,
            git::tests_cmd::get_tests_result,
            git::diagrams::get_diagrams,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
