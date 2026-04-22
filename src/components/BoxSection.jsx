import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const PRIMARY_BOX_FIELDS = [
  { id: 'bLabel', label: 'Tên item', type: 'text', defaultValue: 'Thùng đơn' },
  { id: 'bw', label: 'Rộng', type: 'number', defaultValue: '60', step: '1' },
  { id: 'bh', label: 'Cao', type: 'number', defaultValue: '50', step: '1' },
  { id: 'bd', label: 'Dài', type: 'number', defaultValue: '80', step: '1' },
];

const SECONDARY_BOX_FIELDS = [
  { id: 'bWeight', label: 'Kg', type: 'number', defaultValue: '20', step: '1' },
  { id: 'bQty', label: 'Số lượng', type: 'number', defaultValue: '1', min: '1' },
  {
    id: 'bPriorityGroup',
    label: 'Priority group',
    type: 'number',
    defaultValue: '1',
    min: '1',
    step: '1',
  },
];

const BOX_TOGGLES = [
  { id: 'bAllowRotate', label: 'Allow rotate', defaultChecked: true },
  { id: 'bNoStack', label: 'No stack' },
  { id: 'bNoTilt', label: 'No tilt' },
];

export default function BoxSection() {
  return (
    <SidebarSectionCard id="boxSection" icon="➕" title="Add Item" defaultOpen>
      <div className="dimension-inputs">
        {PRIMARY_BOX_FIELDS.map((field) => (
          <FieldGroup key={field.id} id={field.id} label={field.label}>
            <input id={field.id} defaultValue={field.defaultValue} type={field.type} step={field.step} />
          </FieldGroup>
        ))}
      </div>

      <div className="dimension-inputs">
        {SECONDARY_BOX_FIELDS.map((field) => (
          <FieldGroup key={field.id} id={field.id} label={field.label}>
            <input
              id={field.id}
              defaultValue={field.defaultValue}
              type={field.type}
              min={field.min}
              step={field.step}
            />
          </FieldGroup>
        ))}
      </div>

      <div className="dimension-inputs">
        {BOX_TOGGLES.map((toggle) => (
          <label key={toggle.id} className="multi-box-checkbox" htmlFor={toggle.id}>
            <input id={toggle.id} type="checkbox" defaultChecked={toggle.defaultChecked} />
            <span>{toggle.label}</span>
          </label>
        ))}
      </div>

      <div className="dimension-inputs">
        <FieldGroup id="bDeliveryZone" label="Delivery zone">
          <select id="bDeliveryZone" defaultValue="any">
            <option value="any">Không cố định</option>
            <option value="head">Đầu container</option>
            <option value="middle">Giữa container</option>
            <option value="door">Gần cửa</option>
          </select>
        </FieldGroup>
        <FieldGroup id="bStackLimit" label="Stack limit">
          <input id="bStackLimit" defaultValue="0" type="number" min="0" step="1" />
        </FieldGroup>
        <FieldGroup id="bMaxLoadAbove" label="Max load above (kg)">
          <input id="bMaxLoadAbove" defaultValue="0" type="number" min="0" step="1" />
        </FieldGroup>
      </div>

      <div className="section-note">
        <code>Add item</code> chỉ lưu dữ liệu và hiện 1 box mẫu trong preview 3D. Có thể khai báo
        thêm zone giao hàng, stack limit và tải đè tối đa để optimizer xử lý sát thực tế hơn.
      </div>

      <div className="stacked-action-grid">
        <button id="btnSpawn" data-command="add-item" className="btn-primary full-width">
          📦 Add Item
        </button>
        <button type="button" data-command="add-and-optimize" className="btn-secondary full-width">
          ⚡ Add + Xếp tối ưu
        </button>
      </div>
    </SidebarSectionCard>
  );
}
