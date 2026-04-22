import CommandButton from './CommandButton.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const QUICK_ACTIONS = [
  {
    label: 'AI Cơ bản',
    hint: 'Xếp nhanh',
    command: 'pack-basic',
    className: 'btn-secondary',
  },
  {
    label: 'Preflight',
    hint: 'Audit SLA',
    command: 'run-preflight',
    className: 'btn-pro',
  },
  {
    label: 'AI Pro',
    hint: 'Xét ràng buộc',
    command: 'pack-pro',
    className: 'btn-pro',
  },
  {
    label: 'Tối ưu',
    hint: 'Heuristic tốt nhất',
    command: 'pack-optimize',
    className: 'btn-primary',
  },
  {
    label: 'Tính + xếp',
    hint: 'Theo sức chứa',
    command: 'capacity-calc-arrange',
    className: 'btn-secondary',
  },
  {
    label: 'Lưu scene',
    hint: 'Ctrl+S',
    command: 'save-scene',
    className: 'btn-secondary',
  },
  {
    label: 'Xuất ảnh',
    hint: 'PNG nhanh',
    command: 'screenshot',
    className: 'btn-secondary',
  },
];

export default function QuickActionsSection() {
  return (
    <SidebarSectionCard id="quickActionsSection" icon="⚡" title="Lệnh nhanh" defaultOpen>
      <div className="command-grid">
        {QUICK_ACTIONS.map((action) => (
          <CommandButton
            key={action.command}
            command={action.command}
            label={action.label}
            hint={action.hint}
            className={action.className}
          />
        ))}
      </div>

      <div className="section-note">
        Khu này gom các thao tác hay dùng nhất để bạn không cần chạy qua nhiều panel mới thao tác
        được.
      </div>
    </SidebarSectionCard>
  );
}
