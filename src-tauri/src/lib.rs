use serde::{Deserialize, Serialize};
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
// Manager trait imported for plugin setup
#[allow(unused_imports)]
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<u64>,
    pub created: Option<u64>,
    pub extension: String,
    pub permissions: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub entries: Vec<FileEntry>,
    pub total: usize,
}

fn system_time_to_epoch(time: SystemTime) -> Option<u64> {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

#[cfg(unix)]
fn get_permissions_mode(metadata: &fs::Metadata) -> String {
    format!("{:o}", metadata.permissions().mode())
}

#[cfg(not(unix))]
fn get_permissions_mode(_metadata: &fs::Metadata) -> String {
    String::from("N/A")
}

fn file_entry_from_path_safe(path: &Path) -> Result<FileEntry, String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let real_metadata = if metadata.is_symlink() {
        fs::metadata(path).unwrap_or(metadata.clone())
    } else {
        metadata.clone()
    };

    let perms = get_permissions_mode(&metadata);

    Ok(FileEntry {
        name: name.clone(),
        path: path.to_string_lossy().to_string(),
        is_dir: real_metadata.is_dir(),
        is_hidden: is_hidden(&name),
        is_symlink: metadata.is_symlink(),
        size: real_metadata.len(),
        modified: real_metadata.modified().ok().and_then(system_time_to_epoch),
        created: real_metadata.created().ok().and_then(system_time_to_epoch),
        extension: path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default(),
        permissions: perms,
    })
}

#[tauri::command]
fn list_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries: Vec<FileEntry> = Vec::new();

    let read_dir = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        if let Ok(entry) = entry {
            let path = entry.path();
            match file_entry_from_path_safe(&path) {
                Ok(file_entry) => {
                    if show_hidden || !file_entry.is_hidden {
                        entries.push(file_entry);
                    }
                }
                Err(_) => continue,
            }
        }
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
fn get_home_directory() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[tauri::command]
fn get_quick_access_paths() -> Result<Vec<(String, String)>, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let mut paths = Vec::new();

    let known_dirs = vec![
        ("Desktop", home.join("Desktop")),
        ("Documents", home.join("Documents")),
        ("Downloads", home.join("Downloads")),
        ("Pictures", home.join("Pictures")),
        ("Music", home.join("Music")),
        ("Movies", home.join("Movies")),
        ("Applications", PathBuf::from("/Applications")),
    ];

    for (name, path) in known_dirs {
        if path.exists() {
            paths.push((name.to_string(), path.to_string_lossy().to_string()));
        }
    }

    Ok(paths)
}

#[tauri::command]
fn get_volumes() -> Result<Vec<DiskInfo>, String> {
    let mut disks = Vec::new();

    // On macOS, volumes are mounted under /Volumes
    if let Ok(entries) = fs::read_dir("/Volumes") {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry
                .file_name()
                .to_string_lossy()
                .to_string();
            disks.push(DiskInfo {
                name,
                mount_point: path.to_string_lossy().to_string(),
                total_space: 0,
                available_space: 0,
            });
        }
    }

    // Always include root
    disks.insert(0, DiskInfo {
        name: "Macintosh HD".to_string(),
        mount_point: "/".to_string(),
        total_space: 0,
        available_space: 0,
    });

    Ok(disks)
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    // Create parent directories if they don't exist
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directories: {}", e))?;
    }
    fs::File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn rename_item(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename: {}", e))
}

