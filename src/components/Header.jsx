export default function Header() {
  return (
    <header>
      <div className="header-left">🚛 CONTAINER PACKING</div>
      <div className="header-center" id="stats">
        0 thùng | 0.00%
      </div>
      <div className="header-right">
        <button id="btnScreenshot" className="icon-btn" title="Chụp ảnh">
          📸
        </button>
        <button id="toggleSidebar" className="icon-btn" title="Thu gọn sidebar">
          ☰
        </button>
      </div>
    </header>
  );
}