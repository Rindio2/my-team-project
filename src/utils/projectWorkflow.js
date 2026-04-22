import { SCENARIO_PRESETS } from '../constants/scenarioPresets.js';
import {
  analyzeCommercialPlan,
  formatCurrencyUsd,
  normalizeCommercialSettings,
} from './commercialHub.js';
import {
  escapeHtml,
  formatDeliveryZone,
  formatKg,
  formatLoadLimit,
  formatPercent,
  getContainerMetrics,
  getValidSkuMetrics,
  toNumber,
} from './projectShared.js';

const PROJECT_BUNDLE_TYPE = 'packet-opt-scene-bundle';

function slugifyHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function parseBooleanLike(value, fallback = false) {
  const normalized = slugifyHeader(value);
  if (!normalized) return fallback;

  if (['1', 'true', 'yes', 'y', 'co', 'x', 'allow', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'khong', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseDelimitedLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(line) {
  const candidates = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let bestScore = -1;

  candidates.forEach((delimiter) => {
    const score = parseDelimitedLine(line, delimiter).length;
    if (score > bestScore) {
      bestDelimiter = delimiter;
      bestScore = score;
    }
  });

  return bestDelimiter;
}

function mapHeaderToField(header) {
  const normalized = slugifyHeader(header);
  const mapping = {
    label: ['label', 'name', 'item', 'ten', 'tenitem', 'sku', 'description'],
    w: ['w', 'width', 'rong', 'ngang', 'x'],
    h: ['h', 'height', 'cao', 'y'],
    d: ['d', 'length', 'depth', 'dai', 'z'],
    weight: ['weight', 'kg', 'mass', 'khoiluong', 'trongluong'],
    qty: ['qty', 'quantity', 'count', 'soluong', 'soLuong'],
    allowRotate: ['allowrotate', 'rotate', 'xoay', 'allowrotation'],
    noStack: ['nostack', 'fragile', 'khongxepchong', 'stackoff'],
    noTilt: ['notilt', 'upright', 'khongnghieng'],
    priorityGroup: ['prioritygroup', 'priority', 'group', 'deliveryorder', 'nhom'],
    stackLimit: ['stacklimit', 'maxstack', 'stackcap', 'soloptoida', 'sotangtoida'],
    maxLoadAbove: ['maxloadabove', 'loadabove', 'topload', 'kgabove', 'tailentoida'],
    deliveryZone: ['deliveryzone', 'zone', 'area', 'khuvuc', 'doorzone'],
  };

  return Object.entries(mapping).find(([, aliases]) => aliases.includes(normalized))?.[0] || null;
}

function normalizeManifestItem(item = {}, index = 0) {
  const label = item.label || item.name || item.item || item.ten || `Item ${index + 1}`;
  const noStack = parseBooleanLike(item.noStack ?? item.fragile, false);
  return {
    id: Number(item.id) || Date.now() + index,
    label,
    w: toNumber(item.w ?? item.width ?? item.rong),
    h: toNumber(item.h ?? item.height ?? item.cao),
    d: toNumber(item.d ?? item.length ?? item.depth ?? item.dai),
    weight: toNumber(item.weight ?? item.kg ?? item.mass ?? item.khoiLuong ?? item.khoiluong),
    qty: toNumber(item.qty ?? item.quantity ?? item.count ?? item.soLuong ?? item.soluong, 1),
    allowRotate:
      item.allowRotate !== undefined ? parseBooleanLike(item.allowRotate, true) : true,
    noStack,
    noTilt: parseBooleanLike(item.noTilt ?? item.upright, false),
    priorityGroup: Math.max(
      1,
      toNumber(item.priorityGroup ?? item.priority ?? item.group ?? item.deliveryOrder, 1)
    ),
    stackLimit: noStack
      ? 1
      : Math.max(0, toNumber(item.stackLimit ?? item.maxStack ?? item.stackcap)),
    maxLoadAbove: noStack
      ? 0
      : Math.max(0, toNumber(item.maxLoadAbove ?? item.loadAbove ?? item.topLoad ?? item.kgAbove)),
    deliveryZone: ['head', 'middle', 'door'].includes(item.deliveryZone)
      ? item.deliveryZone
      : ['dau', 'head'].includes(slugifyHeader(item.deliveryZone))
        ? 'head'
        : ['giua', 'middle'].includes(slugifyHeader(item.deliveryZone))
          ? 'middle'
          : ['cua', 'door'].includes(slugifyHeader(item.deliveryZone))
            ? 'door'
            : 'any',
  };
}

function parseManifestJson(raw) {
  const parsed = JSON.parse(raw);
  const collection = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;

  if (!collection) {
    throw new Error('JSON manifest cần là một mảng item hoặc object có trường "items".');
  }

  return collection.map((item, index) => normalizeManifestItem(item, index));
}

function parseManifestCsv(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('Manifest CSV cần có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter).map(mapHeaderToField);

  if (!headers.some(Boolean)) {
    throw new Error(
      'Không nhận ra cột manifest. Hãy dùng các cột như label,w,h,d,weight,qty,allowRotate,noStack,noTilt,priorityGroup,deliveryZone,stackLimit,maxLoadAbove.'
    );
  }

  return lines.slice(1).map((line, index) => {
    const values = parseDelimitedLine(line, delimiter);
    const record = {};

    headers.forEach((field, fieldIndex) => {
      if (!field) return;
      record[field] = values[fieldIndex] ?? '';
    });

    return normalizeManifestItem(record, index);
  });
}

function buildReportItemRows(items = []) {
  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${toNumber(item.qty)}</td>
          <td>${toNumber(item.d)} × ${toNumber(item.w)} × ${toNumber(item.h)}</td>
          <td>${formatKg(item.weight)}</td>
          <td>${item.allowRotate ? 'Có' : 'Không'}</td>
          <td>${item.noStack ? 'Có' : 'Không'}</td>
          <td>${item.noTilt ? 'Có' : 'Không'}</td>
          <td>${Math.max(1, toNumber(item.priorityGroup, 1))}</td>
          <td>${escapeHtml(formatDeliveryZone(item.deliveryZone))}</td>
          <td>${toNumber(item.stackLimit) > 0 ? toNumber(item.stackLimit) : 'Mở'}</td>
          <td>${toNumber(item.maxLoadAbove) > 0 ? formatKg(item.maxLoadAbove) : 'Mở'}</td>
        </tr>
      `
    )
    .join('');
}

function buildRejectedRows(items = []) {
  if (!items?.length) {
    return '<tr><td colspan="3">Không có item bị loại trong nhóm này.</td></tr>';
  }

  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.count}</td>
          <td>${escapeHtml(item.reason || '-')}</td>
        </tr>
      `
    )
    .join('');
}

export function buildPresetSceneState(presetId, currentScene = {}) {
  const preset = SCENARIO_PRESETS.find((item) => item.id === presetId) || SCENARIO_PRESETS[0];
  const container = getContainerMetrics(preset.containerType);
  const referenceItem = preset.items[0];

  return {
    version: 6,
    selectedBoxId: null,
    contType: preset.containerType,
    container: {
      w: container.w,
      h: container.h,
      d: container.d,
    },
    opacity: currentScene.opacity ?? 0.18,
    multiBoxTypes: preset.items.map((item) => ({ ...item })),
    capacityInputs: {
      containerLength: container.d,
      containerWidth: container.w,
      containerHeight: container.h,
      containerMaxWeight: container.maxLoad,
      boxLength: referenceItem?.d || 0,
      boxWidth: referenceItem?.w || 0,
      boxHeight: referenceItem?.h || 0,
      boxWeight: referenceItem?.weight || 0,
    },
    shockMode: 'basic',
    shockNet: false,
    transformMode: 'translate',
    viewerSettings: {
      autoHideWalls: true,
      wallOcclusionMode: 'hide',
      cutawayMode: 'off',
    },
    packingSettings: {
      floorLoadLimit: preset.floorLoadLimit || 0,
    },
    commercialSettings: normalizeCommercialSettings(
      preset.commercialSettings || currentScene.commercialSettings
    ),
    boxes: [],
  };
}

export function buildSceneBundle(scene) {
  return {
    type: PROJECT_BUNDLE_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    scene,
  };
}

export function unwrapImportedSceneState(payload) {
  if (payload?.type === PROJECT_BUNDLE_TYPE && payload.scene) {
    return payload.scene;
  }

  if (payload?.container && Array.isArray(payload?.boxes)) {
    return payload;
  }

  throw new Error('File JSON không đúng định dạng scene của Packet Opt.');
}

export function parseManifestText(raw) {
  const source = String(raw ?? '').trim();

  if (!source) {
    throw new Error('Manifest đang trống. Hãy dán CSV hoặc JSON rồi thử lại.');
  }

  if (source.startsWith('[') || source.startsWith('{')) {
    return parseManifestJson(source);
  }

  return parseManifestCsv(source);
}

export function buildOperationalReportHtml({
  contType,
  container,
  multiBoxTypes,
  boxes,
  result,
  maxWeight,
  floorLoadLimit,
  lastAction,
  commercialSettings,
}) {
  const containerMetrics = getContainerMetrics(contType, container);
  const { validItems, validSkuCount, totalUnits, totalRequestedWeight } =
    getValidSkuMetrics(multiBoxTypes);
  const packedCount =
    result?.packedCount ?? boxes.filter((box) => box?.userData?.sceneRole !== 'preview').length;
  const remaining = result?.remaining ?? Math.max(totalUnits - packedCount, 0);
  const efficiency = result?.efficiency ?? 0;
  const exportedAt = new Date().toLocaleString('vi-VN');
  const commercial = analyzeCommercialPlan({
    items: validItems,
    result,
    container,
    maxWeight,
    floorLoadLimit,
    settings: commercialSettings,
  });
  const strategiesHtml =
    Array.isArray(result?.evaluatedStrategies) && result.evaluatedStrategies.length > 0
      ? result.evaluatedStrategies
          .map(
            (strategy) => `
              <tr>
                <td>${escapeHtml(strategy.label)}</td>
                <td>${strategy.packedCount}</td>
                <td>${formatPercent(strategy.efficiency)}</td>
                <td>${formatPercent(strategy.sideImbalancePercent)}</td>
                <td>${formatPercent(strategy.lengthImbalancePercent)}</td>
                <td>${strategy.rejectedByConstraintCount}</td>
              </tr>
            `
          )
          .join('')
      : '<tr><td colspan="6">Không có dữ liệu so sánh chiến lược.</td></tr>';

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Packet Opt Control Tower Report</title>
        <style>
          :root {
            color-scheme: light;
            --ink: #0f172a;
            --muted: #475569;
            --line: #d9e2ec;
            --panel: #f8fafc;
            --accent: #0f766e;
            --accent-soft: #ecfeff;
            --warn: #b45309;
            --warn-soft: #fffbeb;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 32px;
            color: var(--ink);
            background: #eef4f8;
            font-family: "Segoe UI", Tahoma, sans-serif;
          }
          .report-shell {
            max-width: 1100px;
            margin: 0 auto;
            background: white;
            border-radius: 24px;
            padding: 28px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
          }
          .hero {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--line);
          }
          .hero h1 {
            margin: 6px 0 8px;
            font-size: 1.8rem;
          }
          .kicker {
            font-size: 0.82rem;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--muted);
          }
          .subtitle {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
          }
          .chip-wrap {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 14px;
          }
          .chip {
            padding: 8px 12px;
            border-radius: 999px;
            background: var(--accent-soft);
            color: var(--accent);
            font-weight: 700;
            font-size: 0.9rem;
          }
          .section {
            margin-top: 24px;
          }
          .section h2 {
            margin: 0 0 12px;
            font-size: 1.05rem;
          }
          .metric-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
          }
          .metric-card {
            padding: 14px;
            border-radius: 18px;
            background: var(--panel);
            border: 1px solid var(--line);
          }
          .metric-card span {
            display: block;
            color: var(--muted);
            font-size: 0.82rem;
            margin-bottom: 6px;
          }
          .metric-card strong {
            font-size: 1.15rem;
          }
          .note {
            padding: 14px 16px;
            border-radius: 18px;
            background: var(--accent-soft);
            border: 1px solid #c6f3f4;
            color: #155e75;
            line-height: 1.65;
          }
          .warning {
            background: var(--warn-soft);
            border-color: #fde68a;
            color: var(--warn);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid var(--line);
          }
          th, td {
            padding: 12px 10px;
            border-bottom: 1px solid var(--line);
            text-align: left;
            vertical-align: top;
            font-size: 0.92rem;
          }
          th {
            background: #f8fafc;
            color: var(--muted);
            font-weight: 700;
          }
          tr:last-child td {
            border-bottom: none;
          }
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .report-shell {
              box-shadow: none;
              border-radius: 0;
            }
          }
          @media (max-width: 860px) {
            body { padding: 14px; }
            .hero { flex-direction: column; }
            .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
        </style>
      </head>
      <body>
        <main class="report-shell">
          <section class="hero">
            <div>
              <div class="kicker">Packet Opt Control Tower</div>
              <h1>Biên bản phương án xếp hàng thương mại</h1>
              <p class="subtitle">
                Báo cáo được xuất lúc ${escapeHtml(exportedAt)}. ${escapeHtml(
                  lastAction || 'Đây là snapshot mới nhất của phương án hiện tại.'
                )}
              </p>
              <div class="chip-wrap">
                <span class="chip">${escapeHtml(containerMetrics.label)}</span>
                <span class="chip">${validSkuCount} SKU</span>
                <span class="chip">${totalUnits} units</span>
              </div>
            </div>
            <div>
              <div class="kicker">Container</div>
              <h1>${containerMetrics.d} × ${containerMetrics.w} × ${containerMetrics.h} cm</h1>
              <p class="subtitle">
                Giới hạn tải: ${escapeHtml(
                  Number.isFinite(maxWeight) ? formatKg(maxWeight) : 'Không giới hạn'
                )}<br/>
                Tải sàn: ${escapeHtml(formatLoadLimit(result?.floorLoadLimit ?? floorLoadLimit))}
              </p>
            </div>
          </section>

          <section class="section">
            <h2>KPI phương án</h2>
            <div class="metric-grid">
              <div class="metric-card"><span>Khối lượng yêu cầu</span><strong>${formatKg(totalRequestedWeight)}</strong></div>
              <div class="metric-card"><span>Đã xếp</span><strong>${packedCount}</strong></div>
              <div class="metric-card"><span>Chưa xếp</span><strong>${remaining}</strong></div>
              <div class="metric-card"><span>Hiệu suất thể tích</span><strong>${formatPercent(efficiency)}</strong></div>
            </div>
          </section>

          <section class="section">
            <h2>Executive snapshot</h2>
            <div class="metric-grid">
              <div class="metric-card"><span>Readiness score</span><strong>${commercial.score.toFixed(0)}/100 • ${escapeHtml(commercial.grade)}</strong></div>
              <div class="metric-card"><span>Service level</span><strong>${escapeHtml(commercial.serviceLabel)}</strong></div>
              <div class="metric-card"><span>Value at risk</span><strong>${escapeHtml(formatCurrencyUsd(commercial.finance.cargoValueAtRisk))}</strong></div>
              <div class="metric-card"><span>Unused freight</span><strong>${escapeHtml(formatCurrencyUsd(commercial.finance.unusedFreightCost))}</strong></div>
            </div>
          </section>

          <section class="section">
            <h2>Nhận định nhanh</h2>
            <div class="note ${result?.balanceWarnings?.length ? 'warning' : ''}">
              ${
                result
                  ? `
                    Chiến lược được chọn: <b>${escapeHtml(result.strategyLabel || 'Không xác định')}</b>.<br/>
                    Cân bằng trái/phải: <b>${formatPercent(
                      result.loadBalance?.sideImbalancePercent
                    )}</b> • Cân bằng đầu/cửa: <b>${formatPercent(
                      result.loadBalance?.lengthImbalancePercent
                    )}</b>.<br/>
                    Cảnh báo tải: <b>${result.balanceWarnings?.length || 0}</b>.<br/>
                    ${escapeHtml(commercial.headline)}
                  `
                  : `
                    Chưa có kết quả tối ưu cuối cùng trong snapshot này. ${escapeHtml(
                      commercial.headline
                    )}
                  `
              }
            </div>
          </section>

          <section class="section">
            <h2>Hồ sơ shipment</h2>
            <div class="metric-grid">
              <div class="metric-card"><span>Dự án</span><strong>${escapeHtml(commercial.settings.projectName)}</strong></div>
              <div class="metric-card"><span>Khách hàng</span><strong>${escapeHtml(commercial.settings.customerName)}</strong></div>
              <div class="metric-card"><span>Tuyến</span><strong>${escapeHtml(commercial.settings.routeName)}</strong></div>
              <div class="metric-card"><span>SLA</span><strong>${escapeHtml(commercial.slaStatus)}</strong></div>
            </div>
            <div class="note" style="margin-top:12px;">
              Giá trị lô hàng khai báo: <b>${escapeHtml(formatCurrencyUsd(commercial.finance.declaredValue))}</b> •
              Cước container: <b>${escapeHtml(formatCurrencyUsd(commercial.finance.freightCost))}</b> •
              Target fill: <b>${formatPercent(commercial.targets.utilization)}</b> •
              Target lệch tải: <b>${formatPercent(commercial.targets.maxImbalance)}</b><br/>
              Khuyến nghị ưu tiên: ${escapeHtml(commercial.recommendations[0] || 'Không có khuyến nghị thêm.')}
            </div>
          </section>

          <section class="section">
            <h2>Manifest đầu vào</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Kích thước (D × W × H)</th>
                  <th>Kg / box</th>
                  <th>Xoay</th>
                  <th>No stack</th>
                  <th>No tilt</th>
                  <th>Priority</th>
                  <th>Zone</th>
                  <th>Stack limit</th>
                  <th>Max load above</th>
                </tr>
              </thead>
              <tbody>${buildReportItemRows(validItems)}</tbody>
            </table>
          </section>

          <section class="section">
            <h2>So sánh chiến lược heuristic</h2>
            <table>
              <thead>
                <tr>
                  <th>Chiến lược</th>
                  <th>Đã xếp</th>
                  <th>Hiệu suất</th>
                  <th>Lệch ngang</th>
                  <th>Lệch dọc</th>
                  <th>Constraint reject</th>
                </tr>
              </thead>
              <tbody>${strategiesHtml}</tbody>
            </table>
          </section>

          <section class="section">
            <h2>Item bị loại do ràng buộc hoặc tải</h2>
            <table>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Số lượng</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>${buildRejectedRows(result?.rejectedByConstraintSummary || [])}</tbody>
            </table>
          </section>

          <section class="section">
            <h2>Item bị loại do khối lượng</h2>
            <table>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Số lượng</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>${buildRejectedRows(result?.rejectedByWeightSummary || [])}</tbody>
            </table>
          </section>

          <section class="section">
            <h2>Item bị loại do không gian</h2>
            <table>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Số lượng</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>${buildRejectedRows(result?.rejectedBySpaceSummary || [])}</tbody>
            </table>
          </section>
        </main>
      </body>
    </html>
  `;
}
