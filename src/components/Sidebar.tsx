import { useState, type ReactNode } from 'react';

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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    home: true,
    thispc: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const sidebarIcons: Record<string, ReactNode> = {
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

  const defaultFolderIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" fill="#FFB900" stroke="#E6A700" strokeWidth="0.5"/>
    </svg>
  );

  const volumeIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="#666" strokeWidth="1.2"/>
      <rect x="3.5" y="6" width="5" height="1.5" rx="0.5" fill="#4FC3F7"/>
      <circle cx="12" cy="9" r="0.8" fill="#4CAF50"/>
    </svg>
  );

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

  return (
    <div className="sidebar">
      {/* Home / Quick Access section */}
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
          {quickAccessPaths.map(([name, path]) => (
            <div
              key={path}
              className={`sidebar-tree-item sidebar-tree-leaf ${currentPath === path ? 'active' : ''}`}
              onClick={() => onNavigate(path)}
            >
              <span className="sidebar-tree-icon">{sidebarIcons[name] || defaultFolderIcon}</span>
              <span className="sidebar-tree-label">{name}</span>
              {(name === 'Desktop' || name === 'Downloads' || name === 'Documents' || name === 'Pictures' || name === 'Music' || name === 'Movies') && (
                <svg className="sidebar-pin" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1L6.5 4H9L7 6l1 3.5L5 7.5 2 9.5l1-3.5L1 4h2.5L5 1z" fill="#666" opacity="0.4"/>
                </svg>
              )}
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
              <span className="sidebar-tree-icon">{volumeIcon}</span>
              <span className="sidebar-tree-label">{vol.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
