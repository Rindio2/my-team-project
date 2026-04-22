export default function SidebarWorkspaceMap({
  sections,
  activeSectionId,
  onJump,
  onExpandAll,
  onCollapseAll,
}) {
  return (
    <div className="sidebar-workspace-map">
      <div className="sidebar-workspace-map-head">
        <div>
          <div className="sidebar-workspace-map-kicker">Workspace map</div>
          <div className="sidebar-workspace-map-title">Điều hướng nhanh toàn bộ control tower</div>
        </div>
        <div className="sidebar-workspace-map-actions">
          <button type="button" className="sidebar-utility-btn" onClick={onExpandAll}>
            Mở hết
          </button>
          <button type="button" className="sidebar-utility-btn" onClick={onCollapseAll}>
            Thu gọn
          </button>
        </div>
      </div>

      <div className="sidebar-workspace-map-grid" role="navigation" aria-label="Điều hướng sidebar">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`sidebar-map-chip ${activeSectionId === section.id ? 'active' : ''}`}
            aria-pressed={activeSectionId === section.id}
            onClick={() => onJump(section.id)}
          >
            <span className="sidebar-map-chip-icon" aria-hidden="true">
              {section.icon}
            </span>
            <span>{section.shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
