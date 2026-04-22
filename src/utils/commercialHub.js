export const DEFAULT_COMMERCIAL_SETTINGS = {
  projectName: 'Spring Launch Wave',
  customerName: 'Key Account',
  routeName: 'Ho Chi Minh City -> Los Angeles',
  serviceLevel: 'standard',
  declaredValue: 125000,
  freightCost: 3200,
  targetUtilization: 82,
  targetMaxImbalance: 12,
};
import { analyzeOptimizerManifest } from './optimizerIntelligence.js';

const SERVICE_LEVELS = {
  economy: {
    label: 'Economy',
    readinessTarget: 68,
    description: 'Toi uu chi phi va chap nhan room de dieu chinh.',
  },
  standard: {
    label: 'Standard',
    readinessTarget: 78,
    description: 'Can bang giua toc do ra quyet dinh va do an toan van hanh.',
  },
  priority: {
    label: 'Priority',
    readinessTarget: 86,
    description: 'Can readiness cao, layout sach va rui ro thap truoc khi quote.',
  },
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveDeliveryZone(value) {
  return ['head', 'middle', 'door'].includes(value) ? value : 'any';
}

function resolveServiceLevel(value) {
  return SERVICE_LEVELS[value] ? value : DEFAULT_COMMERCIAL_SETTINGS.serviceLevel;
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

function countUnits(items = [], predicate) {
  return items.reduce((sum, item) => {
    if (!predicate(item)) return sum;
    return sum + Math.max(0, toNumber(item.qty));
  }, 0);
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(toNumber(value));
}

function buildScoreLabel(score) {
  if (score >= 88) return 'San sang quote';
  if (score >= 76) return 'Kha thi de chot';
  if (score >= 60) return 'Can tinh chinh';
  return 'Rui ro cao';
}

function buildRiskLabel(score, warningCount, criticalAlertCount = 0) {
  if (criticalAlertCount > 0 || score < 55) return 'High';
  if (warningCount > 1 || score < 72) return 'Medium';
  return 'Low';
}

function buildSlaStatus(score, serviceLevel) {
  const target = SERVICE_LEVELS[serviceLevel].readinessTarget;
  return score >= target ? 'Dat muc SLA' : 'Chua dat muc SLA';
}

export function getServiceLevelLabel(serviceLevel) {
  return SERVICE_LEVELS[resolveServiceLevel(serviceLevel)].label;
}

export function formatCurrencyUsd(value) {
  return formatCompactCurrency(value);
}

export function normalizeCommercialSettings(settings = {}) {
  const merged = {
    ...DEFAULT_COMMERCIAL_SETTINGS,
    ...settings,
  };

  return {
    projectName: String(merged.projectName || DEFAULT_COMMERCIAL_SETTINGS.projectName).trim(),
    customerName: String(merged.customerName || DEFAULT_COMMERCIAL_SETTINGS.customerName).trim(),
    routeName: String(merged.routeName || DEFAULT_COMMERCIAL_SETTINGS.routeName).trim(),
    serviceLevel: resolveServiceLevel(merged.serviceLevel),
    declaredValue: Math.max(0, toNumber(merged.declaredValue, DEFAULT_COMMERCIAL_SETTINGS.declaredValue)),
    freightCost: Math.max(0, toNumber(merged.freightCost, DEFAULT_COMMERCIAL_SETTINGS.freightCost)),
    targetUtilization: clamp(
      toNumber(merged.targetUtilization, DEFAULT_COMMERCIAL_SETTINGS.targetUtilization),
      40,
      98
    ),
    targetMaxImbalance: clamp(
      toNumber(merged.targetMaxImbalance, DEFAULT_COMMERCIAL_SETTINGS.targetMaxImbalance),
      4,
      35
    ),
  };
}

function buildPlanningCounts(validItems) {
  const validSkuCount = validItems.length;
  const totalUnits = validItems.reduce((sum, item) => sum + Math.max(0, toNumber(item.qty)), 0);
  const requestedWeightKg = validItems.reduce(
    (sum, item) => sum + Math.max(0, toNumber(item.qty)) * Math.max(0, toNumber(item.weight)),
    0
  );
  const requestedVolumeCm3 = validItems.reduce(
    (sum, item) =>
      sum +
      Math.max(0, toNumber(item.qty)) *
        Math.max(0, toNumber(item.w)) *
        Math.max(0, toNumber(item.h)) *
        Math.max(0, toNumber(item.d)),
    0
  );
  const highRiskSkuCount = validItems.filter((item) => item.noStack || item.noTilt).length;
  const highRiskUnitCount = countUnits(validItems, (item) => item.noStack || item.noTilt);
  const fixedOrientationSkuCount = validItems.filter((item) => item.allowRotate === false).length;
  const zonedSkuCount = validItems.filter(
    (item) => resolveDeliveryZone(item.deliveryZone) !== 'any'
  ).length;
  const controlledSkuCount = validItems.filter(
    (item) => toNumber(item.stackLimit) > 0 || toNumber(item.maxLoadAbove) > 0
  ).length;

  return {
    validSkuCount,
    totalUnits,
    requestedWeightKg,
    requestedVolumeCm3,
    highRiskSkuCount,
    highRiskUnitCount,
    fixedOrientationSkuCount,
    zonedSkuCount,
    controlledSkuCount,
  };
}

export function runCommercialPreflight({
  items = [],
  container = {},
  maxWeight = Infinity,
  floorLoadLimit = Infinity,
  settings = {},
}) {
  const normalizedSettings = normalizeCommercialSettings(settings);
  const validItems = getValidItems(items);
  const counts = buildPlanningCounts(validItems);
  const containerVolumeCm3 =
    Math.max(0, toNumber(container.w)) *
    Math.max(0, toNumber(container.h)) *
    Math.max(0, toNumber(container.d));
  const requestedVolumeRatio =
    containerVolumeCm3 > 0 ? counts.requestedVolumeCm3 / containerVolumeCm3 : 0;
  const requestedWeightRatio =
    Number.isFinite(maxWeight) && maxWeight > 0 ? counts.requestedWeightKg / maxWeight : 0;
  const optimizerAdvice = analyzeOptimizerManifest({
    container,
    boxTypes: validItems,
    maxWeight,
    floorLoadLimit,
  });

  const alerts = [];

  if (counts.validSkuCount === 0) {
    alerts.push({
      severity: 'critical',
      title: 'Manifest chua co SKU hop le',
      detail: 'Can co it nhat 1 SKU voi kich thuoc, khoi luong va quantity hop le.',
    });
  }

  if (Number.isFinite(maxWeight) && maxWeight > 0 && requestedWeightRatio > 1) {
    alerts.push({
      severity: 'critical',
      title: 'Tong khoi luong vuot gioi han tai',
      detail: `Manifest dang vuot ${((requestedWeightRatio - 1) * 100).toFixed(1)}% gioi han container.`,
    });
  }

  if (requestedVolumeRatio > 1) {
    alerts.push({
      severity: 'critical',
      title: 'Tong the tich yeu cau vuot suc chua',
      detail: `Manifest dang vuot ${((requestedVolumeRatio - 1) * 100).toFixed(1)}% the tich container.`,
    });
  }

  if (counts.highRiskSkuCount > 0) {
    alerts.push({
      severity: counts.highRiskSkuCount >= Math.max(2, Math.ceil(counts.validSkuCount * 0.35)) ? 'warning' : 'info',
      title: 'Co SKU nhay cam khi van chuyen',
      detail: `${counts.highRiskSkuCount} SKU yeu cau noStack / noTilt. Nen kiem tra pad, support va thu tu xuong hang.`,
    });
  }

  if (counts.zonedSkuCount > 0) {
    alerts.push({
      severity: 'info',
      title: 'Manifest co rang buoc khu vuc giao hang',
      detail: `${counts.zonedSkuCount} SKU da gan delivery zone. Optimizer can duoc chay de xac nhan tinh kha thi.`,
    });
  }

  if (counts.controlledSkuCount > 0 || Number.isFinite(floorLoadLimit)) {
    alerts.push({
      severity: 'info',
      title: 'Manifest co rang buoc stack / floor load',
      detail:
        counts.controlledSkuCount > 0
          ? `${counts.controlledSkuCount} SKU co stackLimit hoac maxLoadAbove.`
          : 'Da cau hinh gioi han tai san container.',
    });
  }

  if (optimizerAdvice.profile.floorPressureDemandRatio >= 0.45) {
    alerts.push({
      severity: 'warning',
      title: 'Manifest co dau hieu ap luc tai san cao',
      detail: 'Nen uu tien heuristic on dinh nen chiu tai va review max floor pressure sau khi pack.',
    });
  }

  let score = 100;
  score -= Math.max(0, requestedVolumeRatio - 0.9) * 70;
  score -= Math.max(0, requestedWeightRatio - 0.88) * 80;
  score -= counts.highRiskSkuCount * 3;
  score -= counts.fixedOrientationSkuCount * 4;
  score -= counts.controlledSkuCount * 3;
  score -= counts.zonedSkuCount * 2;
  score -= alerts.filter((alert) => alert.severity === 'critical').length * 16;
  score -= alerts.filter((alert) => alert.severity === 'warning').length * 8;
  score = clamp(score, 0, 100);

  const recommendations = [];

  if (requestedVolumeRatio > 1) {
    recommendations.push('Can doi container lon hon hoac tach shipment truoc khi quote.');
  }
  if (requestedWeightRatio > 1) {
    recommendations.push('Can giam khoi luong manifest hoac doi sang equipment co tai trong cao hon.');
  }
  if (requestedVolumeRatio <= 1 && requestedWeightRatio <= 1) {
    recommendations.push('Manifest co the dua vao optimizer de tao layout chot.');
  }
  if (counts.highRiskSkuCount > 0) {
    recommendations.push('Nen chay AI Pro va review shock / floor load truoc khi ban giao phuong an.');
  }
  if (counts.zonedSkuCount > 0 || counts.controlledSkuCount > 0) {
    recommendations.push('Su dung delivery zone va stack control de phan tach hang uu tien / hang de vo.');
  }
  if (optimizerAdvice.recommendations[0]) {
    recommendations.push(optimizerAdvice.recommendations[0]);
  }

  if (recommendations.length === 0) {
    recommendations.push('Manifest dang sach. Co the bat dau toi uu va xuat report cho khach hang.');
  }

  return {
    settings: normalizedSettings,
    serviceLabel: getServiceLevelLabel(normalizedSettings.serviceLevel),
    score,
    scoreLabel: buildScoreLabel(score),
    riskLabel: buildRiskLabel(score, alerts.length, alerts.filter((alert) => alert.severity === 'critical').length),
    alerts,
    recommendations,
    counts,
    ratios: {
      requestedVolumeRatio,
      requestedWeightRatio,
    },
    finance: {
      declaredValue: normalizedSettings.declaredValue,
      freightCost: normalizedSettings.freightCost,
      targetUtilization: normalizedSettings.targetUtilization,
      targetMaxImbalance: normalizedSettings.targetMaxImbalance,
    },
    optimizerAdvice,
  };
}

export function analyzeCommercialPlan({
  items = [],
  result = null,
  container = {},
  maxWeight = Infinity,
  floorLoadLimit = Infinity,
  settings = {},
}) {
  const normalizedSettings = normalizeCommercialSettings(settings);
  const validItems = getValidItems(items);
  const counts = buildPlanningCounts(validItems);
  const preflight = runCommercialPreflight({
    items: validItems,
    container,
    maxWeight,
    floorLoadLimit,
    settings: normalizedSettings,
  });

  const packedCount = Math.max(0, toNumber(result?.packedCount));
  const remainingCount =
    result?.remaining !== undefined
      ? Math.max(0, toNumber(result.remaining))
      : Math.max(0, counts.totalUnits - packedCount);
  const packedRatioPercent =
    counts.totalUnits > 0 ? (packedCount / counts.totalUnits) * 100 : 0;
  const usedEfficiencyPercent = Math.max(0, toNumber(result?.efficiency));
  const totalPlacedWeightKg = Math.max(0, toNumber(result?.totalPlacedWeight));
  const weightUtilizationPercent =
    Number.isFinite(maxWeight) && maxWeight > 0 ? (totalPlacedWeightKg / maxWeight) * 100 : 0;
  const sideImbalancePercent = toNumber(result?.loadBalance?.sideImbalancePercent);
  const lengthImbalancePercent = toNumber(result?.loadBalance?.lengthImbalancePercent);
  const warningCount =
    (Array.isArray(result?.balanceWarnings) ? result.balanceWarnings.length : 0) +
    toNumber(result?.rejectedByConstraintCount);
  const targetUtilizationScore =
    normalizedSettings.targetUtilization > 0
      ? clamp((usedEfficiencyPercent / normalizedSettings.targetUtilization) * 100, 0, 115)
      : usedEfficiencyPercent;
  const imbalanceTarget = normalizedSettings.targetMaxImbalance;
  const sideScore =
    sideImbalancePercent > 0
      ? clamp(100 - (sideImbalancePercent / imbalanceTarget) * 55, 0, 100)
      : 100;
  const lengthScore =
    lengthImbalancePercent > 0
      ? clamp(100 - (lengthImbalancePercent / imbalanceTarget) * 55, 0, 100)
      : 100;
  const overlapPenalty = result?.strictOverlapDetected ? 35 : 0;
  const optimizerAdvice = result?.optimizerIntelligence || preflight.optimizerAdvice;
  const remainingPenalty =
    counts.totalUnits > 0 ? Math.min(26, (remainingCount / counts.totalUnits) * 42) : 0;

  let score =
    packedRatioPercent * 0.34 +
    targetUtilizationScore * 0.28 +
    sideScore * 0.15 +
    lengthScore * 0.15 +
    preflight.score * 0.08 -
    warningCount * 4 -
    overlapPenalty -
    remainingPenalty;

  if (!result) {
    score = preflight.score;
  }

  score = clamp(score, 0, 100);

  const cargoValueAtRisk =
    counts.totalUnits > 0 ? (remainingCount / counts.totalUnits) * normalizedSettings.declaredValue : 0;
  const unusedFreightCost =
    normalizedSettings.freightCost * Math.max(0, 1 - usedEfficiencyPercent / 100);
  const costPerPackedUnit =
    packedCount > 0 ? normalizedSettings.freightCost / packedCount : normalizedSettings.freightCost;
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 68 ? 'C' : score >= 55 ? 'D' : 'E';
  const scoreLabel = buildScoreLabel(score);
  const riskLabel = buildRiskLabel(score, warningCount, preflight.alerts.filter((alert) => alert.severity === 'critical').length);
  const slaStatus = buildSlaStatus(score, normalizedSettings.serviceLevel);

  const recommendations = [];

  if (!result) {
    recommendations.push(...preflight.recommendations);
  } else {
    if (remainingCount > 0) {
      recommendations.push('Con hang chua xep het. Nen doi container, tach shipment hoac giam rang buoc.');
    }
    if (usedEfficiencyPercent < normalizedSettings.targetUtilization) {
      recommendations.push('Hieu suat the tich chua dat target. Nen thu lai voi heuristic khac hoac layout compact hon.');
    }
    if (
      sideImbalancePercent > normalizedSettings.targetMaxImbalance ||
      lengthImbalancePercent > normalizedSettings.targetMaxImbalance
    ) {
      recommendations.push('Can can bang tai trong de dat SLA van hanh va giam rui ro claim.');
    }
    if (warningCount > 0) {
      recommendations.push('Layout co canh bao rang buoc / load. Nen review ky truoc khi chot cho khach hang.');
    }
    if (result?.strictOverlapDetected) {
      recommendations.push('Phat hien giao nhau. Layout can duoc sua truoc khi coi la san sang giao hang.');
    }
    if (optimizerAdvice?.selectionReason) {
      recommendations.push(optimizerAdvice.selectionReason);
    }
    if (recommendations.length === 0) {
      recommendations.push('Phuong an da kha dep de quote, xuat report va ban giao cho doi van hanh.');
    }
  }

  const headline = result
    ? `${scoreLabel} • ${slaStatus}. ${remainingCount > 0 ? `${remainingCount} units dang con lai.` : 'Manifest da duoc xu ly tot trong layout hien tai.'}`
    : `${preflight.scoreLabel} cho preflight. ${preflight.alerts.filter((alert) => alert.severity === 'critical').length > 0 ? 'Can giam rui ro truoc khi toi uu.' : 'Manifest san sang dua vao optimizer.'}`;

  return {
    settings: normalizedSettings,
    serviceLabel: getServiceLevelLabel(normalizedSettings.serviceLevel),
    serviceDescription: SERVICE_LEVELS[normalizedSettings.serviceLevel].description,
    score,
    scoreLabel,
    grade,
    riskLabel,
    slaStatus,
    headline,
    recommendations,
    counts,
    layout: {
      packedCount,
      remainingCount,
      packedRatioPercent,
      usedEfficiencyPercent,
      totalPlacedWeightKg,
      weightUtilizationPercent,
      sideImbalancePercent,
      lengthImbalancePercent,
      warningCount,
      overlapDetected: Boolean(result?.strictOverlapDetected),
    },
    finance: {
      declaredValue: normalizedSettings.declaredValue,
      freightCost: normalizedSettings.freightCost,
      cargoValueAtRisk,
      unusedFreightCost,
      costPerPackedUnit,
    },
    targets: {
      utilization: normalizedSettings.targetUtilization,
      maxImbalance: normalizedSettings.targetMaxImbalance,
    },
    preflight,
    optimizerAdvice,
  };
}