#[tauri::command]
fn delete_items(paths: Vec<String>, use_trash: bool) -> Result<(), String> {
    for path in paths {
        if use_trash {
            trash::delete(&path).map_err(|e| format!("Failed to move to trash: {}", e))?;
        } else {
            let p = Path::new(&path);
            if p.is_dir() {
                fs::remove_dir_all(p).map_err(|e| format!("Failed to delete directory: {}", e))?;
            } else {
                fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn copy_items(sources: Vec<String>, destination: String) -> Result<(), String> {
    let dest_path = Path::new(&destination);
    if !dest_path.is_dir() {
        return Err("Destination must be a directory".to_string());
    }

    for source in sources {
        let src_path = Path::new(&source);
        let file_name = src_path
            .file_name()
            .ok_or("Invalid source path")?;
        let target = dest_path.join(file_name);

        if src_path.is_dir() {
            copy_dir_recursive(src_path, &target)?;
        } else {
            fs::copy(src_path, &target)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("Failed to create directory: {}", e))?;

    let entries = fs::read_dir(src).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn move_items(sources: Vec<String>, destination: String) -> Result<(), String> {
    let dest_path = Path::new(&destination);
    if !dest_path.is_dir() {
        return Err("Destination must be a directory".to_string());
    }

    for source in sources {
        let src_path = Path::new(&source);
        let file_name = src_path
            .file_name()
            .ok_or("Invalid source path")?;
        let target = dest_path.join(file_name);

        // Try rename first (fast, same filesystem)
        if fs::rename(src_path, &target).is_err() {
            // Fallback: copy + delete (cross-filesystem)
            if src_path.is_dir() {
                copy_dir_recursive(src_path, &target)?;
                fs::remove_dir_all(src_path)
                    .map_err(|e| format!("Failed to remove original directory: {}", e))?;
            } else {
                fs::copy(src_path, &target)
                    .map_err(|e| format!("Failed to copy file: {}", e))?;
                fs::remove_file(src_path)
                    .map_err(|e| format!("Failed to remove original file: {}", e))?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn get_file_info(path: String) -> Result<FileEntry, String> {
    file_entry_from_path_safe(Path::new(&path))
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open file: {}", e))
}

#[tauri::command]
fn open_in_terminal(path: String) -> Result<(), String> {
    let dir = if std::fs::metadata(&path)
        .map(|m| m.is_dir())
        .unwrap_or(false)
    {
        path.clone()
    } else {
        Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path)
    };

    let settings = get_settings().unwrap_or_default();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", &settings.terminal, &dir])
            .spawn()
            .map_err(|e| format!("Failed to open {}: {}", settings.terminal, e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators in order
        let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"];
        let mut opened = false;
        for term in &terminals {
            if std::process::Command::new(term)
                .arg("--working-directory")
                .arg(&dir)
                .spawn()
                .is_ok()
            {
                opened = true;
                break;
            }
        }
        if !opened {
            return Err("No terminal emulator found".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &format!("cd /d {}", dir)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn search_files(directory: String, query: String, max_results: usize) -> Result<SearchResult, String> {
    let query_lower = query.to_lowercase();
    let mut entries = Vec::new();
    let mut total = 0;

    let walker = walkdir::WalkDir::new(&directory)
        .max_depth(5)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());

    for entry in walker {
        let file_name = entry
            .file_name()
            .to_string_lossy()
            .to_lowercase();

        if file_name.contains(&query_lower) {
            total += 1;
            if entries.len() < max_results {
                if let Ok(file_entry) = file_entry_from_path_safe(entry.path()) {
                    entries.push(file_entry);
                }
            }
        }
    }

    Ok(SearchResult { entries, total })
}

#[tauri::command]
fn get_parent_path(path: String) -> Result<Option<String>, String> {
    Ok(Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    // Limit preview to first 10KB
    Ok(content.chars().take(10240).collect())
}

#[tauri::command]
fn get_path_components(path: String) -> Result<Vec<(String, String)>, String> {
    let p = Path::new(&path);
    let mut components = Vec::new();
    let mut current = PathBuf::new();

    for component in p.components() {
        current.push(component);
        let name = match component {
            std::path::Component::RootDir => "/".to_string(),
            _ => component.as_os_str().to_string_lossy().to_string(),
        };
        components.push((name, current.to_string_lossy().to_string()));
    }

    Ok(components)
}

mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

/// Returns the config directory path, creating it if needed.
fn config_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let config_dir = home.join(".config").join("file-explorer");
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    Ok(config_dir)
}

/// Returns the path to the quick_access.json config file.
fn quick_access_config_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("quick_access.json"))
}

/// Returns the path to the settings.json config file.
fn settings_config_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("settings.json"))
}

#[tauri::command]
fn get_pinned_quick_access() -> Result<Vec<String>, String> {
    let config_path = quick_access_config_path()?;
    if !config_path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read quick access config: {}", e))?;
    let paths: Vec<String> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse quick access config: {}", e))?;
    // Filter out paths that no longer exist
    Ok(paths.into_iter().filter(|p| Path::new(p).exists()).collect())
}

#[tauri::command]
fn add_pinned_quick_access(path: String) -> Result<Vec<String>, String> {
    let mut pinned = get_pinned_quick_access().unwrap_or_default();
    if !pinned.contains(&path) {
        // Verify the path exists and is a directory
        let p = Path::new(&path);
        if !p.exists() {
            return Err(format!("Path does not exist: {}", path));
        }
        if !p.is_dir() {
            return Err("Only directories can be pinned to Quick access".to_string());
        }
        pinned.push(path);
        save_pinned_quick_access(&pinned)?;
    }
    Ok(pinned)
}

#[tauri::command]
fn remove_pinned_quick_access(path: String) -> Result<Vec<String>, String> {
    let mut pinned = get_pinned_quick_access().unwrap_or_default();
    pinned.retain(|p| p != &path);
    save_pinned_quick_access(&pinned)?;
    Ok(pinned)
}

fn save_pinned_quick_access(paths: &[String]) -> Result<(), String> {
    let config_path = quick_access_config_path()?;
    let content = serde_json::to_string_pretty(paths)
        .map_err(|e| format!("Failed to serialize quick access: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write quick access config: {}", e))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub terminal: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            terminal: "Terminal".to_string(),
        }
    }
}

#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    let config_path = settings_config_path()?;
    if !config_path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    let settings: AppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;
    Ok(settings)
}

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let config_path = settings_config_path()?;
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_directory,
            get_home_directory,
            get_quick_access_paths,
            get_volumes,
            create_directory,
            create_file,
            rename_item,
            delete_items,
            copy_items,
            move_items,
            get_file_info,
            open_file,
            open_in_terminal,
            search_files,
            get_parent_path,
            read_text_file,
            get_path_components,
            get_pinned_quick_access,
            add_pinned_quick_access,
            remove_pinned_quick_access,
            get_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
