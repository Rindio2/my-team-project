import { DEFAULT_COMMERCIAL_SETTINGS } from '../utils/commercialHub.js';
import CommandButton from './CommandButton.jsx';
import FieldGroup from './FieldGroup.jsx';
import SidebarSectionCard from './SidebarSectionCard.jsx';

const COMMERCIAL_FIELDS = [
  [
    {
      id: 'commercialProjectName',
      label: 'Dự án / shipment',
      type: 'text',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.projectName,
    },
    {
      id: 'commercialCustomerName',
      label: 'Khách hàng',
      type: 'text',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.customerName,
    },
  ],
  [
    {
      id: 'commercialRouteName',
      label: 'Tuyến / lane',
      type: 'text',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.routeName,
    },
    {
      id: 'commercialServiceLevel',
      label: 'Service level',
      type: 'select',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.serviceLevel,
      options: [
        { value: 'economy', label: 'Economy' },
        { value: 'standard', label: 'Standard' },
        { value: 'priority', label: 'Priority' },
      ],
    },
  ],
  [
    {
      id: 'commercialDeclaredValue',
      label: 'Giá trị lô hàng (USD)',
      type: 'number',
      min: '0',
      step: '1000',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.declaredValue,
    },
    {
      id: 'commercialFreightCost',
      label: 'Cước container (USD)',
      type: 'number',
      min: '0',
      step: '50',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.freightCost,
    },
  ],
  [
    {
      id: 'commercialTargetUtilization',
      label: 'Target fill (%)',
      type: 'number',
      min: '40',
      max: '98',
      step: '1',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.targetUtilization,
    },
    {
      id: 'commercialTargetMaxImbalance',
      label: 'Target lệch tải (%)',
      type: 'number',
      min: '4',
      max: '35',
      step: '1',
      defaultValue: DEFAULT_COMMERCIAL_SETTINGS.targetMaxImbalance,
    },
  ],
];

export default function CommercialSection() {
  return (
    <SidebarSectionCard id="commercialSection" icon="💼" title="Commercial Control" defaultOpen>
      {COMMERCIAL_FIELDS.map((row, rowIndex) => (
        <div key={rowIndex} className="dimension-inputs">
          {row.map((field) => (
            <FieldGroup key={field.id} id={field.id} label={field.label}>
              {field.type === 'select' ? (
                <select id={field.id} defaultValue={field.defaultValue}>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.id}
                  type={field.type}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  defaultValue={field.defaultValue}
                />
              )}
            </FieldGroup>
          ))}
        </div>
      ))}

      <div className="command-grid">
        <CommandButton
          command="run-preflight"
          label="Preflight"
          hint="Audit manifest + SLA"
          className="btn-primary"
        />
        <CommandButton
          command="export-report"
          label="Exec report"
          hint="Xuất báo cáo quản trị"
          className="btn-secondary"
        />
      </div>

      <div className="section-note">
        Khu này biến layout thành workflow thương mại hơn: khai báo shipment, SLA, giá trị hàng và
        cước để hệ thống tính readiness score, value at risk và khuyến nghị vận hành.
      </div>
    </SidebarSectionCard>
  );
}
