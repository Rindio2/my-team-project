import CommandButton from './CommandButton.jsx';
import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

export default function CrmSection() {
  return (
    <SidebarSectionCard id="crmSection" icon="📣" title="CRM & Report Ops" defaultOpen>
      <div id="crmStatus" className="status-card" data-tone="neutral" role="status" aria-live="polite">
        Capture lead, gửi executive report qua email và lưu lại follow-up trong workflow thương mại.
      </div>

      <div className="dimension-inputs">
        <FieldGroup id="leadName" label="Lead name">
          <input id="leadName" type="text" placeholder="Nguyen Van A" autoComplete="name" />
        </FieldGroup>
        <FieldGroup id="leadEmail" label="Lead email">
          <input id="leadEmail" type="email" placeholder="buyer@company.com" autoComplete="email" />
        </FieldGroup>
      </div>

      <FieldGroup id="leadCompany" label="Company">
        <input id="leadCompany" type="text" placeholder="Pacific Retail Group" />
      </FieldGroup>

      <FieldGroup id="leadMessage" label="Nhu cầu / ghi chú">
        <textarea
          id="leadMessage"
          rows="4"
          placeholder="Nêu timeline, SKU trọng điểm, SLA kỳ vọng hoặc constraint vận hành đặc biệt."
        />
      </FieldGroup>

      <CommandButton command="crm-submit-lead" className="btn-primary" fullWidth layout="stacked">
        Lưu lead + báo team sales
      </CommandButton>

      <FieldGroup id="reportRecipientEmail" label="Gửi report tới email">
        <input
          id="reportRecipientEmail"
          type="email"
          placeholder="ops.manager@company.com"
          autoComplete="email"
        />
      </FieldGroup>

      <CommandButton command="crm-send-report" className="btn-secondary" fullWidth layout="stacked">
        Gửi executive report
      </CommandButton>

      <div className="section-note">
        Lead sẽ được bắn vào API nội bộ để lưu CRM và report email dùng chung HTML executive report
        hiện tại của app.
      </div>
    </SidebarSectionCard>
  );
}
