import SidebarSectionCard from './SidebarSectionCard.jsx';

export default function InfoPanel() {
  return (
    <SidebarSectionCard
      id="infoPanel"
      icon="📋"
      title="Đang chọn"
      defaultOpen
      style={{ display: 'none' }}
    >
      <div id="infoText" className="info-content" role="status" aria-live="polite"></div>
    </SidebarSectionCard>
  );
}
