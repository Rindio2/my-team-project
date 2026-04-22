import CommandButton from './CommandButton.jsx';
import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';
import { isFreeDeploymentMode } from '../utils/deploymentMode.js';

export default function CrmSection() {
  const freeModeEnabled = isFreeDeploymentMode();

  return (
    <SidebarSectionCard
      id="crmSection"
      icon="📣"
      title="CRM & Report Ops"
      defaultOpen={!freeModeEnabled}
    >
      <div id="crmStatus" className="status-card" data-tone="neutral" role="status" aria-live="polite">
        {freeModeEnabled
          ? 'Free mode đang bật. CRM nội bộ và email tự động được tắt để app không phát sinh chi phí dịch vụ.'
          : 'Capture lead, gửi executive report qua email và lưu lại follow-up trong workflow thương mại.'}
      </div>

      <div className="dimension-inputs">
        <FieldGroup id="leadName" label="Lead name">
          <input
            id="leadName"
            type="text"
            placeholder="Nguyen Van A"
            autoComplete="name"
            disabled={freeModeEnabled}
          />
        </FieldGroup>
        <FieldGroup id="leadEmail" label="Lead email">
          <input
            id="leadEmail"
            type="email"
            placeholder="buyer@company.com"
            autoComplete="email"
            disabled={freeModeEnabled}
          />
        </FieldGroup>
      </div>

      <FieldGroup id="leadCompany" label="Company">
        <input
          id="leadCompany"
          type="text"
          placeholder="Pacific Retail Group"
          disabled={freeModeEnabled}
        />
      </FieldGroup>

      <FieldGroup id="leadMessage" label="Nhu cầu / ghi chú">
        <textarea
          id="leadMessage"
          rows="4"
          placeholder="Nêu timeline, SKU trọng điểm, SLA kỳ vọng hoặc constraint vận hành đặc biệt."
          disabled={freeModeEnabled}
        />
      </FieldGroup>

      <CommandButton
        command="crm-submit-lead"
        className="btn-primary"
        fullWidth
        layout="stacked"
        disabled={freeModeEnabled}
      >
        Lưu lead + báo team sales
      </CommandButton>

      <FieldGroup id="reportRecipientEmail" label="Gửi report tới email">
        <input
          id="reportRecipientEmail"
          type="email"
          placeholder="ops.manager@company.com"
          autoComplete="email"
          disabled={freeModeEnabled}
        />
      </FieldGroup>

      <CommandButton
        command="crm-send-report"
        className="btn-secondary"
        fullWidth
        layout="stacked"
        disabled={freeModeEnabled}
      >
        Gửi executive report
      </CommandButton>

      <div className="section-note">
        {freeModeEnabled
          ? 'Trong cuộc thi, dùng Export HTML để bàn giao report và ghi lead thủ công nếu cần. Luồng tối ưu layout và preflight vẫn dùng được đầy đủ.'
          : 'Lead sẽ được bắn vào API nội bộ để lưu CRM và report email dùng chung HTML executive report hiện tại của app.'}
      </div>
    </SidebarSectionCard>
  );
}
