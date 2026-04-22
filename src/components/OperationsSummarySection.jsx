import SidebarSectionCard from './SidebarSectionCard.jsx';

export default function OperationsSummarySection() {
  return (
    <SidebarSectionCard
      id="operationsSummarySection"
      icon="📈"
      title="Tóm tắt vận hành"
      defaultOpen
    >
      <div id="operationsSummary" className="operations-summary-card" role="status" aria-live="polite">
        Chọn preset hoặc thêm item để bắt đầu dựng một phương án xếp hàng.
      </div>
    </SidebarSectionCard>
  );
}
