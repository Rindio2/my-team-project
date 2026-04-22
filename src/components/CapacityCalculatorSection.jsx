import CommandButton from './CommandButton.jsx';
import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const CAPACITY_FIELDS = [
  [
    { id: 'calcContainerLength', label: 'Dài container', defaultValue: '590' },
    { id: 'calcContainerWidth', label: 'Rộng container', defaultValue: '235' },
  ],
  [
    { id: 'calcContainerHeight', label: 'Cao container', defaultValue: '239' },
    { id: 'calcContainerMaxWeight', label: 'Tải tối đa (kg)', defaultValue: '28200' },
  ],
  [
    { id: 'calcBoxLength', label: 'Dài thùng', defaultValue: '80' },
    { id: 'calcBoxWidth', label: 'Rộng thùng', defaultValue: '60' },
  ],
  [
    { id: 'calcBoxHeight', label: 'Cao thùng', defaultValue: '50' },
    { id: 'calcBoxWeight', label: 'Khối lượng thùng (kg)', defaultValue: '20' },
  ],
];

export default function CapacityCalculatorSection() {
  return (
    <SidebarSectionCard id="capacityCalculatorSection" icon="📐" title="Sức chứa">
      {CAPACITY_FIELDS.map((row, rowIndex) => (
        <div key={rowIndex} className="dimension-inputs">
          {row.map((field) => (
            <FieldGroup key={field.id} id={field.id} label={field.label}>
              <input id={field.id} defaultValue={field.defaultValue} type="number" min="1" />
            </FieldGroup>
          ))}
        </div>
      ))}

      <CommandButton
        id="btnCalcCapacity"
        command="capacity-calc"
        className="btn-secondary"
        fullWidth
        layout="stacked"
      >
        🧮 Tính sức chứa
      </CommandButton>

      <CommandButton
        command="capacity-calc-arrange"
        className="btn-primary"
        fullWidth
        layout="stacked"
      >
        📦 Tính + xếp tối đa
      </CommandButton>

      <button
        id="btnAutoArrangeCapacity"
        data-command="capacity-arrange"
        className="btn-primary full-width"
        style={{ display: 'none', marginTop: '10px' }}
      >
        📦 Xếp tối đa
      </button>

      <div
        id="shockOptions"
        className="sidebar-section sub-section"
        style={{ display: 'none', marginTop: '12px', padding: '12px' }}
      >
        <h3 className="section-heading compact-heading" style={{ marginBottom: '10px' }}>
          <span className="section-icon">🧽</span>
          <span className="section-title">Chống sốc</span>
        </h3>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="shockMode" id="shockBasic" value="basic" defaultChecked />
            <span>Chèn theo cách cơ bản</span>
          </label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="shockMode" id="shockCenter" value="center" />
            <span>Chèn giữa container</span>
          </label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" id="shockNet" />
            <span>Chèn lưới chống rơi hàng</span>
          </label>
        </div>

        <button
          id="btnApplyShockVisual"
          data-command="shock-visual"
          className="btn-secondary full-width"
          style={{ marginTop: '12px' }}
        >
          🎯 Hiển thị chống sốc trên mô hình 3D
        </button>
      </div>

      <div
        id="capacityResult"
        className="report-box"
        style={{ display: 'none', marginTop: '12px' }}
      ></div>
    </SidebarSectionCard>
  );
}
