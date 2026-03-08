/**
 * TauriFilesystemProvider — production implementation of FilesystemProvider.
 *
 * Every method delegates to the corresponding Tauri IPC command using
 * `invoke()`.  This is a 1-to-1 replacement for the old direct `invoke()`
 * calls spread across useFileExplorer.ts and App.tsx.
 */

import { invoke } from '@tauri-apps/api/core';
import type { FilesystemProvider } from './FilesystemProvider';
import type { FileEntry, DiskInfo, AppSettings, SearchResult } from '../types';

export class TauriFilesystemProvider implements FilesystemProvider {
  // ── Navigation ──────────────────────────────────────────────────────────────
  getHomeDirectory(): Promise<string> {
    return invoke<string>('get_home_directory');
  }

  getParentPath(path: string): Promise<string | null> {
    return invoke<string | null>('get_parent_path', { path });
  }

  getPathComponents(path: string): Promise<Array<[string, string]>> {
    return invoke<Array<[string, string]>>('get_path_components', { path });
  }

  // ── Directory listing ────────────────────────────────────────────────────────
  listDirectory(path: string, showHidden: boolean): Promise<FileEntry[]> {
    return invoke<FileEntry[]>('list_directory', { path, showHidden });
  }

  // ── File operations ──────────────────────────────────────────────────────────
  openFile(path: string): Promise<void> {
    return invoke('open_file', { path });
  }

  createDirectory(path: string): Promise<void> {
    return invoke('create_directory', { path });
  }

  createFile(path: string): Promise<void> {
    return invoke('create_file', { path });
  }

  renameItem(oldPath: string, newPath: string): Promise<void> {
    return invoke('rename_item', { oldPath, newPath });
  }

  deleteItems(paths: string[], useTrash: boolean): Promise<void> {
    return invoke('delete_items', { paths, useTrash });
  }

  copyItems(sources: string[], destination: string): Promise<void> {
    return invoke('copy_items', { sources, destination });
  }

  moveItems(sources: string[], destination: string): Promise<void> {
    return invoke('move_items', { sources, destination });
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  searchFiles(directory: string, query: string, maxResults: number): Promise<SearchResult> {
    return invoke<SearchResult>('search_files', { directory, query, maxResults });
  }

  // ── Preview ──────────────────────────────────────────────────────────────────
  readTextFile(path: string): Promise<string> {
    return invoke<string>('read_text_file', { path });
  }

  getFileInfo(path: string): Promise<FileEntry> {
    return invoke<FileEntry>('get_file_info', { path });
  }

  // ── Sidebar data ─────────────────────────────────────────────────────────────
  getQuickAccessPaths(): Promise<Array<[string, string]>> {
    return invoke<Array<[string, string]>>('get_quick_access_paths');
  }

  getVolumes(): Promise<DiskInfo[]> {
    return invoke<DiskInfo[]>('get_volumes');
  }

  getPinnedQuickAccess(): Promise<string[]> {
    return invoke<string[]>('get_pinned_quick_access');
  }

  addPinnedQuickAccess(path: string): Promise<string[]> {
    return invoke<string[]>('add_pinned_quick_access', { path });
  }

  removePinnedQuickAccess(path: string): Promise<string[]> {
    return invoke<string[]>('remove_pinned_quick_access', { path });
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  getSettings(): Promise<AppSettings> {
    return invoke<AppSettings>('get_settings');
  }

  saveSettings(settings: AppSettings): Promise<void> {
    return invoke('save_settings', { settings });
  }

  // ── Windowing / shell ────────────────────────────────────────────────────────
  openNewWindow(path: string): Promise<void> {
    return invoke('open_new_window', { path });
  }

  openInTerminal(path: string): Promise<void> {
    return invoke('open_in_terminal', { path });
  }

  compressToZip(paths: string[]): Promise<void> {
    return invoke('compress_to_zip', { paths });
  }

  runCustomContextAction(command: string, args: string, path: string): Promise<void> {
    return invoke('run_custom_context_action', { command, args, path });
  }
}
