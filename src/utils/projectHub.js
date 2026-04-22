import {
  analyzeCommercialPlan,
  formatCurrencyUsd,
  getServiceLevelLabel,
} from './commercialHub.js';
import {
  escapeHtml,
  formatKg,
  formatLoadLimit,
  formatPercent,
  getContainerMetrics,
  getValidSkuMetrics,
  toNumber,
} from './projectShared.js';

function resolveModeLabel(mode) {
  const map = {
    preview: 'Preview dữ liệu',
    preflight: 'Đã chạy preflight',
    processing: 'Engine đang chạy',
    preset: 'Preset đã sẵn sàng',
    manifest: 'Manifest đã sẵn sàng',
    basicPack: 'AI cơ bản vừa chạy',
    optimized: 'Layout tối ưu mới nhất',
    capacity: 'Đã tính sức chứa',
    capacityArrange: 'Đã xếp theo sức chứa',
    shock: 'Đang review chống sốc',
    editing: 'Đang tinh chỉnh layout',
    saved: 'Đã lưu nội bộ',
    loaded: 'Đã khôi phục',
    exported: 'Đã xuất file',
    imported: 'Đã nhập file',
    report: 'Đã xuất báo cáo',
    attention: 'Cần kiểm tra',
  };

  return map[mode] || 'Sẵn sàng vận hành';
}

function resolveNextStep(mode, validSkuCount, result) {
  if (validSkuCount === 0) {
    return 'Nạp preset hoặc thêm item để dựng phương án đầu tiên.';
  }

  if (mode === 'capacity') {
    return 'Nếu số liệu ổn, bấm Tính + xếp hoặc Xếp tối đa để dựng layout 3D.';
  }

  if (mode === 'exported') {
    return 'Bạn có thể gửi file JSON này cho đội vận hành để mở lại đúng phương án.';
  }

  if (mode === 'report') {
    return 'Báo cáo HTML đã sẵn sàng để gửi cho khách hàng hoặc đội vận hành.';
  }

  if (mode === 'imported' || mode === 'preset' || mode === 'preview' || mode === 'manifest') {
    return 'Bước tiếp theo hợp lý là chạy AI Pro hoặc Sắp xếp tối ưu để tạo placement thật.';
  }

  if (result?.remaining > 0) {
    return 'Còn hàng chưa xếp hết. Hãy thử đổi container, giảm số lượng hoặc nới ràng buộc.';
  }

  return 'Layout đang ổn. Bạn có thể chỉnh tay, lưu scene hoặc xuất JSON để chốt phương án.';
}

function resolveHealthState({ totalRequestedWeight, maxLoad, result }) {
  if (result?.strictOverlapDetected) {
    return { label: 'Cần sửa', className: 'warning' };
  }

  if (
    (Number.isFinite(maxLoad) && maxLoad > 0 && totalRequestedWeight > maxLoad) ||
    (result && (result.remaining > 0 || result.balanceWarnings?.length > 0))
  ) {
    return { label: 'Cảnh báo', className: 'warning' };
  }

  if (result?.packedCount > 0 || totalRequestedWeight > 0) {
    return { label: 'Khả dụng', className: 'positive' };
  }

  return { label: 'Chờ dữ liệu', className: 'neutral' };
}

