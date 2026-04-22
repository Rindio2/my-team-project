import SidebarSectionCard from './SidebarSectionCard.jsx';

const TOOL_BUTTON_ROWS = [
  [
    { id: 'btnUndo', command: 'undo', label: '↩️', title: 'Undo (Ctrl+Z)', className: 'btn-icon' },
    { id: 'btnRedo', command: 'redo', label: '↪️', title: 'Redo (Ctrl+Y)', className: 'btn-icon' },
    {
      id: 'btnClear',
      command: 'clear-scene',
      label: '🗑️',
      title: 'Xóa tất cả',
      className: 'btn-icon danger',
    },
    {
      id: 'btnRandom20',
      command: 'random-fill',
      label: '🎲',
      title: 'Sinh 20 thùng ngẫu nhiên',
      className: 'btn-icon warning',
    },
  ],
  [
    { id: 'btnSave', command: 'save-scene', label: '💾', title: 'Lưu trạng thái (Ctrl+S)', className: 'btn-icon' },
    { id: 'btnLoad', command: 'load-scene', label: '📂', title: 'Tải trạng thái đã lưu', className: 'btn-icon' },
    { id: 'btnResetView', command: 'reset-view', label: '🖼️', title: 'Reset camera', className: 'btn-icon' },
  ],
];

const VIEW_PRESETS = [
  { id: 'btnViewHead', command: 'view-head', label: 'Đầu' },
  { id: 'btnViewDoor', command: 'view-door', label: 'Cửa' },
  { id: 'btnViewLeft', command: 'view-left', label: 'Trái' },
  { id: 'btnViewRight', command: 'view-right', label: 'Phải' },
  { id: 'btnViewTop', command: 'view-top', label: 'Nóc' },
];

export default function ToolsSection() {
  return (
    <SidebarSectionCard id="toolsSection" icon="🛠️" title="Công cụ 3D">
      {TOOL_BUTTON_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="button-row">
          {row.map((button) => (
            <button
              key={button.id}
              id={button.id}
              data-command={button.command}
              className={button.className}
              title={button.title}
            >
              {button.label}
            </button>
          ))}
        </div>
      ))}

      <div className="viewer-presets-grid">
        {VIEW_PRESETS.map((preset) => (
          <button
            key={preset.id}
            id={preset.id}
            data-command={preset.command}
            className="btn-secondary viewer-preset-btn"
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="slider-container">
        <span>🔆 Độ mờ</span>
        <input
          type="range"
          id="opacitySlider"
          min="0.1"
          max="0.9"
          step="0.01"
          defaultValue="0.18"
        />
      </div>

      <label className="viewer-toggle">
        <input id="autoHideWalls" type="checkbox" defaultChecked />
        <span>Tự ẩn vách gần camera để nhìn vào bên trong</span>
      </label>

      <div className="viewer-control-grid">
        <div className="input-group">
          <label>Ẩn vách gần camera</label>
          <select id="wallOcclusionMode" defaultValue="hide">
            <option value="hide">Ẩn hẳn vách gần nhất</option>
            <option value="fade">Làm mờ vách gần nhất</option>
          </select>
        </div>
        <div className="input-group">
          <label>Cutaway / Clipping</label>
          <select id="cutawayMode" defaultValue="off">
            <option value="off">Tắt</option>
            <option value="auto">Cắt nửa theo góc camera</option>
            <option value="door">Cắt nửa phía cửa</option>
            <option value="head">Cắt nửa phía đầu</option>
            <option value="left">Cắt nửa vách trái</option>
            <option value="right">Cắt nửa vách phải</option>
            <option value="top">Cắt nửa phía nóc</option>
          </select>
        </div>
      </div>

      <div className="viewer-hint">
        Clipping giúp cắt nửa container để nhìn nhanh vào trong.
      </div>

      <div id="viewerStatus" className="viewer-status-card">
        Kéo chuột trái để xoay orbit, chuột phải để pan, con lăn để zoom. Chế độ nhìn hiện tại sẽ
        được cập nhật tại đây khi bạn thao tác trong scene.
      </div>
    </SidebarSectionCard>
  );
}
