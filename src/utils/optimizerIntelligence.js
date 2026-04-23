const STRATEGY_LABELS = {
  'delivery-balanced': 'Can bang giao hang',
  'largest-first': 'Kien lon truoc',
  'space-max-beam': 'Lap day khong gian',
  'pct-online-policy': 'PCT Online AI',
  'pct-flex-zone-policy': 'PCT Flex Zone AI',
  'heavy-base': 'Nen chiu tai',
  'unload-friendly': 'Uu tien do hang',
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDeliveryZone(value) {
  return ['head', 'middle', 'door'].includes(value) ? value : 'any';
}

function getStrategyLabel(strategyId) {
  return STRATEGY_LABELS[strategyId] || strategyId;
}

function buildUnitStats(boxTypes = []) {
  const stats = {
    skuCount: 0,
    totalUnits: 0,
    totalWeight: 0,
    totalVolume: 0,
    totalFootprintM2: 0,
    highRiskUnits: 0,
    fixedOrientationUnits: 0,
    zonedUnits: 0,
    controlledUnits: 0,
    headUnits: 0,
    middleUnits: 0,
    doorUnits: 0,
    minPriority: Infinity,
    maxPriority: 1,
  };

  boxTypes.forEach((rawItem) => {
    const qty = Math.max(0, toNumber(rawItem.qty, 0));
    const w = Math.max(0, toNumber(rawItem.w));
    const h = Math.max(0, toNumber(rawItem.h));
    const d = Math.max(0, toNumber(rawItem.d));
    const weight = Math.max(0, toNumber(rawItem.weight));

    if (qty <= 0 || w <= 0 || h <= 0 || d <= 0 || weight <= 0) {
      return;
    }

    const allowRotate =
      rawItem.allowRotate !== undefined ? Boolean(rawItem.allowRotate) : rawItem.rotationMode !== 'fixed';
    const noStack = rawItem.noStack !== undefined ? Boolean(rawItem.noStack) : Boolean(rawItem.fragile);
    const noTilt = rawItem.noTilt !== undefined ? Boolean(rawItem.noTilt) : rawItem.rotationMode === 'upright';
    const deliveryZone = normalizeDeliveryZone(rawItem.deliveryZone);
    const priorityGroup = Math.max(1, toNumber(rawItem.priorityGroup ?? rawItem.deliveryOrder, 1));
    const controlled = toNumber(rawItem.stackLimit) > 0 || toNumber(rawItem.maxLoadAbove) > 0;

    stats.skuCount += 1;
    stats.totalUnits += qty;
    stats.totalWeight += qty * weight;
    stats.totalVolume += qty * w * h * d;
    stats.totalFootprintM2 += qty * ((w * d) / 10000);
    if (noStack || noTilt) stats.highRiskUnits += qty;
    if (!allowRotate) stats.fixedOrientationUnits += qty;
    if (deliveryZone !== 'any') stats.zonedUnits += qty;
    if (controlled) stats.controlledUnits += qty;
    if (deliveryZone === 'head') stats.headUnits += qty;
    if (deliveryZone === 'middle') stats.middleUnits += qty;
    if (deliveryZone === 'door') stats.doorUnits += qty;
    stats.minPriority = Math.min(stats.minPriority, priorityGroup);
    stats.maxPriority = Math.max(stats.maxPriority, priorityGroup);
  });

  if (!Number.isFinite(stats.minPriority)) {
    stats.minPriority = 1;
  }

  return stats;
}

function buildProfile({
  boxTypes = [],
  container = {},
  maxWeight = Infinity,
  floorLoadLimit = Infinity,
}) {
  const stats = buildUnitStats(boxTypes);
  const containerVolume = Math.max(
    1,
    Math.max(0, toNumber(container.w)) *
      Math.max(0, toNumber(container.h)) *
      Math.max(0, toNumber(container.d))
  );
  const avgUnitWeight = stats.totalUnits > 0 ? stats.totalWeight / stats.totalUnits : 0;
  const avgUnitVolume = stats.totalUnits > 0 ? stats.totalVolume / stats.totalUnits : 0;
  const avgUnitFootprintM2 = stats.totalUnits > 0 ? stats.totalFootprintM2 / stats.totalUnits : 0;
  const avgUnitFloorPressure = avgUnitFootprintM2 > 0 ? avgUnitWeight / avgUnitFootprintM2 : 0;
  const densityKgM3 = stats.totalVolume > 0 ? stats.totalWeight / (stats.totalVolume / 1000000) : 0;
  const volumeDemandRatio = stats.totalVolume / containerVolume;
  const weightDemandRatio =
    Number.isFinite(maxWeight) && maxWeight > 0 ? stats.totalWeight / maxWeight : 0;
  const floorPressureDemandRatio =
    Number.isFinite(floorLoadLimit) && floorLoadLimit > 0
      ? avgUnitFloorPressure / floorLoadLimit
      : 0;

  return {
    ...stats,
    avgUnitWeight,
    avgUnitVolume,
    avgUnitFootprintM2,
    avgUnitFloorPressure,
    densityKgM3,
    prioritySpread: Math.max(0, stats.maxPriority - stats.minPriority),
    volumeDemandRatio,
    weightDemandRatio,
    floorPressureDemandRatio,
    highRiskUnitRatio: stats.totalUnits > 0 ? stats.highRiskUnits / stats.totalUnits : 0,
    fixedOrientationUnitRatio: stats.totalUnits > 0 ? stats.fixedOrientationUnits / stats.totalUnits : 0,
    zonedUnitRatio: stats.totalUnits > 0 ? stats.zonedUnits / stats.totalUnits : 0,
    controlledUnitRatio: stats.totalUnits > 0 ? stats.controlledUnits / stats.totalUnits : 0,
  };
}

function buildPlanningMode(profile) {
  if (profile.zonedUnitRatio >= 0.28 || profile.prioritySpread >= 2) {
    return 'unload-first';
  }

  if (
    profile.weightDemandRatio >= 0.7 ||
    profile.highRiskUnitRatio >= 0.24 ||
    profile.floorPressureDemandRatio >= 0.45
  ) {
    return 'stability-first';
  }

  if (profile.volumeDemandRatio >= 0.8 || profile.totalUnits >= 48) {
    return 'space-first';
  }

  return 'balanced';
}

function buildStrategyScores(profile) {
  const scores = new Map(
    Object.keys(STRATEGY_LABELS).map((strategyId) => [strategyId, 1])
  );
  const notes = new Map(
    Object.keys(STRATEGY_LABELS).map((strategyId) => [strategyId, []])
  );

  function addScore(strategyId, score, note) {
    scores.set(strategyId, (scores.get(strategyId) || 0) + score);
    if (note) {
      notes.get(strategyId).push(note);
    }
  }

  if (profile.volumeDemandRatio >= 0.82) {
    addScore('space-max-beam', 6, 'Ap luc the tich cao');
    addScore('largest-first', 2, 'Nhieu units can lap nhanh khong gian');
    addScore('pct-online-policy', 3, 'Can anchor search de tranh khoa som khong gian container');
    addScore('pct-flex-zone-policy', 3, 'Can flex zone co canh bao khi ap luc the tich cao');
  } else if (profile.volumeDemandRatio >= 0.68) {
    addScore('space-max-beam', 3, 'Manifest can compact manh');
    addScore('pct-online-policy', 2, 'Can thu them anchor points theo zone va layer');
    addScore('pct-flex-zone-policy', 2, 'Can them nhanh overflow co kiem soat');
  }

  if (profile.weightDemandRatio >= 0.72) {
    addScore('heavy-base', 6, 'Ti le tai trong cao');
    addScore('delivery-balanced', 2, 'Can giu can bang tai');
  } else if (profile.weightDemandRatio >= 0.55) {
    addScore('heavy-base', 3, 'Tai trong tuong doi day');
  }

  if (profile.floorPressureDemandRatio >= 0.45) {
    addScore('heavy-base', 4, 'Can uu tien nen chiu tai');
  }

  if (profile.highRiskUnitRatio >= 0.24) {
    addScore('heavy-base', 3, 'Nhieu item noStack/noTilt');
    addScore('delivery-balanced', 2, 'Can giu support ratio an toan');
  }

  if (profile.fixedOrientationUnitRatio >= 0.18) {
    addScore('delivery-balanced', 3, 'Nhieu item co huong dat co dinh');
    addScore('largest-first', 1, 'Can don gian hoa lua chon orientation');
  }

  if (profile.zonedUnitRatio >= 0.28) {
    addScore('unload-friendly', 6, 'Manifest co delivery zone ro');
    addScore('delivery-balanced', 3, 'Can giu thu tu do hang');
  } else if (profile.zonedUnitRatio >= 0.12) {
    addScore('unload-friendly', 3, 'Co rang buoc delivery zone');
  }

  if (profile.prioritySpread >= 2) {
    addScore('unload-friendly', 2, 'Do lech priority group cao');
    addScore('delivery-balanced', 2, 'Can giu thu tu xep theo group');
  }

  if (profile.totalUnits >= 54) {
    addScore('space-max-beam', 2, 'Manifest co so luong units lon');
    addScore('pct-online-policy', 4, 'So luong units lon, phu hop policy online/PCT');
    addScore('pct-flex-zone-policy', 3, 'Chay them nhanh PCT linh hoat de tim fill-rate cao hon');
  } else if (profile.totalUnits <= 18) {
    addScore('largest-first', 2, 'Manifest gon, de danh uu tien kien lon');
  }

  if (profile.controlledUnitRatio >= 0.2) {
    addScore('delivery-balanced', 2, 'Nhieu rang buoc stack/load');
    addScore('heavy-base', 2, 'Can giu ong cot tai on dinh');
    addScore('pct-online-policy', 2, 'Nhieu rang buoc can cay search theo cau hinh xep');
    addScore('pct-flex-zone-policy', 1, 'Thu phuong an linh hoat neu rang buoc zone qua chat');
  }

  if (profile.volumeDemandRatio >= 0.7 && profile.highRiskUnitRatio >= 0.12) {
    addScore('pct-online-policy', 3, 'Can can bang fill-rate va on dinh theo tung buoc online');
    addScore('pct-flex-zone-policy', 2, 'Can can bang fill-rate voi overflow canh bao');
  }

  if (profile.fixedOrientationUnitRatio >= 0.12 && profile.totalUnits >= 24) {
    addScore('pct-online-policy', 2, 'Nhieu orientation bi gioi han, can policy uu tien diem dat sau-duoi-trai');
  }

  addScore('delivery-balanced', 1, 'Luon giu mot nhanh can bang tong quat');

  return { scores, notes };
}

function buildStrategyOverrides(profile, planningMode) {
  const spaceBeamWidth =
    profile.totalUnits >= 72 ? 4 : profile.volumeDemandRatio >= 0.84 ? 6 : 5;
  const spaceBranchFactor = profile.totalUnits >= 56 ? 2 : 3;
  const spaceLookahead = profile.totalUnits >= 64 ? 12 : 16;

  return {
    'space-max-beam': {
      beamWidth: spaceBeamWidth,
      branchFactor: spaceBranchFactor,
      beamLookaheadCount: spaceLookahead,
    },
    'heavy-base':
      planningMode === 'stability-first'
        ? {
            scoringProfile: 'support',
          }
        : {},
    'pct-online-policy': {
      beamWidth: profile.totalUnits >= 72 ? 6 : profile.volumeDemandRatio >= 0.82 ? 5 : 4,
      branchFactor: profile.totalUnits >= 56 ? 2 : 3,
      beamLookaheadCount: profile.totalUnits >= 64 ? 22 : 16,
      reorderWindow: profile.totalUnits >= 64 ? 6 : 5,
      fillerWindow: profile.volumeDemandRatio >= 0.78 ? 12 : 9,
      allowSoftZoneOverflow:
        profile.highRiskUnitRatio < 0.18 || profile.volumeDemandRatio >= 0.22,
    },
    'pct-flex-zone-policy': {
      beamWidth: profile.totalUnits >= 72 ? 6 : profile.volumeDemandRatio >= 0.82 ? 5 : 4,
      branchFactor: profile.totalUnits >= 56 ? 2 : 3,
      beamLookaheadCount: profile.totalUnits >= 64 ? 22 : 16,
      reorderWindow: profile.totalUnits >= 64 ? 6 : 5,
      fillerWindow: profile.volumeDemandRatio >= 0.78 ? 12 : 9,
      allowSoftZoneOverflow: true,
    },
  };
}

function buildRationale(profile, planningMode) {
  const lines = [];

  if (profile.volumeDemandRatio > 0) {
    lines.push(
      `Nhu cau the tich dang o ${Math.round(profile.volumeDemandRatio * 100)}% suc chua container.`
    );
  }

  if (profile.weightDemandRatio > 0) {
    lines.push(
      `Nhu cau tai trong dang o ${Math.round(profile.weightDemandRatio * 100)}% gioi han container.`
    );
  }

  if (profile.zonedUnitRatio > 0) {
    lines.push(
      `${Math.round(profile.zonedUnitRatio * 100)}% units co delivery zone, can giu logic do hang ro rang.`
    );
  }

  if (profile.highRiskUnitRatio > 0) {
    lines.push(
      `${Math.round(profile.highRiskUnitRatio * 100)}% units co noStack/noTilt, uu tien on dinh nen va support.`
    );
  }

  if (profile.fixedOrientationUnitRatio > 0) {
    lines.push(
      `${Math.round(profile.fixedOrientationUnitRatio * 100)}% units bi gioi han huong dat, can giam nhanh xep linh tinh.`
    );
  }

  lines.push(
    planningMode === 'unload-first'
      ? 'Planning mode duoc chon la unload-first de uu tien thao tac do hang va giu thu tu giao nhan.'
      : planningMode === 'stability-first'
        ? 'Planning mode duoc chon la stability-first de uu tien tai san, support va do on dinh cot xep.'
        : planningMode === 'space-first'
          ? 'Planning mode duoc chon la space-first de day hieu suat the tich truoc.'
          : 'Planning mode duoc chon la balanced de can bang giua fill rate, support va tai trong.'
  );

  return lines;
}

function buildRecommendations(profile, primaryStrategyId) {
  const recommendations = [
    `Uu tien heuristic ${getStrategyLabel(primaryStrategyId)} cho lan toi uu dau tien.`,
  ];

  if (primaryStrategyId === 'pct-online-policy') {
    recommendations.push(
      'Dung PCT Online AI de thu reorder-window beam, anchor points theo zone/layer, beam skip branch va repair sau cung.'
    );
  }

  if (primaryStrategyId === 'pct-flex-zone-policy') {
    recommendations.push(
      'Dung PCT Flex Zone AI khi can uu tien so thung xep duoc, sau do review cac item tran delivery zone trong report.'
    );
  }

  if (profile.highRiskUnitRatio >= 0.24) {
    recommendations.push('Review ky support ratio, stack level va tai de tren cac item nhay cam.');
  }

  if (profile.zonedUnitRatio >= 0.2) {
    recommendations.push('Sau khi toi uu xong, kiem tra lai thu tu delivery zone gan cua va giua container.');
  }

  if (profile.volumeDemandRatio >= 0.82) {
    recommendations.push('Neu van con thung bi loai, uu tien compact layout truoc khi doi container.');
  }

  if (profile.weightDemandRatio >= 0.72 || profile.floorPressureDemandRatio >= 0.45) {
    recommendations.push('Theo doi can bang tai va ap suat san vi manifest dang o vung tai cao.');
  }

  return recommendations;
}

export function analyzeOptimizerManifest({
  container = {},
  boxTypes = [],
  maxWeight = Infinity,
  floorLoadLimit = Infinity,
}) {
  const profile = buildProfile({
    container,
    boxTypes,
    maxWeight,
    floorLoadLimit,
  });
  const planningMode = buildPlanningMode(profile);
  const { scores, notes } = buildStrategyScores(profile);
  const baseOrder = [
    'delivery-balanced',
    'largest-first',
    'space-max-beam',
    'pct-online-policy',
    'pct-flex-zone-policy',
    'heavy-base',
    'unload-friendly',
  ];

  const strategyPlans = baseOrder
    .map((strategyId) => ({
      id: strategyId,
      label: getStrategyLabel(strategyId),
      dispatchScore: scores.get(strategyId) || 0,
      dispatchReason:
        notes.get(strategyId).length > 0 ? notes.get(strategyId).join(' + ') : 'Nen heuristic mac dinh',
    }))
    .sort((a, b) => {
      if (b.dispatchScore !== a.dispatchScore) {
        return b.dispatchScore - a.dispatchScore;
      }

      return baseOrder.indexOf(a.id) - baseOrder.indexOf(b.id);
    })
    .map((plan, index) => ({
      ...plan,
      dispatchRank: index + 1,
    }));

  const primaryPlan = strategyPlans[0];
  const secondPlan = strategyPlans[1] || primaryPlan;
  const confidence = clamp(
    Math.round(
      52 +
        Math.max(0, primaryPlan.dispatchScore - secondPlan.dispatchScore) * 6 +
        Math.min(18, buildRationale(profile, planningMode).length * 2)
    ),
    55,
    96
  );

  return {
    planningMode,
    headline: `Manifest-aware optimizer dang uu tien ${primaryPlan.label.toLowerCase()} cho profile hien tai.`,
    confidence,
    profile,
    primaryStrategyId: primaryPlan.id,
    primaryStrategyLabel: primaryPlan.label,
    strategyOrder: strategyPlans.map((plan) => plan.id),
    strategyPlans,
    strategyOverrides: buildStrategyOverrides(profile, planningMode),
    rationale: buildRationale(profile, planningMode),
    recommendations: buildRecommendations(profile, primaryPlan.id),
  };
}
