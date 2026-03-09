import { useState, type ReactNode } from 'react';

const Chevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`sidebar-chevron ${expanded ? 'expanded' : ''}`}
    width="12"
    height="12"
    viewBox="0 0 12 12"
  >
    <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DEFAULT_FOLDER_ICON: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" fill="#FFB900" stroke="#E6A700" strokeWidth="0.5"/>
  </svg>
);

const PINNED_FOLDER_ICON: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" fill="#48a3e0" stroke="#2b88c9" strokeWidth="0.5"/>
  </svg>
);

const VOLUME_ICON: ReactNode = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="#666" strokeWidth="1.2"/>
    <rect x="3.5" y="6" width="5" height="1.5" rx="0.5" fill="#4FC3F7"/>
    <circle cx="12" cy="9" r="0.8" fill="#4CAF50"/>
  </svg>
);

const PIN_ICON: ReactNode = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M6 1.5L4 5H2.5L4 6.5 3 10.5 6 8.5 9 10.5 8 6.5 9.5 5H8L6 1.5z" fill="#888" opacity="0.5"/>
  </svg>
);

const SIDEBAR_ICONS: Record<string, ReactNode> = {
  Home: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l5-4.5L13 8" stroke="#0067c0" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4.5 7v5.5h3V10h1v2.5h3V7" stroke="#0067c0" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Desktop: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="9" rx="1.5" stroke="#0067c0" strokeWidth="1.2"/>
      <path d="M6 13h4M8 11v2" stroke="#0067c0" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  Documents: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 2h5l3 3v9H4V2z" fill="#4FC3F7" stroke="#0288D1" strokeWidth="0.5"/>
      <path d="M9 2v3h3" fill="#B3E5FC" stroke="#0288D1" strokeWidth="0.5"/>
    </svg>
  ),
  Downloads: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8M5 7l3 3 3-3" stroke="#0067c0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 12h10" stroke="#0067c0" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  Pictures: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="#4CAF50" strokeWidth="1.2"/>
      <circle cx="5.5" cy="6.5" r="1.5" fill="#FFD54F"/>
      <path d="M2 11l3-3 2 2 3-4 4 5H2z" fill="#66BB6A"/>
    </svg>
  ),
  Music: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M11 3v8" stroke="#E91E63" strokeWidth="1.2"/>
      <circle cx="7" cy="11" r="2" stroke="#E91E63" strokeWidth="1.2"/>
      <circle cx="11" cy="11" r="2" stroke="#E91E63" strokeWidth="1.2"/>
      <path d="M7 11V4l4-1" stroke="#E91E63" strokeWidth="1.2"/>
    </svg>
  ),
  Movies: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="#9C27B0" strokeWidth="1.2"/>
      <path d="M6 6.5l4 2.5-4 2.5V6.5z" fill="#9C27B0"/>
    </svg>
  ),
  Applications: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="#4FC3F7"/>
      <rect x="9" y="2" width="5" height="5" rx="1" fill="#66BB6A"/>
      <rect x="2" y="9" width="5" height="5" rx="1" fill="#FFB74D"/>
      <rect x="9" y="9" width="5" height="5" rx="1" fill="#EF5350"/>
    </svg>
  ),
};

interface SidebarProps {
  quickAccessPaths: [string, string][];
  pinnedPaths: string[];
  volumes: { name: string; mount_point: string }[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onUnpin: (path: string) => void;
  hiddenHomePaths: string[];
}

export const Sidebar = ({
  quickAccessPaths,
  pinnedPaths,
  volumes,
  currentPath,
  onNavigate,
  onUnpin,
  hiddenHomePaths,
}: SidebarProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quickaccess: true,
    home: true,
    thispc: true,
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePinnedContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  };

  // Close sidebar context menu on any click
  const handleGlobalClick = () => {
    if (contextMenu) setContextMenu(null);
  };

