import CommandButton from './CommandButton.jsx';
import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';
import { isFreeDeploymentMode } from '../utils/deploymentMode.js';

export default function CloudWorkspaceSection() {
  const freeModeEnabled = isFreeDeploymentMode();

  return (
    <SidebarSectionCard
      id="cloudWorkspaceSection"
      icon="☁️"
      title="Cloud Workspace"
      defaultOpen={!freeModeEnabled}
    >
      <div id="authStatus" className="status-card" data-tone="neutral" role="status" aria-live="polite">
        {freeModeEnabled
          ? 'Free mode đang bật. Cloud auth và cloud save được tắt để app chạy hoàn toàn không tốn phí.'
          : 'Cấu hình Supabase để bật đăng nhập magic link và lưu phương án lên cloud.'}
      </div>

      <FieldGroup id="authEmail" label="Email đăng nhập">
        <input
          id="authEmail"
          type="email"
          placeholder="ops@company.com"
          autoComplete="email"
          disabled={freeModeEnabled}
        />
      </FieldGroup>

      <div className="command-grid">
        <CommandButton
          command="auth-send-link"
          label="Magic link"
          hint="Đăng nhập không cần mật khẩu"
          className="btn-secondary"
          disabled={freeModeEnabled}
        />
        <CommandButton
          command="auth-sign-out"
          label="Sign out"
          hint="Khoá lại workspace"
          className="btn-icon"
          disabled={freeModeEnabled}
        />
      </div>

      <FieldGroup id="cloudPlanName" label="Tên phương án cloud">
        <input
          id="cloudPlanName"
          type="text"
          placeholder="Spring launch / phương án ưu tiên SLA"
          disabled={freeModeEnabled}
        />
      </FieldGroup>

      <FieldGroup id="cloudPlanList" label="Cloud plans">
        <select
          id="cloudPlanList"
          className="cloud-plan-list"
          size="5"
          defaultValue=""
          disabled={freeModeEnabled}
        >
          <option value="">
            {freeModeEnabled ? 'Free mode: dùng Save scene hoặc Export JSON' : 'Chưa có phương án cloud nào'}
          </option>
        </select>
      </FieldGroup>

      <div className="command-grid">
        <CommandButton
          command="cloud-refresh-plans"
          label="Refresh"
          hint="Đồng bộ danh sách cloud"
          className="btn-secondary"
          disabled={freeModeEnabled}
        />
        <CommandButton
          command="cloud-load-plan"
          label="Nạp plan"
          hint="Khôi phục scene từ cloud"
          className="btn-secondary"
          disabled={freeModeEnabled}
        />
      </div>

      <button
        type="button"
        data-command="cloud-save-plan"
        className="full-width btn-primary"
        disabled={freeModeEnabled}
      >
        Lưu snapshot lên cloud
      </button>

      <div id="cloudPlanStatus" className="status-card" data-tone="neutral" role="status" aria-live="polite">
        {freeModeEnabled
          ? 'Để dùng thực tế miễn phí, hãy lưu scene ngay trên máy, export JSON để chia sẻ và export HTML report khi cần bàn giao.'
          : 'Cloud save giúp chốt layout, quay lại phương án cũ và chia sẻ giữa các thiết bị.'}
      </div>
    </SidebarSectionCard>
  );
}
