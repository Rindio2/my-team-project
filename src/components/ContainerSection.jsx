import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const CONTAINER_FIELDS = [
  { id: 'cw', label: 'Rộng (X)', defaultValue: '235' },
  { id: 'ch', label: 'Cao (Y)', defaultValue: '239' },
  { id: 'cd', label: 'Dài (Z)', defaultValue: '590' },
];

export default function ContainerSection() {
  return (
    <SidebarSectionCard id="containerSection" icon="📦" title="Container" defaultOpen>
      <select id="contType" className="full-width" defaultValue="20dc">
        <option value="20dc">20&apos; Dry (590 × 235 × 239)</option>
        <option value="40dc">40&apos; Dry (1203 × 235 × 239)</option>
        <option value="40hc">40&apos; HC (1203 × 235 × 269)</option>
        <option value="45hc">45&apos; HC (1350 × 235 × 269)</option>
        <option value="custom">Tùy chỉnh</option>
      </select>

      <div className="dimension-inputs">
        {CONTAINER_FIELDS.map((field) => (
          <FieldGroup key={field.id} id={field.id} label={field.label}>
            <input id={field.id} defaultValue={field.defaultValue} type="number" step="1" />
          </FieldGroup>
        ))}
      </div>
    </SidebarSectionCard>
  );
}
