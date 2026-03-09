import { useState } from 'react';
import type { AppSettings, CustomContextAction } from '../types/index';

interface SettingsModalProps {
  settings: AppSettings;
  quickAccessPaths: [string, string][];
  onSaveSettings: (settings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal = ({
  settings,
  quickAccessPaths,
  onSaveSettings,
  onClose,
}: SettingsModalProps) => {
  const [editingAction, setEditingAction] = useState<CustomContextAction | null>(null);

  const handleClose = () => {
    setEditingAction(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Settings</div>

        {/* Terminal Application */}
        <div className="settings-section">
          <label className="settings-label">Terminal Application</label>
          <div className="settings-terminal-options">
            {[
              { value: 'Terminal', label: 'Terminal', desc: 'macOS built-in' },
              { value: 'iTerm', label: 'iTerm2', desc: 'iTerm2 terminal' },
            ].map((opt) => (
              <div
                key={opt.value}
                className={`settings-terminal-option${settings.terminal === opt.value ? ' active' : ''}`}
                onClick={() => onSaveSettings({ ...settings, terminal: opt.value })}
              >
                <div className="settings-terminal-radio">
                  <div className={`radio-outer${settings.terminal === opt.value ? ' checked' : ''}`}>
                    {settings.terminal === opt.value && <div className="radio-inner" />}
                  </div>
                </div>
                <div className="settings-terminal-info">
                  <span className="settings-terminal-name">{opt.label}</span>
                  <span className="settings-terminal-desc">{opt.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Context Menu Actions */}
        <div className="settings-section">
          <label className="settings-label">Custom Context Menu Actions</label>
          <div className="settings-custom-actions-list">
            {settings.custom_context_actions.map((action) => (
              <div key={action.id} className="settings-custom-action-item">
                <div className="settings-custom-action-info">
                  <span className="settings-custom-action-label">{action.label}</span>
                  <span className="settings-custom-action-detail">
                    {action.command} {action.args} &middot; {action.applies_to}
                  </span>
                </div>
                <div className="settings-custom-action-buttons">
                  <button
                    className="settings-custom-action-btn"
                    title="Edit"
                    onClick={() => setEditingAction({ ...action })}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="settings-custom-action-btn danger"
                    title="Remove"
                    onClick={() => {
                      const updated = settings.custom_context_actions.filter(
                        (a) => a.id !== action.id
                      );
                      onSaveSettings({ ...settings, custom_context_actions: updated });
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3.5 5h9M6 5V3.5h4V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      <path d="M4.5 5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {settings.custom_context_actions.length === 0 && (
              <div className="settings-custom-actions-empty">
                No custom actions configured. Add one to open files or folders in your favourite apps.
              </div>
            )}
          </div>

          {/* Add / Edit form */}
          {editingAction ? (
            <div className="settings-custom-action-form">
              <div className="settings-custom-action-form-title">
                {settings.custom_context_actions.some((a) => a.id === editingAction.id)
                  ? 'Edit Action'
                  : 'New Action'}
              </div>
              <div className="settings-form-row">
                <label className="settings-form-label">Label</label>
                <input
                  className="settings-form-input"
                  type="text"
                  placeholder="e.g. Open in VS Code"
                  value={editingAction.label}
                  onChange={(e) => setEditingAction({ ...editingAction, label: e.target.value })}
                />
              </div>
              <div className="settings-form-row">
                <label className="settings-form-label">Command</label>
                <input
                  className="settings-form-input"
                  type="text"
                  placeholder="e.g. Visual Studio Code"
                  value={editingAction.command}
                  onChange={(e) => setEditingAction({ ...editingAction, command: e.target.value })}
                />
                <span className="settings-form-hint">App name (e.g. "Visual Studio Code") or full path to executable</span>
              </div>
              <div className="settings-form-row">
                <label className="settings-form-label">Arguments</label>
                <input
                  className="settings-form-input"
                  type="text"
                  placeholder="e.g. {path}"
                  value={editingAction.args}
                  onChange={(e) => setEditingAction({ ...editingAction, args: e.target.value })}
                />
                <span className="settings-form-hint">Use {'{path}'} for the file/folder path, {'{dir}'} for the parent directory</span>
              </div>
              <div className="settings-form-row">
                <label className="settings-form-label">Applies to</label>
                <div className="settings-applies-to-options">
                  {(['both', 'directories', 'files'] as const).map((opt) => (
                    <div
                      key={opt}
                      className={`settings-applies-to-option${editingAction.applies_to === opt ? ' active' : ''}`}
                      onClick={() => setEditingAction({ ...editingAction, applies_to: opt })}
                    >
                      {opt === 'both' ? 'Both' : opt === 'directories' ? 'Directories' : 'Files'}
                    </div>
                  ))}
                </div>
              </div>
              <div className="settings-form-buttons">
                <button className="settings-btn" onClick={() => setEditingAction(null)}>
                  Cancel
                </button>
                <button
                  className="settings-btn settings-btn-primary"
                  disabled={!editingAction.label.trim() || !editingAction.command.trim()}
                  onClick={() => {
                    const actions = [...settings.custom_context_actions];
                    const idx = actions.findIndex((a) => a.id === editingAction.id);
                    if (idx >= 0) {
                      actions[idx] = editingAction;
                    } else {
                      actions.push(editingAction);
                    }
                    onSaveSettings({ ...settings, custom_context_actions: actions });
                    setEditingAction(null);
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              className="settings-btn settings-add-action-btn"
              onClick={() =>
                setEditingAction({
                  id: `action-${Date.now()}`,
                  label: '',
                  command: '',
                  args: '{path}',
                  applies_to: 'both',
                })
              }
            >
              + Add Action
            </button>
          )}
        </div>

        {/* Home Sidebar Items */}
        <div className="settings-section">
          <label className="settings-label">Home Sidebar Items</label>
          <div className="settings-home-items-list">
            {quickAccessPaths.map(([name, path]) => {
              const isHidden = settings.hidden_home_paths.includes(path);
              return (
                <div
                  key={path}
                  className={`settings-home-item${isHidden ? ' disabled' : ''}`}
                  onClick={() => {
                    const updated = isHidden
                      ? settings.hidden_home_paths.filter((p) => p !== path)
                      : [...settings.hidden_home_paths, path];
                    onSaveSettings({ ...settings, hidden_home_paths: updated });
                  }}
                >
                  <div className={`settings-home-item-toggle${isHidden ? '' : ' active'}`}>
                    <div className="toggle-track">
                      <div className="toggle-thumb" />
                    </div>
                  </div>
                  <span className="settings-home-item-name">{name}</span>
                  <span className="settings-home-item-path">{path}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="settings-actions">
          <button className="settings-btn" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
