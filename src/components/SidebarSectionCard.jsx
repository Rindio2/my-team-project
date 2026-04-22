import { useState } from 'react';

function getSidebarSectionStorageKey(sectionKey) {
  return `packet-opt-sidebar-section:${sectionKey}`;
}

function readStoredSectionOpenState(sectionKey, defaultOpen) {
  if (typeof window === 'undefined') {
    return Boolean(defaultOpen);
  }

  const storedValue = window.localStorage.getItem(getSidebarSectionStorageKey(sectionKey));
  if (storedValue === '1') return true;
  if (storedValue === '0') return false;
  return Boolean(defaultOpen);
}

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
  const [isOpen, setIsOpen] = useState(() => readStoredSectionOpenState(sectionKey, defaultOpen));

  const handleToggle = (event) => {
    const nextOpen = event.currentTarget.open;
    setIsOpen(nextOpen);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(getSidebarSectionStorageKey(sectionKey), nextOpen ? '1' : '0');
    }
  };

  return (
    <details
      id={id}
      className={wrapperClassName}
      data-sidebar-section={sectionKey}
      open={isOpen}
      onToggle={handleToggle}
      style={style}
    >
      <summary
        id={summaryId}
        className="section-heading sidebar-card-summary"
        aria-controls={bodyId}
        aria-expanded={isOpen}
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
