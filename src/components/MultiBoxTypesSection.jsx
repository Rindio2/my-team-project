import SidebarSectionCard from './SidebarSectionCard.jsx';

export default function MultiBoxTypesSection() {
  return (
    <SidebarSectionCard id="multiBoxTypesSection" icon="📚" title="Danh sách item" defaultOpen>
      <div id="multiBoxTypesList"></div>

      <div className="packing-rules-card">
        <div className="dimension-inputs">
          <div className="input-group">
            <label>Tải sàn tối đa (kg/m²)</label>
            <input id="packingFloorLoadLimit" type="number" min="0" step="50" defaultValue="0" />
          </div>
        </div>
        <div className="section-note">
          Nhập `0` để bỏ qua. Giá trị này áp dụng cho tải truyền xuống sàn container sau khi cộng dồn
          theo cột đỡ.
        </div>
      </div>

      <button id="btnAddBoxType" data-command="add-empty-item" className="btn-secondary full-width">
        ➕ Thêm item trống
      </button>
    </SidebarSectionCard>
  );
}
