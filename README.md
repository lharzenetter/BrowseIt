# File Explorer

A Windows Explorer-style file manager for macOS, built with Tauri 2 (Rust) and React + TypeScript.

## Features

- **Sidebar** with Quick Access folders (Desktop, Documents, Downloads, Pictures, Music, Movies, Applications) and mounted Volumes
- **Breadcrumb address bar** -- click segments to navigate, click the bar to type a path directly
- **Three view modes** -- Details (sortable columns), Grid (icons), and List (compact)
- **File operations** -- Copy, Cut, Paste, Delete (to Trash), Rename, New Folder, New File
- **Tabs** -- open multiple directories in the same window
- **Search** -- recursive file name search up to 5 levels deep
- **Preview panel** -- file metadata and text file preview
- **Context menu** -- right-click for all operations
- **Drag and drop** -- move files between folders
- **Keyboard shortcuts** -- full keyboard-driven workflow
- **Hidden files toggle** -- show/hide dotfiles

## Prerequisites

- **Rust** (1.77.2+) -- install via [rustup](https://rustup.rs/)
- **Node.js** (18+) and npm
- **Xcode Command Line Tools** (macOS) -- `xcode-select --install`

## Getting Started

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npx tauri dev
```

This starts the Vite dev server with hot reload and opens the Tauri window.

### Build for production

```bash
npx tauri build
```

Outputs are placed in `src-tauri/target/release/bundle/`:

| Format | Location |
|---|---|
| macOS App | `bundle/macos/File Explorer.app` |
| DMG Installer | `bundle/dmg/File Explorer_0.1.0_aarch64.dmg` |

### Run the built app

```bash
open src-tauri/target/release/bundle/macos/File\ Explorer.app
```

Or double-click the `.dmg` to install it like any other macOS application.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+C` | Copy selected items |
| `Cmd+X` | Cut selected items |
| `Cmd+V` | Paste |
| `Cmd+Backspace` | Move to Trash |
| `F2` or `Cmd+Enter` | Rename |
| `Cmd+A` | Select all |
| `Cmd+R` | Refresh |
| `Cmd+T` | New tab |
| `Cmd+W` | Close tab |
| `Cmd+[` | Go back |
| `Cmd+]` | Go forward |
| `Alt+Up` | Go to parent directory |
| `Cmd+P` | Toggle preview panel |
| `Enter` | Open selected item |
| `Escape` | Clear selection |
| `Arrow Up/Down` | Navigate file list |

## Project Structure

```
file-explorer/
  src/                        # React frontend
    components/
      AddressBar.tsx           # Breadcrumb navigation + search
      ContextMenu.tsx          # Right-click menu
      FileList.tsx             # Details/Grid/List views
      PreviewPanel.tsx         # File info + text preview
      Sidebar.tsx              # Quick Access + Volumes
      StatusBar.tsx            # Item count + selection info
      TabBar.tsx               # Tab management
      Toolbar.tsx              # Navigation + file operation buttons
    hooks/
      useFileExplorer.ts       # Core state management + all operations
    types/
      index.ts                 # TypeScript type definitions
    utils/
      format.ts                # File size, date, icon formatting
    App.tsx                    # Main app layout
    index.css                  # Windows Explorer-inspired styles
    main.tsx                   # Entry point
  src-tauri/                   # Rust backend (Tauri)
    src/
      lib.rs                   # All Tauri commands (file ops, search, etc.)
      main.rs                  # App entry point
    Cargo.toml                 # Rust dependencies
    tauri.conf.json            # Tauri configuration
    capabilities/default.json  # Permission declarations
```

## Tech Stack

- **Backend:** Rust via [Tauri 2](https://v2.tauri.app/) -- native performance, ~10 MB bundle
- **Frontend:** React 19 + TypeScript + [Vite](https://vite.dev/)
- **File operations:** Direct filesystem access through Rust, trash support via [`trash`](https://crates.io/crates/trash), file opening via [`open`](https://crates.io/crates/open), recursive search via [`walkdir`](https://crates.io/crates/walkdir)

## License

[MIT](./LICENSE)
