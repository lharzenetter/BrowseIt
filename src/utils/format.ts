export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

export function formatDate(epoch: number | null): string {
  if (!epoch) return '—';
  const date = new Date(epoch * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileIcon(entry: { is_dir: boolean; extension: string; name: string }): string {
  if (entry.is_dir) return '📁';

  const ext = entry.extension.toLowerCase();

  const iconMap: Record<string, string> = {
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

  return iconMap[ext] || '📄';
}

export function getFileType(entry: { is_dir: boolean; extension: string }): string {
  if (entry.is_dir) return 'Folder';

  const ext = entry.extension.toLowerCase();

  const typeMap: Record<string, string> = {
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

  return typeMap[ext] || (ext ? `${ext.toUpperCase()} File` : 'File');
}
