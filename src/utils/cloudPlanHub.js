import { analyzeCommercialPlan, getServiceLevelLabel } from './commercialHub.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPlanTimestamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'vừa lưu';

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getValidItems(items = []) {
  return items.filter(
    (item) =>
      toNumber(item.qty) > 0 &&
      toNumber(item.w) > 0 &&
      toNumber(item.h) > 0 &&
      toNumber(item.d) > 0 &&
      toNumber(item.weight) > 0
  );
}

export function buildCloudPlanSummary({
  contType,
  container,
  multiBoxTypes,
  boxes,
  result,
  maxWeight,
  floorLoadLimit,
  commercialSettings,
}) {
  const validItems = getValidItems(multiBoxTypes);
  const totalUnits = validItems.reduce((sum, item) => sum + toNumber(item.qty), 0);
  const totalRequestedWeight = validItems.reduce(
    (sum, item) => sum + toNumber(item.qty) * toNumber(item.weight),
    0
  );
  const placementCount = Array.isArray(boxes)
    ? boxes.filter((box) => box?.userData?.sceneRole !== 'preview').length
    : 0;
  const commercial = analyzeCommercialPlan({
    items: validItems,
    result,
    container,
    maxWeight,
    floorLoadLimit,
    settings: commercialSettings,
  });

  return {
    projectName: commercial.settings.projectName,
    customerName: commercial.settings.customerName,
    routeName: commercial.settings.routeName,
    serviceLevel: commercial.settings.serviceLevel,
    serviceLabel: getServiceLevelLabel(commercial.settings.serviceLevel),
    readinessScore: Number(commercial.score.toFixed(1)),
    readinessGrade: commercial.grade,
    slaStatus: commercial.slaStatus,
    requestedUnits: totalUnits,
    packedCount: result?.packedCount ?? placementCount,
    remainingCount: result?.remaining ?? Math.max(totalUnits - placementCount, 0),
    efficiency: Number(toNumber(result?.efficiency).toFixed(1)),
    declaredValue: commercial.finance.declaredValue,
    unusedFreightCost: commercial.finance.unusedFreightCost,
    cargoValueAtRisk: commercial.finance.cargoValueAtRisk,
    weightDemandKg: Number(totalRequestedWeight.toFixed(1)),
    containerType: contType || 'custom',
    container: {
      w: toNumber(container?.w),
      h: toNumber(container?.h),
      d: toNumber(container?.d),
    },
    strategyLabel: result?.strategyLabel || 'Chưa tối ưu',
    highRiskUnitCount: commercial.counts.highRiskUnitCount,
  };
}

export function formatCloudPlanOptionLabel(plan = {}) {
  const summary = plan.summary || {};
  const readiness = Number.isFinite(Number(summary.readinessScore))
    ? `${Number(summary.readinessScore).toFixed(0)}/100`
    : 'N/A';
  const name = plan.name || summary.projectName || 'Cloud plan';

  return `${name} • ${readiness} • ${formatPlanTimestamp(plan.updated_at || plan.created_at)}`;
}

export function getCloudPlanStatusLines(plan = {}) {
  const summary = plan.summary || {};

  return [
    `Project: ${summary.projectName || 'Chưa đặt tên shipment'}`,
    `SLA: ${summary.slaStatus || summary.serviceLabel || 'Chưa có'}`,
    `Units: ${toNumber(summary.packedCount)}/${toNumber(summary.requestedUnits)}`,
    `Strategy: ${summary.strategyLabel || 'Chưa tối ưu'}`,
  ];
}
