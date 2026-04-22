export default function Header({ userName = '', onLogout = null }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-mark">🚛</div>
        <div className="brand-copy">
          <span className="brand-kicker">Commercial Load Planning Suite</span>
          <span className="brand-title">Packet Opt Control Tower</span>
        </div>
      </div>
      <div className="header-center" id="stats" role="status" aria-live="polite">
        0 thùng | 0.00%
      </div>
      <div className="header-right">
        {onLogout ? (
          <button
            type="button"
            className="header-user-pill"
            title={`Đăng xuất ${userName || 'người dùng'}`}
            onClick={onLogout}
          >
            <span>{userName || 'operator'}</span>
            <span>Đăng xuất</span>
          </button>
        ) : null}
        <button
          id="btnScreenshot"
          data-command="screenshot"
          className="icon-btn"
          title="Chụp ảnh"
          aria-label="Chụp ảnh scene hiện tại"
        >
          📸
        </button>
        <button
          id="toggleSidebar"
          data-command="toggle-sidebar"
          className="icon-btn"
          title="Thu gọn sidebar"
          aria-label="Thu gọn hoặc mở rộng sidebar"
        >
          ☰
        </button>
      </div>
    </header>
  );
}
