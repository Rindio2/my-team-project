import { CONTAINER_TYPES } from '../constants/containerTypes.js';

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getContainerMetrics(contType, container) {
  const preset = CONTAINER_TYPES[contType];
  if (preset) {
    return {
      label: preset.label,
      w: preset.w,
      h: preset.h,
      d: preset.d,
      maxLoad: preset.maxLoad,
    };
  }

  return {
    label: 'Custom',
    w: toNumber(container?.w),
    h: toNumber(container?.h),
    d: toNumber(container?.d),
    maxLoad: Infinity,
  };
}

export function formatKg(value) {
  return `${toNumber(value).toFixed(1)} kg`;
}

export function formatPercent(value) {
  return `${toNumber(value).toFixed(1)}%`;
}

export function formatLoadLimit(value) {
  return Number.isFinite(value) && value > 0 ? `${value.toFixed(0)} kg/m²` : 'Không giới hạn';
}

export function formatDeliveryZone(zone) {
  if (zone === 'head') return 'Đầu container';
  if (zone === 'middle') return 'Giữa container';
  if (zone === 'door') return 'Gần cửa';
  return 'Không cố định';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getValidSkuMetrics(items = []) {
  const validItems = items.filter(
    (item) =>
      toNumber(item.qty) > 0 &&
      toNumber(item.w) > 0 &&
      toNumber(item.h) > 0 &&
      toNumber(item.d) > 0 &&
      toNumber(item.weight) > 0
  );

  const totalUnits = validItems.reduce((sum, item) => sum + toNumber(item.qty), 0);
  const totalRequestedWeight = validItems.reduce(
    (sum, item) => sum + toNumber(item.qty) * toNumber(item.weight),
    0
  );

  return {
    validItems,
    validSkuCount: validItems.length,
    totalUnits,
    totalRequestedWeight,
  };
}
