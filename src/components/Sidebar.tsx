


interface SidebarProps {
  quickAccessPaths: [string, string][];
  volumes: { name: string; mount_point: string }[];
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar = ({
  quickAccessPaths,
  volumes,
  currentPath,
  onNavigate,
}: SidebarProps) => {
  const sidebarIcons: Record<string, string> = {
    Desktop: '🖥️',
    Documents: '📄',
    Downloads: '⬇️',
    Pictures: '🖼️',
    Music: '🎵',
    Movies: '🎬',
    Applications: '📱',
  };

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-title">Quick Access</div>
        {quickAccessPaths.map(([name, path]) => (
          <div
            key={path}
            className={`sidebar-item ${currentPath === path ? 'active' : ''}`}
            onClick={() => onNavigate(path)}
          >
            <span className="sidebar-icon">{sidebarIcons[name] || '📁'}</span>
            <span className="sidebar-label">{name}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Volumes</div>
        {volumes.map((vol) => (
          <div
            key={vol.mount_point}
            className={`sidebar-item ${currentPath === vol.mount_point ? 'active' : ''}`}
            onClick={() => onNavigate(vol.mount_point)}
          >
            <span className="sidebar-icon">💾</span>
            <span className="sidebar-label">{vol.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
