import CommandButton from './CommandButton.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const AI_ACTIONS = [
  {
    id: 'btnAI',
    command: 'pack-basic',
    label: 'AI Cơ bản',
    hint: 'Sinh layout nhanh để kiểm tra sơ bộ',
    className: 'btn-secondary',
  },
  {
    id: 'btnAIPro',
    command: 'pack-pro',
    label: 'AI Pro',
    hint: 'Xét xoay hướng và ràng buộc sâu hơn',
    className: 'btn-pro',
  },
  {
    id: 'btnOptimizeMulti',
    command: 'pack-optimize',
    label: 'Sắp xếp tối ưu',
    hint: 'Chọn heuristic tốt nhất cho manifest hiện tại',
    className: 'btn-primary',
  },
];

export default function AiSection() {
  return (
    <SidebarSectionCard id="aiSection" icon="🤖" title="Auto-pack" defaultOpen>
      <div className="stacked-action-grid">
        {AI_ACTIONS.map((action) => (
          <CommandButton
            key={action.command}
            id={action.id}
            command={action.command}
            label={action.label}
            hint={action.hint}
            className={action.className}
            fullWidth
          />
        ))}
      </div>

      <div className="section-note">
        <code>AI Pro</code> bung quantity, thử orientation hợp lệ và kiểm tra <code>noStack</code>,{' '}
        <code>noTilt</code>, tải sàn.
      </div>
    </SidebarSectionCard>
  );
}
