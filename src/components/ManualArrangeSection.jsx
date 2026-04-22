import CommandButton from './CommandButton.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const MANUAL_MODES = [
  {
    id: 'btnModeMove',
    command: 'manual-translate',
    className: 'btn-secondary manual-mode-btn',
    label: '1. Di chuyển',
  },
  {
    id: 'btnModeRotate',
    command: 'manual-rotate',
    className: 'btn-pro manual-mode-btn',
    label: '2. Lật',
  },
];

const MANUAL_QUICK_ACTIONS = [
  {
    command: 'select-focus',
    className: 'btn-secondary compact-command-btn',
    label: '🎯 Focus box',
  },
  {
    command: 'select-cycle-orientation',
    className: 'btn-pro compact-command-btn',
    label: '🔄 Lật tiếp',
  },
  {
    command: 'select-remove',
    className: 'btn-icon danger compact-command-btn',
    label: '🗑️ Xóa box',
  },
];

export default function ManualArrangeSection() {
  return (
    <SidebarSectionCard id="manualArrangePanel" icon="🧩" title="Chỉnh tay">
      <div id="manualArrangeStatus" className="manual-arrange-status">
        Click vào thùng trong scene để bắt đầu chỉnh tay.
      </div>

      <div id="manualArrangeControls" className="manual-arrange-controls">
        <div className="manual-mode-grid">
          {MANUAL_MODES.map((mode) => (
            <CommandButton
              key={mode.command}
              id={mode.id}
              command={mode.command}
              className={mode.className}
              layout="stacked"
            >
              {mode.label}
            </CommandButton>
          ))}
        </div>

        <div className="section-note">
          Chọn <b>Di chuyển</b> để kéo box trực tiếp trong scene. Khi muốn đổi hướng, bấm <b>Lật</b>{' '}
          rồi click vào box để xoay nhanh hoặc chọn một preset bên dưới.
        </div>

        <div className="manual-quick-grid">
          {MANUAL_QUICK_ACTIONS.map((action) => (
            <CommandButton
              key={action.command}
              command={action.command}
              className={action.className}
              layout="stacked"
            >
              {action.label}
            </CommandButton>
          ))}
        </div>

        <div id="manualRotationPanel" className="manual-rotation-panel">
          <div className="manual-rotation-title">Lật 6 mặt</div>
          <div className="manual-rotation-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <button
                key={index}
                type="button"
                className="manual-rotation-btn"
                data-orientation-index={index}
              >
                Hướng {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SidebarSectionCard>
  );
}
