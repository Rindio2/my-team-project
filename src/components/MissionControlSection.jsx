import { SCENARIO_PRESETS } from '../constants/scenarioPresets.js';
import CommandButton from './CommandButton.jsx';
import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const WORKFLOW_COMMANDS = [
  {
    label: 'Nạp preset',
    hint: 'Dựng nhanh dữ liệu mẫu',
    command: 'apply-preset',
    className: 'btn-primary',
  },
  {
    label: 'Xuất JSON',
    hint: 'Chia sẻ phương án',
    command: 'export-plan',
    className: 'btn-secondary',
  },
  {
    label: 'Nhập JSON',
    hint: 'Khôi phục phương án',
    command: 'import-plan',
    className: 'btn-pro',
  },
];

const MANIFEST_COMMANDS = [
  {
    label: 'Áp manifest',
    hint: 'Đọc dữ liệu từ ô dán',
    command: 'import-manifest-text',
    className: 'btn-primary',
  },
  {
    label: 'Tải manifest',
    hint: 'CSV hoặc JSON',
    command: 'import-manifest-file',
    className: 'btn-secondary',
  },
  {
    label: 'Xuất report',
    hint: 'HTML bàn giao',
    command: 'export-report',
    className: 'btn-pro',
  },
];

export default function MissionControlSection() {
  return (
    <SidebarSectionCard id="missionControlSection" icon="🧭" title="MVP Hub" defaultOpen>
      <FieldGroup id="projectPreset" label="Kịch bản demo">
        <select id="projectPreset" defaultValue={SCENARIO_PRESETS[0].id}>
          {SCENARIO_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </FieldGroup>

      <div id="projectPresetHint" className="project-preset-hint">
        {SCENARIO_PRESETS[0].description}
      </div>

      <div className="command-grid mission-hub-actions">
        {WORKFLOW_COMMANDS.map((action) => (
          <CommandButton
            key={action.command}
            command={action.command}
            label={action.label}
            hint={action.hint}
            className={action.className}
          />
        ))}
      </div>

      <input id="planImportInput" type="file" accept="application/json,.json" hidden />

      <div className="manifest-import-card">
        <FieldGroup id="manifestPasteInput" label="Dán manifest CSV / JSON">
          <textarea
            id="manifestPasteInput"
            className="manifest-paste-input"
            rows={6}
            placeholder={`label,w,h,d,weight,qty,allowRotate,noStack,noTilt,priorityGroup,deliveryZone,stackLimit,maxLoadAbove
TV 43 inch,68,14,108,15,36,true,true,true,3,door,1,0
Soundbar,18,16,105,8,28,true,false,true,2,middle,2,24`}
          />
        </FieldGroup>

        <div className="command-grid mission-hub-actions">
          {MANIFEST_COMMANDS.map((action) => (
            <CommandButton
              key={action.command}
              command={action.command}
              label={action.label}
              hint={action.hint}
              className={action.className}
            />
          ))}
        </div>

        <input
          id="manifestImportInput"
          type="file"
          accept=".csv,.txt,.json,text/csv,application/json"
          hidden
        />
      </div>

      <div className="section-note">
        Khu này biến app thành workflow MVP thật hơn: chọn dữ liệu mẫu, chạy pack, rồi xuất hoặc nhập
        lại phương án để review nhanh. Manifest hỗ trợ thêm `deliveryZone`, `stackLimit`,
        `maxLoadAbove` để mô tả ràng buộc thương mại sát thực tế hơn.
      </div>
    </SidebarSectionCard>
  );
}