  return (
    <div className="sidebar" onClick={handleGlobalClick}>
      {/* Quick Access section - user-pinned folders */}
      {pinnedPaths.length > 0 && (
        <>
          <div className="sidebar-tree-item sidebar-tree-root"
            onClick={() => toggleSection('quickaccess')}>
            <Chevron expanded={expandedSections.quickaccess !== false} />
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L9.8 5.8H14L10.6 8.2L12 12.5L8 9.7L4 12.5L5.4 8.2L2 5.8H6.2L8 2z" fill="#FFB900" stroke="#E6A700" strokeWidth="0.5"/>
            </svg>
            <span className="sidebar-tree-label">Quick access</span>
          </div>
          {expandedSections.quickaccess !== false && (
            <div className="sidebar-tree-children">
              {pinnedPaths.map((path) => {
                const name = path.split('/').pop() || path;
                return (
                  <div
                    key={path}
                    className={`sidebar-tree-item sidebar-tree-leaf ${currentPath === path ? 'active' : ''}`}
                    onClick={() => onNavigate(path)}
                    onContextMenu={(e) => handlePinnedContextMenu(e, path)}
                  >
                    <span className="sidebar-tree-icon">{PINNED_FOLDER_ICON}</span>
                    <span className="sidebar-tree-label">{name}</span>
                    {PIN_ICON}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Home section - system folders */}
      <div className="sidebar-tree-item sidebar-tree-root"
        onClick={() => toggleSection('home')}>
        <Chevron expanded={expandedSections.home !== false} />
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l5-4.5L13 8" stroke="#0067c0" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4.5 7v5.5h3V10h1v2.5h3V7" stroke="#0067c0" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="sidebar-tree-label">Home</span>
      </div>
      {expandedSections.home !== false && (
        <div className="sidebar-tree-children">
          {quickAccessPaths
            .filter(([, path]) => !(hiddenHomePaths ?? []).includes(path))
            .map(([name, path]) => (
            <div
              key={path}
              className={`sidebar-tree-item sidebar-tree-leaf ${currentPath === path ? 'active' : ''}`}
              onClick={() => onNavigate(path)}
            >
              <span className="sidebar-tree-icon">{SIDEBAR_ICONS[name] || DEFAULT_FOLDER_ICON}</span>
              <span className="sidebar-tree-label">{name}</span>
            </div>
          ))}
        </div>
      )}

      {/* This PC / Volumes section */}
      <div className="sidebar-tree-item sidebar-tree-root"
        onClick={() => toggleSection('thispc')}>
        <Chevron expanded={expandedSections.thispc !== false} />
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="9" rx="1.5" stroke="#555" strokeWidth="1.1"/>
          <path d="M6 13h4M8 11v2" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/>
          <rect x="4" y="4" width="8" height="5" rx="0.5" fill="#E3F2FD"/>
        </svg>
        <span className="sidebar-tree-label">This PC</span>
      </div>
      {expandedSections.thispc !== false && (
        <div className="sidebar-tree-children">
          {volumes.map((vol) => (
            <div
              key={vol.mount_point}
              className={`sidebar-tree-item sidebar-tree-leaf ${currentPath === vol.mount_point ? 'active' : ''}`}
              onClick={() => onNavigate(vol.mount_point)}
            >
              <span className="sidebar-tree-icon">{VOLUME_ICON}</span>
              <span className="sidebar-tree-label">{vol.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sidebar right-click menu for pinned items */}
      {contextMenu && (
        <div
          className="sidebar-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sidebar-ctx-item" onClick={() => {
            onNavigate(contextMenu.path);
            setContextMenu(null);
          }}>
            Open
          </div>
          <div className="sidebar-ctx-separator" />
          <div className="sidebar-ctx-item sidebar-ctx-item-danger" onClick={() => {
            onUnpin(contextMenu.path);
            setContextMenu(null);
          }}>
            Unpin from Quick access
          </div>
        </div>
      )}
    </div>
  );
};
