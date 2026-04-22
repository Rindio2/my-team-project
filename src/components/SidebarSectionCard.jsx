export default function SidebarSectionCard({
  id,
  icon,
  title,
  defaultOpen = false,
  className = '',
  bodyClassName = '',
  style,
  children,
}) {
  const wrapperClassName = ['sidebar-card', className].filter(Boolean).join(' ');
  const sectionBodyClassName = ['sidebar-card-body', bodyClassName].filter(Boolean).join(' ');
  const sectionKey = id || title.toLowerCase().replace(/\s+/g, '-');
  const summaryId = `${sectionKey}-summary`;
  const bodyId = `${sectionKey}-body`;

  return (
    <details
      id={id}
      className={wrapperClassName}
      data-sidebar-section={sectionKey}
      open={defaultOpen}
      style={style}
    >
      <summary
        id={summaryId}
        className="section-heading sidebar-card-summary"
        aria-controls={bodyId}
      >
        <span className="section-icon">{icon}</span>
        <span className="section-title">{title}</span>
      </summary>
      <div id={bodyId} className={sectionBodyClassName} role="group" aria-labelledby={summaryId}>
        {children}
      </div>
    </details>
  );
}
