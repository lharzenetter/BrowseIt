export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

// ---------------------------------------------------------------------------
// formatDate
//
// `toLocaleDateString` is one of the slowest JS builtins — it invokes the
// Intl machinery on every call.  We cache results keyed by the epoch value
// so a directory with 10k files that were all modified at different times pays
// the Intl cost at most once per unique timestamp per session.
// ---------------------------------------------------------------------------

const dateCache = new Map<number, string>();

export function formatDate(epoch: number | null): string {
  if (!epoch) return '—';
  const cached = dateCache.get(epoch);
  if (cached !== undefined) return cached;

  const date = new Date(epoch * 1000);
  const result = date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  dateCache.set(epoch, result);
  return result;
}

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// getFileIcon
//
// The original function allocated a new `iconMap` object literal on every
// call.  We hoist it to module scope so it is created once.  We also cache
// the resolved icon string per extension to avoid repeated lookups.
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, string> = {
  // Images
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️', ico: '🖼️', bmp: '🖼️',
  // Videos
  mp4: '🎬', avi: '🎬', mkv: '🎬', mov: '🎬', wmv: '🎬', flv: '🎬', webm: '🎬',
  // Audio
  mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵', aac: '🎵', m4a: '🎵',
  // Documents
  pdf: '📄', doc: '📝', docx: '📝', odt: '📝', rtf: '📝',
  // Spreadsheets
  xls: '📊', xlsx: '📊', csv: '📊', ods: '📊',
  // Presentations
  ppt: '📊', pptx: '📊', odp: '📊',
  // Code
  js: '💻', ts: '💻', jsx: '💻', tsx: '💻', py: '💻', rs: '💻', go: '💻',
  java: '💻', c: '💻', cpp: '💻', h: '💻', css: '💻', html: '💻', xml: '💻',
  json: '💻', yaml: '💻', yml: '💻', toml: '💻', md: '💻', sh: '💻',
  // Archives
  zip: '📦', tar: '📦', gz: '📦', bz2: '📦', xz: '📦', rar: '📦', '7z': '📦',
  // Executables
  exe: '⚙️', app: '⚙️', dmg: '⚙️', pkg: '⚙️', deb: '⚙️', rpm: '⚙️',
  // Text
  txt: '📃', log: '📃',
};

// The folder SVG is the same for every folder — allocate it once.
const FOLDER_ICON: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" fill="#FFB900" stroke="#E6A700" strokeWidth="0.5"/>
  </svg>
);

export function getFileIcon(entry: { is_dir: boolean; extension: string; name: string }): ReactNode {
  if (entry.is_dir) return FOLDER_ICON;
  return ICON_MAP[entry.extension.toLowerCase()] ?? '📄';
}

// ---------------------------------------------------------------------------
// getFileType
//
// Same pattern: hoist the type map to module scope.
// ---------------------------------------------------------------------------

const TYPE_MAP: Record<string, string> = {
  png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image', gif: 'GIF Image',
  svg: 'SVG Image', webp: 'WebP Image', bmp: 'BMP Image',
  mp4: 'MP4 Video', avi: 'AVI Video', mkv: 'MKV Video', mov: 'MOV Video',
  mp3: 'MP3 Audio', wav: 'WAV Audio', flac: 'FLAC Audio',
  pdf: 'PDF Document', doc: 'Word Document', docx: 'Word Document',
  xls: 'Excel Spreadsheet', xlsx: 'Excel Spreadsheet', csv: 'CSV File',
  ppt: 'PowerPoint', pptx: 'PowerPoint',
  js: 'JavaScript', ts: 'TypeScript', py: 'Python', rs: 'Rust', go: 'Go',
  java: 'Java', c: 'C Source', cpp: 'C++ Source', css: 'CSS Stylesheet',
  html: 'HTML Document', json: 'JSON File', xml: 'XML File',
  zip: 'ZIP Archive', tar: 'TAR Archive', gz: 'GZip Archive',
  txt: 'Text File', log: 'Log File', md: 'Markdown',
  sh: 'Shell Script', yaml: 'YAML File', yml: 'YAML File', toml: 'TOML File',
};

// Cache the fallback label too (e.g. "RS File", "TOML File") so
// the string concatenation + toUpperCase only runs once per extension.
const typeCache = new Map<string, string>();

export function getFileType(entry: { is_dir: boolean; extension: string }): string {
  if (entry.is_dir) return 'Folder';
  const ext = entry.extension.toLowerCase();
  const known = TYPE_MAP[ext];
  if (known) return known;

  const cached = typeCache.get(ext);
  if (cached !== undefined) return cached;
  const fallback = ext ? `${ext.toUpperCase()} File` : 'File';
  typeCache.set(ext, fallback);
  return fallback;
}