function formatTimestamp(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return 'vừa xong';
  return value.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildOperationsSummaryHtml({
  contType,
  container,
  multiBoxTypes,
  boxes,
  result,
  mode,
  lastAction,
  lastUpdatedAt,
  maxWeight,
  floorLoadLimit,
  commercialSettings,
}) {
  const containerMetrics = getContainerMetrics(contType, container);
  const { validItems, validSkuCount, totalUnits, totalRequestedWeight } = getValidSkuMetrics(
    multiBoxTypes
  );
  const placementBoxes = boxes.filter((box) => box?.userData?.sceneRole !== 'preview');
  const previewBoxes = boxes.filter((box) => box?.userData?.sceneRole === 'preview');
  const healthState = resolveHealthState({
    totalRequestedWeight,
    maxLoad: maxWeight,
    result,
  });
  const usedEfficiency =
    result?.efficiency ??
    (containerMetrics.w * containerMetrics.h * containerMetrics.d > 0
      ? (placementBoxes.reduce((sum, box) => {
          const size = box?.userData?.size;
          return sum + toNumber(size?.w) * toNumber(size?.h) * toNumber(size?.d);
        }, 0) /
          (containerMetrics.w * containerMetrics.h * containerMetrics.d)) *
        100
      : 0);
  const packedCount = result?.packedCount ?? placementBoxes.length;
  const rejectedCount = result?.remaining ?? Math.max(totalUnits - packedCount, 0);
  const sideImbalance = result?.loadBalance?.sideImbalancePercent;
  const lengthImbalance = result?.loadBalance?.lengthImbalancePercent;
  const weightUsagePercent =
    Number.isFinite(maxWeight) && maxWeight > 0
      ? ((result?.totalPlacedWeight ?? totalRequestedWeight) / maxWeight) * 100
      : null;
  const modeLabel = resolveModeLabel(mode);
  const nextStep = resolveNextStep(mode, validSkuCount, result);
  const commercial = analyzeCommercialPlan({
    items: validItems,
    result,
    container,
    maxWeight,
    floorLoadLimit,
    settings: commercialSettings,
  });

  return `
    <div class="operations-summary-shell">
      <div class="operations-summary-head">
        <div>
          <div class="operations-summary-kicker">Live snapshot • ${formatTimestamp(lastUpdatedAt)}</div>
          <div class="operations-summary-title">${modeLabel}</div>
        </div>
        <span class="operations-health-badge ${healthState.className}">${healthState.label}</span>
      </div>

      <div class="operations-summary-note">${lastAction || 'Sẵn sàng dựng phương án mới.'}</div>

      <div class="operations-chip-row">
        <span class="operations-chip">${containerMetrics.label}</span>
        <span class="operations-chip">${validSkuCount} SKU hợp lệ</span>
        <span class="operations-chip">${totalUnits} units</span>
      </div>

      <div class="operations-metric-grid">
        <div class="operations-metric-card">
          <span>Container</span>
          <strong>${containerMetrics.d} × ${containerMetrics.w} × ${containerMetrics.h} cm</strong>
        </div>
        <div class="operations-metric-card">
          <span>Khối lượng yêu cầu</span>
          <strong>${formatKg(totalRequestedWeight)}</strong>
        </div>
        <div class="operations-metric-card">
          <span>Giới hạn tải</span>
          <strong>${Number.isFinite(maxWeight) ? formatKg(maxWeight) : 'Không giới hạn'}</strong>
        </div>
        <div class="operations-metric-card">
          <span>Tải sàn</span>
          <strong>${formatLoadLimit(result?.floorLoadLimit ?? floorLoadLimit)}</strong>
        </div>
      </div>

      <div class="operations-subpanel">
        <div class="operations-subpanel-title">KPI vận hành</div>
        <div class="operations-mini-grid">
          <div>
            <span>Đang hiển thị</span>
            <strong>${boxes.length}</strong>
          </div>
          <div>
            <span>Preview boxes</span>
            <strong>${previewBoxes.length}</strong>
          </div>
          <div>
            <span>Đã xếp</span>
            <strong>${packedCount}</strong>
          </div>
          <div>
            <span>Chưa xếp</span>
            <strong>${rejectedCount}</strong>
          </div>
          <div>
            <span>Hiệu suất</span>
            <strong>${formatPercent(usedEfficiency)}</strong>
          </div>
          <div>
            <span>Tỷ lệ tải</span>
            <strong>${weightUsagePercent !== null ? formatPercent(weightUsagePercent) : 'N/A'}</strong>
          </div>
        </div>
      </div>

      <div class="operations-subpanel">
        <div class="operations-subpanel-title">Tín hiệu layout</div>
        <div class="operations-mini-grid">
          <div>
            <span>Chiến lược</span>
            <strong>${result?.strategyLabel || 'Chưa chạy tối ưu'}</strong>
          </div>
          <div>
            <span>Cân bằng ngang</span>
            <strong>${sideImbalance !== undefined ? formatPercent(sideImbalance) : 'Chưa có'}</strong>
          </div>
          <div>
            <span>Cân bằng dọc</span>
            <strong>${lengthImbalance !== undefined ? formatPercent(lengthImbalance) : 'Chưa có'}</strong>
          </div>
          <div>
            <span>Cảnh báo tải</span>
            <strong>${result?.balanceWarnings?.length || 0}</strong>
          </div>
          <div>
            <span>Loại do tải trọng</span>
            <strong>${result?.rejectedByWeightCount ?? 0}</strong>
          </div>
          <div>
            <span>Loại do ràng buộc</span>
            <strong>${result?.rejectedByConstraintCount ?? 0}</strong>
          </div>
        </div>
      </div>

      <div class="operations-subpanel">
        <div class="operations-subpanel-title">Commercial</div>
        <div class="operations-mini-grid">
          <div>
            <span>Readiness</span>
            <strong>${commercial.score.toFixed(0)}/100 • ${commercial.grade}</strong>
          </div>
          <div>
            <span>Service level</span>
            <strong>${escapeHtml(getServiceLevelLabel(commercial.settings.serviceLevel))}</strong>
          </div>
          <div>
            <span>SLA status</span>
            <strong>${escapeHtml(commercial.slaStatus)}</strong>
          </div>
          <div>
            <span>Value at risk</span>
            <strong>${escapeHtml(formatCurrencyUsd(commercial.finance.cargoValueAtRisk))}</strong>
          </div>
          <div>
            <span>Unused freight</span>
            <strong>${escapeHtml(formatCurrencyUsd(commercial.finance.unusedFreightCost))}</strong>
          </div>
          <div>
            <span>High-risk units</span>
            <strong>${commercial.counts.highRiskUnitCount}</strong>
          </div>
        </div>
        <div class="operations-commercial-note">
          <b>${escapeHtml(commercial.headline)}</b><br/>
          ${escapeHtml(commercial.recommendations[0] || 'Sẵn sàng tối ưu và xuất báo cáo.')}
        </div>
      </div>

      <div class="operations-next-step">
        <b>Gợi ý tiếp theo:</b> ${nextStep}
      </div>
    </div>
  `;
}
