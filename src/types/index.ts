export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_hidden: boolean;
  is_symlink: boolean;
  size: number;
  modified: number | null;
  created: number | null;
  extension: string;
  permissions: string;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_space: number;
  available_space: number;
}

export interface SearchResult {
  entries: FileEntry[];
  total: number;
}

export type ViewMode = 'list' | 'grid' | 'details';
export type SortField = 'name' | 'size' | 'modified' | 'extension';
export type SortDirection = 'asc' | 'desc';

export interface Tab {
  id: string;
  path: string;
  label: string;
}

export interface ClipboardData {
  paths: string[];
  operation: 'copy' | 'cut';
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: FileEntry | null;
}

export interface AppSettings {
  terminal: string;
}
