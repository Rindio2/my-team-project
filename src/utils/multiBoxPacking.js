import { compactPlacedLayout } from './layoutCompactor.js';
import { analyzeOptimizerManifest } from './optimizerIntelligence.js';

const EPSILON = 0.0001;
const CONTACT_EPSILON = 0.000001;
const FACE_SNAP_TOLERANCE = 1.25;
const MIN_SUPPORT_RATIO = 0.78;
const PACKING_ALGORITHM_LABEL =
  'Manifest-aware strategy dispatch + PCT-inspired online policy + adaptive reorder beam + adaptive anchor search + skip-branch beam + extreme points + multi-strategy greedy scoring + local compaction + face snap + repair insertion + allowed orientations + support check + noStack/noTilt + floor load + load balance';

function resolveStackLimit(rawLimit) {
  const value = Number(rawLimit);
  return value > 0 ? value : Infinity;
}

function resolveMaxLoadAbove(rawLimit) {
  const value = Number(rawLimit);
  return value > 0 ? value : Infinity;
}

function normalizePriorityGroup(value) {
  const parsed = Number(value);
  return parsed > 0 ? parsed : 1;
}

function clonePlacementBox(box) {
  return {
    ...box,
    originalSize: box?.originalSize ? { ...box.originalSize } : undefined,
  };
}

function resolveAllowRotate(item = {}) {
  if (item.allowRotate !== undefined) {
    return Boolean(item.allowRotate);
  }

  return item.rotationMode !== 'fixed';
}

function resolveNoTilt(item = {}) {
  if (item.noTilt !== undefined) {
    return Boolean(item.noTilt);
  }

  return item.rotationMode === 'upright';
}

function resolveNoStack(item = {}) {
  if (item.noStack !== undefined) {
    return Boolean(item.noStack);
  }

  return Boolean(item.fragile);
}

function normalizeDeliveryZone(zone) {
  return ['head', 'middle', 'door'].includes(zone) ? zone : 'any';
}

function deriveRotationMode(item = {}) {
  if (!resolveAllowRotate(item)) return 'fixed';
  if (resolveNoTilt(item)) return 'upright';
  return 'all';
}

function normalizeBoxType(item = {}, typeIndex = 0) {
  const allowRotate = resolveAllowRotate(item);
  const noTilt = resolveNoTilt(item);
  const noStack = resolveNoStack(item);
  const priorityGroup = normalizePriorityGroup(item.priorityGroup ?? item.deliveryOrder);

  return {
    id: item.id || `${typeIndex + 1}`,
    itemId: item.itemId || item.id || `${typeIndex + 1}`,
    typeIndex,
    label: item.label || `Item ${typeIndex + 1}`,
    w: Number(item.w || 0),
    h: Number(item.h || 0),
    d: Number(item.d || 0),
    weight: Number(item.weight || 0),
    qty: Math.max(0, Number(item.qty || 0)),
    allowRotate,
    noStack,
    noTilt,
    priorityGroup,
    deliveryOrder: priorityGroup,
    rotationMode: deriveRotationMode({ allowRotate, noTilt }),
    fragile: noStack,
    stackLimit: noStack ? 1 : resolveStackLimit(item.stackLimit),
    maxLoadAbove: noStack ? 0 : resolveMaxLoadAbove(item.maxLoadAbove),
    deliveryZone: normalizeDeliveryZone(item.deliveryZone),
  };
}

function getAllowedOrientations(item) {
  const normalized = normalizeBoxType(item, item.typeIndex ?? 0);
  const raw =
    normalized.rotationMode === 'fixed'
      ? [{ w: normalized.w, h: normalized.h, d: normalized.d }]
      : normalized.rotationMode === 'upright'
        ? [
            { w: normalized.w, h: normalized.h, d: normalized.d },
            { w: normalized.d, h: normalized.h, d: normalized.w },
          ]
        : [
            { w: normalized.w, h: normalized.h, d: normalized.d },
            { w: normalized.w, h: normalized.d, d: normalized.h },
            { w: normalized.h, h: normalized.w, d: normalized.d },
            { w: normalized.h, h: normalized.d, d: normalized.w },
            { w: normalized.d, h: normalized.w, d: normalized.h },
            { w: normalized.d, h: normalized.h, d: normalized.w },
          ];

  const map = new Map();

  raw.forEach((rotation) => {
    const key = `${rotation.w}-${rotation.h}-${rotation.d}`;
    if (!map.has(key)) map.set(key, rotation);
  });

  return [...map.values()];
}

function getZoneSpecificity(zone) {
  return zone === 'any' ? 0 : 1;
}

function getZonePriority(zone) {
  if (zone === 'head') return 3;
  if (zone === 'middle') return 2;
  if (zone === 'door') return 1;
  return 0;
}

function getVolume(box) {
  return Number(box.w || 0) * Number(box.h || 0) * Number(box.d || 0);
}

function getFootprint(box) {
  return Number(box.w || 0) * Number(box.d || 0);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getDensity(box) {
  const volume = getVolume(box);
  return volume > EPSILON ? Number(box.weight || 0) / volume : 0;
}

function getPackingDifficulty(item = {}) {
  const orientationPenalty = Math.max(0, 6 - getAllowedOrientations(item).length) * 2400;
  const constraintPenalty =
    Number(Boolean(item.noStack || item.fragile)) * 3600 +
    Number(Boolean(item.noTilt)) * 1800 +
    Number(getZoneSpecificity(item.deliveryZone)) * 1500 +
    (Number.isFinite(item.maxLoadAbove) ? 900 : 0) +
    (Number.isFinite(item.stackLimit) ? 700 : 0);
  const shapePenalty =
    Math.max(item.w || 0, item.h || 0, item.d || 0) * 18 +
    Math.abs(Number(item.w || 0) - Number(item.d || 0)) * 10;

  return (
    constraintPenalty +
    orientationPenalty +
    shapePenalty +
    getVolume(item) / 650 +
    getFootprint(item) / 18 +
    getDensity(item) * 280000
  );
}

function defaultItemComparator(a, b) {
  const specificityA = getZoneSpecificity(a.deliveryZone);
  const specificityB = getZoneSpecificity(b.deliveryZone);
  if (specificityB !== specificityA) {
    return specificityB - specificityA;
  }

  const zonePriorityA = getZonePriority(a.deliveryZone);
  const zonePriorityB = getZonePriority(b.deliveryZone);
  if (zonePriorityB !== zonePriorityA) {
    return zonePriorityB - zonePriorityA;
  }

  if (b.deliveryOrder !== a.deliveryOrder) {
    return b.deliveryOrder - a.deliveryOrder;
  }

  if (a.fragile !== b.fragile) {
    return Number(a.fragile) - Number(b.fragile);
  }

  const loadCapA = Number.isFinite(a.maxLoadAbove) ? a.maxLoadAbove : Number.MAX_SAFE_INTEGER;
  const loadCapB = Number.isFinite(b.maxLoadAbove) ? b.maxLoadAbove : Number.MAX_SAFE_INTEGER;
  if (loadCapB !== loadCapA) {
    return loadCapB - loadCapA;
  }

  const volA = getVolume(a);
  const volB = getVolume(b);
  if (volB !== volA) return volB - volA;

  return Number(b.weight || 0) - Number(a.weight || 0);
}

function pctOnlineItemComparator(a, b) {
  const specificityDiff = getZoneSpecificity(b.deliveryZone) - getZoneSpecificity(a.deliveryZone);
  if (specificityDiff !== 0) return specificityDiff;

  if (b.deliveryOrder !== a.deliveryOrder) {
    return b.deliveryOrder - a.deliveryOrder;
  }

  const difficultyDiff = getPackingDifficulty(b) - getPackingDifficulty(a);
  if (difficultyDiff !== 0) return difficultyDiff;

  if (a.fragile !== b.fragile) {
    return Number(a.fragile) - Number(b.fragile);
  }

  const densityA = getDensity(a);
  const densityB = getDensity(b);
  if (densityB !== densityA) return densityB - densityA;

  const volDiff = getVolume(b) - getVolume(a);
  if (volDiff !== 0) return volDiff;

  return defaultItemComparator(a, b);
}

const STRATEGY_PRESETS = [
  {
    id: 'delivery-balanced',
    label: 'Cân bằng giao hàng',
    pointSortMode: 'floor-front-left',
    scoringProfile: 'balance',
    itemComparator: defaultItemComparator,
  },
  {
    id: 'largest-first',
    label: 'Kiện lớn trước',
    pointSortMode: 'floor-front-center',
    scoringProfile: 'dense',
    itemComparator: (a, b) => {
      const volDiff = getVolume(b) - getVolume(a);
      if (volDiff !== 0) return volDiff;

      const footprintDiff = getFootprint(b) - getFootprint(a);
      if (footprintDiff !== 0) return footprintDiff;

      const loadCapA = Number.isFinite(a.maxLoadAbove) ? a.maxLoadAbove : Number.MAX_SAFE_INTEGER;
      const loadCapB = Number.isFinite(b.maxLoadAbove) ? b.maxLoadAbove : Number.MAX_SAFE_INTEGER;
      if (loadCapB !== loadCapA) {
        return loadCapB - loadCapA;
      }

      if (a.fragile !== b.fragile) {
        return Number(a.fragile) - Number(b.fragile);
      }

      return defaultItemComparator(a, b);
    },
  },
  {
    id: 'space-max-beam',
    label: 'Lấp đầy không gian',
    pointSortMode: 'floor-front-center',
    scoringProfile: 'space',
    searchMode: 'beam',
    beamWidth: 5,
    branchFactor: 3,
    beamLookaheadCount: 14,
    itemComparator: (a, b) => {
      const volDiff = getVolume(b) - getVolume(a);
      if (volDiff !== 0) return volDiff;

      const footprintDiff = getFootprint(b) - getFootprint(a);
      if (footprintDiff !== 0) return footprintDiff;

      const weightDiff = Number(b.weight || 0) - Number(a.weight || 0);
      if (weightDiff !== 0) return weightDiff;

      return defaultItemComparator(a, b);
    },
  },
  {
    id: 'pct-online-policy',
    label: 'PCT Online AI',
    pointSortMode: 'pct-deep-bottom-left',
    anchorMode: 'pct-online',
    scoringProfile: 'pct',
    searchMode: 'adaptive-beam',
    allowSkipBranch: true,
    allowSoftZoneOverflow: false,
    beamWidth: 4,
    branchFactor: 2,
    beamLookaheadCount: 16,
    reorderWindow: 5,
    fillerWindow: 10,
    itemComparator: pctOnlineItemComparator,
  },
  {
    id: 'pct-flex-zone-policy',
    label: 'PCT Flex Zone AI',
    pointSortMode: 'pct-deep-bottom-left',
    anchorMode: 'pct-online',
    scoringProfile: 'pct',
    searchMode: 'adaptive-beam',
    allowSkipBranch: true,
    allowSoftZoneOverflow: true,
    beamWidth: 4,
    branchFactor: 2,
    beamLookaheadCount: 16,
    reorderWindow: 5,
    fillerWindow: 10,
    itemComparator: pctOnlineItemComparator,
  },
  {
    id: 'heavy-base',
    label: 'Nền chịu tải',
    pointSortMode: 'floor-center-front',
    scoringProfile: 'support',
    itemComparator: (a, b) => {
      if (a.fragile !== b.fragile) {
        return Number(a.fragile) - Number(b.fragile);
      }

      const weightDiff = Number(b.weight || 0) - Number(a.weight || 0);
      if (weightDiff !== 0) return weightDiff;

      const footprintDiff = getFootprint(b) - getFootprint(a);
      if (footprintDiff !== 0) return footprintDiff;

      const loadCapA = Number.isFinite(a.maxLoadAbove) ? a.maxLoadAbove : Number.MAX_SAFE_INTEGER;
      const loadCapB = Number.isFinite(b.maxLoadAbove) ? b.maxLoadAbove : Number.MAX_SAFE_INTEGER;
      if (loadCapB !== loadCapA) {
        return loadCapB - loadCapA;
      }

      return defaultItemComparator(a, b);
    },
  },
  {
    id: 'unload-friendly',
    label: 'Ưu tiên dỡ hàng',
    pointSortMode: 'front-floor-center',
    scoringProfile: 'delivery',
    itemComparator: (a, b) => {
      if (b.deliveryOrder !== a.deliveryOrder) {
        return b.deliveryOrder - a.deliveryOrder;
      }

      const specificityA = getZoneSpecificity(a.deliveryZone);
      const specificityB = getZoneSpecificity(b.deliveryZone);
      if (specificityB !== specificityA) {
        return specificityB - specificityA;
      }

      if (a.fragile !== b.fragile) {
        return Number(a.fragile) - Number(b.fragile);
      }

      const footprintDiff = getFootprint(b) - getFootprint(a);
      if (footprintDiff !== 0) return footprintDiff;

      return defaultItemComparator(a, b);
    },
  },
];

function intersects(a, b) {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const overlapZ = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);

  return !(
    overlapX <= CONTACT_EPSILON ||
    overlapY <= CONTACT_EPSILON ||
    overlapZ <= CONTACT_EPSILON
  );
}

function isInsideContainer(box, container) {
  return (
    box.x >= -EPSILON &&
    box.y >= -EPSILON &&
    box.z >= -EPSILON &&
    box.x + box.w <= container.w + EPSILON &&
    box.y + box.h <= container.h + EPSILON &&
    box.z + box.d <= container.d + EPSILON
  );
}

function getOverlapSize(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function getBaseOverlapArea(a, b) {
  const overlapX = getOverlapSize(a.x, a.x + a.w, b.x, b.x + b.w);
  const overlapZ = getOverlapSize(a.z, a.z + a.d, b.z, b.z + b.d);
  return overlapX * overlapZ;
}

function getAxisSizeKey(axis) {
  if (axis === 'x') return 'w';
  if (axis === 'y') return 'h';
  return 'd';
}

function getContainerAxisSize(container, axis) {
  if (axis === 'x') return Number(container.w || 0);
  if (axis === 'y') return Number(container.h || 0);
  return Number(container.d || 0);
}

function hasFaceOverlapForAxis(box, other, axis) {
  if (axis === 'x') {
    return (
      getOverlapSize(box.y, box.y + box.h, other.y, other.y + other.h) > CONTACT_EPSILON &&
      getOverlapSize(box.z, box.z + box.d, other.z, other.z + other.d) > CONTACT_EPSILON
    );
  }

  if (axis === 'y') {
    return (
      getOverlapSize(box.x, box.x + box.w, other.x, other.x + other.w) > CONTACT_EPSILON &&
      getOverlapSize(box.z, box.z + box.d, other.z, other.z + other.d) > CONTACT_EPSILON
    );
  }

  return (
    getOverlapSize(box.x, box.x + box.w, other.x, other.x + other.w) > CONTACT_EPSILON &&
    getOverlapSize(box.y, box.y + box.h, other.y, other.y + other.h) > CONTACT_EPSILON
  );
}

function getSupportInfo(box, placed) {
  const baseArea = box.w * box.d;

  if (box.y <= EPSILON) {
    return {
      isSupported: true,
      supportRatio: 1,
      supports: [],
    };
  }

  let supportArea = 0;
  const supports = [];

  placed.forEach((placedBox) => {
    const touchesFromBelow = Math.abs(placedBox.y + placedBox.h - box.y) <= EPSILON;
    if (!touchesFromBelow) return;

    const overlapArea = getBaseOverlapArea(box, placedBox);
    if (overlapArea <= EPSILON) return;

    supportArea += overlapArea;
    supports.push({
      ...placedBox,
      overlapArea,
    });
  });

  const supportRatio = baseArea > 0 ? supportArea / baseArea : 0;

  return {
    isSupported: supportRatio >= MIN_SUPPORT_RATIO,
    supportRatio,
    supports,
  };
}

function getDeliveryZoneRange(deliveryZone, container) {
  const zone = normalizeDeliveryZone(deliveryZone);

  if (zone === 'head') {
    return { min: 0, max: container.d / 3 };
  }

  if (zone === 'middle') {
    return { min: container.d / 3, max: (container.d * 2) / 3 };
  }

  if (zone === 'door') {
    return { min: (container.d * 2) / 3, max: container.d };
  }

  return { min: 0, max: container.d };
}

function isInsideDeliveryZone(box, container) {
  const range = getDeliveryZoneRange(box.deliveryZone, container);
  return box.z >= range.min - EPSILON && box.z + box.d <= range.max + EPSILON;
}

function getZoneOverflowRatio(box, container) {
  const zone = normalizeDeliveryZone(box.deliveryZone);
  if (zone === 'any') return 0;

  const range = getDeliveryZoneRange(zone, container);
  const zoneDepth = Math.max(EPSILON, range.max - range.min);
  const startOverflow = Math.max(0, range.min - box.z);
  const endOverflow = Math.max(0, box.z + box.d - range.max);

  return (startOverflow + endOverflow) / zoneDepth;
}

function getZonePenalty(box, container) {
  const zone = normalizeDeliveryZone(box.deliveryZone);
  if (zone === 'any') return 0;

  const range = getDeliveryZoneRange(zone, container);
  const boxCenter = box.z + box.d / 2;

  if (zone === 'head') {
    return (box.z - range.min) * 12;
  }

  if (zone === 'middle') {
    return Math.abs(boxCenter - (range.min + range.max) / 2) * 14;
  }

  return (range.max - (box.z + box.d)) * 12;
}

function getFloorAreaM2(box) {
  return ((Number(box?.w) || 0) * (Number(box?.d) || 0)) / 10000;
}

function mergeFloorContacts(contacts) {
  const map = new Map();

  contacts.forEach((contact) => {
    if (!contact?.baseId || contact.share <= EPSILON) return;
    map.set(contact.baseId, (map.get(contact.baseId) || 0) + contact.share);
  });

  return [...map.entries()].map(([baseId, share]) => ({ baseId, share }));
}

function mergeLoadContacts(contacts) {
  const map = new Map();

  contacts.forEach((contact) => {
    if (!contact?.boxId || contact.share <= EPSILON) return;
    map.set(contact.boxId, (map.get(contact.boxId) || 0) + contact.share);
  });

  return [...map.entries()].map(([boxId, share]) => ({ boxId, share }));
}

function resolveFloorContacts(box, supportInfo) {
  if (box.y <= EPSILON) {
    return [{ baseId: box.id, share: 1 }];
  }

  const totalSupportArea = supportInfo.supports.reduce(
    (sum, support) => sum + Number(support.overlapArea || 0),
    0
  );

  if (totalSupportArea <= EPSILON) {
    return [];
  }

  const weightedContacts = [];

  supportInfo.supports.forEach((support) => {
    const supportShare = Number(support.overlapArea || 0) / totalSupportArea;
    const supportContacts =
      Array.isArray(support.floorContacts) && support.floorContacts.length > 0
        ? support.floorContacts
        : [{ baseId: support.id, share: 1 }];

    supportContacts.forEach((contact) => {
      weightedContacts.push({
        baseId: contact.baseId,
        share: contact.share * supportShare,
      });
    });
  });

  return mergeFloorContacts(weightedContacts);
}

function getStackInfo(box, supportInfo) {
  const candidateLimit = resolveStackLimit(box.stackLimit);

  if (box.y <= EPSILON) {
    return {
      isValid: 1 <= candidateLimit,
      stackLevel: 1,
      columnStackLimit: candidateLimit,
    };
  }

  const parentLevel = supportInfo.supports.reduce(
    (max, support) => Math.max(max, Number(support.stackLevel || 1)),
    1
  );

  const inheritedLimit = supportInfo.supports.reduce((min, support) => {
    const limit = Number.isFinite(support.columnStackLimit)
      ? support.columnStackLimit
      : resolveStackLimit(support.stackLimit);
    return Math.min(min, limit);
  }, Infinity);

  const stackLevel = parentLevel + 1;
  const columnStackLimit = Math.min(candidateLimit, inheritedLimit);

  return {
    isValid: stackLevel <= candidateLimit + EPSILON && stackLevel <= inheritedLimit + EPSILON,
    stackLevel,
    columnStackLimit,
  };
}

function getFloorLoadInfo(box, supportInfo, placedById, floorLoadLimit) {
  const contacts = resolveFloorContacts(box, supportInfo);

  if (contacts.length === 0) {
    return {
      isValid: false,
      contacts: [],
      floorPressureUpdates: [],
      maxPressure: 0,
    };
  }

  let isValid = true;
  let maxPressure = 0;

  const floorPressureUpdates = contacts.map((contact) => {
    const isOwnFloorContact = box.y <= EPSILON && contact.baseId === box.id;
    const baseBox = isOwnFloorContact ? box : placedById.get(contact.baseId);
    const baseArea = getFloorAreaM2(baseBox);
    const currentBearingWeight = isOwnFloorContact
      ? 0
      : Number(baseBox?.floorBearingWeight || baseBox?.weight || 0);
    const nextBearing = currentBearingWeight + box.weight * contact.share;
    const nextPressure = baseArea > 0 ? nextBearing / baseArea : Infinity;

    maxPressure = Math.max(maxPressure, nextPressure);

    if (Number.isFinite(floorLoadLimit) && nextPressure > floorLoadLimit + EPSILON) {
      isValid = false;
    }

    return {
      baseId: contact.baseId,
      nextBearing,
      nextPressure,
    };
  });

  return {
    isValid,
    contacts,
    floorPressureUpdates,
    maxPressure,
  };
}

function getSupportLoadInfo(box, supportInfo, placedById) {
  if (box.y <= EPSILON) {
    return {
      isValid: true,
      loadUpdates: [],
      loadPropagationBelow: [],
    };
  }

  const totalSupportArea = supportInfo.supports.reduce(
    (sum, support) => sum + Number(support.overlapArea || 0),
    0
  );

  if (totalSupportArea <= EPSILON) {
    return {
      isValid: false,
      loadUpdates: [],
      loadPropagationBelow: [],
    };
  }

  const propagatedContacts = [];

  supportInfo.supports.forEach((support) => {
    const supportShare = Number(support.overlapArea || 0) / totalSupportArea;
    propagatedContacts.push({ boxId: support.id, share: supportShare });

    const inheritedLoads = Array.isArray(support.loadPropagationBelow)
      ? support.loadPropagationBelow
      : [];

    inheritedLoads.forEach((contact) => {
      propagatedContacts.push({
        boxId: contact.boxId,
        share: contact.share * supportShare,
      });
    });
  });

  const mergedContacts = mergeLoadContacts(propagatedContacts);
  let isValid = true;

  const loadUpdates = mergedContacts.map((contact) => {
    const supportBox = placedById.get(contact.boxId);
    const currentLoadAbove = Number(supportBox?.loadAboveKg || 0);
    const nextLoadAbove = currentLoadAbove + box.weight * contact.share;
    const maxLoadAbove = Number.isFinite(supportBox?.maxLoadAbove)
      ? supportBox.maxLoadAbove
      : resolveMaxLoadAbove(supportBox?.maxLoadAbove);

    if (Number.isFinite(maxLoadAbove) && nextLoadAbove > maxLoadAbove + EPSILON) {
      isValid = false;
    }

    return {
      boxId: contact.boxId,
      share: contact.share,
      nextLoadAbove,
    };
  });

  return {
    isValid,
    loadUpdates,
    loadPropagationBelow: mergedContacts,
  };
}

function getWeightShare(box, start, end, axis) {
  const size = axis === 'x' ? box.w : box.d;
  const from = axis === 'x' ? box.x : box.z;
  const overlap = getOverlapSize(from, from + size, start, end);
  return size > EPSILON ? overlap / size : 0;
}

function getLoadBalanceMetrics(placed, container) {
  let totalWeight = 0;
  let leftWeight = 0;
  let rightWeight = 0;
  let headWeight = 0;
  let doorWeight = 0;
  let weightedCenterX = 0;
  let weightedCenterZ = 0;

  placed.forEach((box) => {
    const weight = Number(box.weight || 0);
    if (weight <= 0) return;

    const centerX = box.x + box.w / 2 - container.w / 2;
    const centerZ = box.z + box.d / 2 - container.d / 2;
    const leftShare = getWeightShare(box, 0, container.w / 2, 'x');
    const rightShare = getWeightShare(box, container.w / 2, container.w, 'x');
    const headShare = getWeightShare(box, 0, container.d / 2, 'z');
    const doorShare = getWeightShare(box, container.d / 2, container.d, 'z');

    totalWeight += weight;
    leftWeight += weight * leftShare;
    rightWeight += weight * rightShare;
    headWeight += weight * headShare;
    doorWeight += weight * doorShare;
    weightedCenterX += centerX * weight;
    weightedCenterZ += centerZ * weight;
  });

  const sideImbalanceRatio =
    totalWeight > EPSILON ? Math.abs(leftWeight - rightWeight) / totalWeight : 0;
  const lengthImbalanceRatio =
    totalWeight > EPSILON ? Math.abs(headWeight - doorWeight) / totalWeight : 0;

  return {
    totalWeight,
    leftWeight,
    rightWeight,
    headWeight,
    doorWeight,
    sideImbalanceRatio,
    lengthImbalanceRatio,
    sideImbalancePercent: sideImbalanceRatio * 100,
    lengthImbalancePercent: lengthImbalanceRatio * 100,
    cogX: totalWeight > EPSILON ? weightedCenterX / totalWeight : 0,
    cogZ: totalWeight > EPSILON ? weightedCenterZ / totalWeight : 0,
  };
}

function getBalanceWarnings(metrics, container) {
  const warnings = [];

  if (metrics.sideImbalanceRatio > 0.12) {
    warnings.push('Tải trọng hai bên container đang lệch hơn 12% tổng tải');
  }

  if (metrics.lengthImbalanceRatio > 0.18) {
    warnings.push('Tải trọng giữa đầu và cửa container đang lệch hơn 18% tổng tải');
  }

  if (Math.abs(metrics.cogX) > container.w * 0.12) {
    warnings.push('Trọng tâm hàng đang lệch ngang khá nhiều so với tim container');
  }

  if (Math.abs(metrics.cogZ) > container.d * 0.18) {
    warnings.push('Trọng tâm hàng đang lệch dọc khá nhiều so với tim container');
  }

  return warnings;
}

function getEnvelopeMetrics(placed, container) {
  const containerVolume = Math.max(EPSILON, container.w * container.h * container.d);

  const metrics = placed.reduce(
    (acc, box) => {
      acc.maxX = Math.max(acc.maxX, box.x + box.w);
      acc.maxY = Math.max(acc.maxY, box.y + box.h);
      acc.maxZ = Math.max(acc.maxZ, box.z + box.d);
      acc.usedVolume += getVolume(box);
      return acc;
    },
    {
      maxX: 0,
      maxY: 0,
      maxZ: 0,
      usedVolume: 0,
    }
  );

  const envelopeVolume = metrics.maxX * metrics.maxY * metrics.maxZ;
  const wasteVolume = Math.max(0, envelopeVolume - metrics.usedVolume);

  return {
    ...metrics,
    envelopeVolume,
    wasteVolume,
    widthRatio: container.w > EPSILON ? metrics.maxX / container.w : 0,
    heightRatio: container.h > EPSILON ? metrics.maxY / container.h : 0,
    depthRatio: container.d > EPSILON ? metrics.maxZ / container.d : 0,
    usedRatio: metrics.usedVolume / containerVolume,
    wasteRatio: wasteVolume / containerVolume,
  };
}

function getFaceContactArea(a, b) {
  let area = 0;

  if (Math.abs(a.x + a.w - b.x) <= EPSILON || Math.abs(b.x + b.w - a.x) <= EPSILON) {
    area +=
      getOverlapSize(a.y, a.y + a.h, b.y, b.y + b.h) *
      getOverlapSize(a.z, a.z + a.d, b.z, b.z + b.d);
  }

  if (Math.abs(a.y + a.h - b.y) <= EPSILON || Math.abs(b.y + b.h - a.y) <= EPSILON) {
    area +=
      getOverlapSize(a.x, a.x + a.w, b.x, b.x + b.w) *
      getOverlapSize(a.z, a.z + a.d, b.z, b.z + b.d);
  }

  if (Math.abs(a.z + a.d - b.z) <= EPSILON || Math.abs(b.z + b.d - a.z) <= EPSILON) {
    area +=
      getOverlapSize(a.x, a.x + a.w, b.x, b.x + b.w) *
      getOverlapSize(a.y, a.y + a.h, b.y, b.y + b.h);
  }

  return area;
}

function getPlacementContactRatio(box, placed, supportInfo, container) {
  const surfaceArea = Math.max(
    EPSILON,
    2 * (box.w * box.h + box.w * box.d + box.h * box.d)
  );

  let contactArea = supportInfo.supports.reduce(
    (sum, support) => sum + Number(support.overlapArea || 0),
    0
  );

  placed.forEach((placedBox) => {
    contactArea += getFaceContactArea(box, placedBox);
  });

  if (box.x <= EPSILON) contactArea += box.h * box.d;
  if (box.y <= EPSILON) contactArea += box.w * box.d;
  if (box.z <= EPSILON) contactArea += box.w * box.h;
  if (box.x + box.w >= container.w - EPSILON) contactArea += box.h * box.d;
  if (box.y + box.h >= container.h - EPSILON) contactArea += box.w * box.d;
  if (box.z + box.d >= container.d - EPSILON) contactArea += box.w * box.h;

  return contactArea / surfaceArea;
}

function getBoundaryContactRatio(box, container) {
  const surfaceArea = Math.max(
    EPSILON,
    2 * (box.w * box.h + box.w * box.d + box.h * box.d)
  );
  let contactArea = 0;

  if (box.x <= EPSILON) contactArea += box.h * box.d;
  if (box.y <= EPSILON) contactArea += box.w * box.d;
  if (box.z <= EPSILON) contactArea += box.w * box.h;
  if (box.x + box.w >= container.w - EPSILON) contactArea += box.h * box.d;
  if (box.y + box.h >= container.h - EPSILON) contactArea += box.w * box.d;
  if (box.z + box.d >= container.d - EPSILON) contactArea += box.w * box.h;

  return contactArea / surfaceArea;
}

function getDeliveryZoneCenterPenalty(box, container) {
  const zone = normalizeDeliveryZone(box.deliveryZone);
  if (zone === 'any') return 0;

  const range = getDeliveryZoneRange(zone, container);
  const targetCenter = (range.min + range.max) / 2;
  const boxCenter = box.z + box.d / 2;
  const zoneDepth = Math.max(EPSILON, range.max - range.min);

  return Math.abs(boxCenter - targetCenter) / zoneDepth;
}

function scorePlacement(box, container, supportInfo, placed, scoringProfile = 'balance') {
  const centerX = box.x + box.w / 2;
  const balanceMetrics = getLoadBalanceMetrics([...placed, box], container);
  const envelopeMetrics = getEnvelopeMetrics([...placed, box], container);
  const contactRatio = getPlacementContactRatio(box, placed, supportInfo, container);
  const boundaryContactRatio = getBoundaryContactRatio(box, container);
  const floorCoverageRatio =
    box.y <= EPSILON ? getFootprint(box) / Math.max(EPSILON, container.w * container.d) : 0;
  const densityKgM3 = getDensity(box) * 1000000;

  const profiles = {
    balance: {
      floorPenalty: 20,
      headPenalty: 1.5,
      deliveryWeight: 0.4,
      lateralPenalty: 0.28,
      supportPenalty: 120,
      sideBalancePenalty: 180,
      lengthBalancePenalty: 95,
      cogXPenalty: 0.42,
      cogZPenalty: 0.14,
    },
    dense: {
      floorPenalty: 18,
      headPenalty: 1.1,
      deliveryWeight: 0.2,
      lateralPenalty: 0.18,
      supportPenalty: 135,
      sideBalancePenalty: 130,
      lengthBalancePenalty: 70,
      cogXPenalty: 0.22,
      cogZPenalty: 0.1,
    },
    support: {
      floorPenalty: 24,
      headPenalty: 1.25,
      deliveryWeight: 0.25,
      lateralPenalty: 0.22,
      supportPenalty: 180,
      sideBalancePenalty: 150,
      lengthBalancePenalty: 82,
      cogXPenalty: 0.28,
      cogZPenalty: 0.12,
    },
    delivery: {
      floorPenalty: 20,
      headPenalty: 2.15,
      deliveryWeight: 0.58,
      lateralPenalty: 0.18,
      supportPenalty: 130,
      sideBalancePenalty: 125,
      lengthBalancePenalty: 80,
      cogXPenalty: 0.22,
      cogZPenalty: 0.16,
    },
    space: {
      floorPenalty: 14,
      headPenalty: 0.95,
      deliveryWeight: 0.14,
      lateralPenalty: 0.12,
      supportPenalty: 115,
      sideBalancePenalty: 120,
      lengthBalancePenalty: 68,
      cogXPenalty: 0.18,
      cogZPenalty: 0.08,
      wastePenalty: 410,
      heightSpanPenalty: 135,
      depthSpanPenalty: 105,
      widthSpanPenalty: 70,
      contactBonus: 205,
    },
    pct: {
      floorPenalty: 24,
      headPenalty: 0.92,
      deliveryWeight: 0.38,
      lateralPenalty: 0.16,
      supportPenalty: 178,
      sideBalancePenalty: 152,
      lengthBalancePenalty: 92,
      cogXPenalty: 0.25,
      cogZPenalty: 0.13,
      wastePenalty: 355,
      heightSpanPenalty: 158,
      depthSpanPenalty: 96,
      widthSpanPenalty: 82,
      contactBonus: 265,
      boundaryContactBonus: 120,
      floorCoverageBonus: 170,
      densityBaseBonus: 0.018,
      zoneCenterPenalty: 54,
      zoneOverflowPenalty: 980,
    },
  };

  const profile = profiles[scoringProfile] || profiles.balance;
  const lateralBalancePenalty = Math.abs(centerX - container.w / 2) * profile.lateralPenalty;
  const floorPenalty = box.y * profile.floorPenalty;
  const headPenalty =
    box.z * (profile.headPenalty + Number(box.deliveryOrder || 1) * profile.deliveryWeight);
  const supportPenalty =
    box.y > EPSILON ? (1 - supportInfo.supportRatio) * profile.supportPenalty : 0;
  const balancePenalty =
    balanceMetrics.sideImbalanceRatio * profile.sideBalancePenalty +
    balanceMetrics.lengthImbalanceRatio * profile.lengthBalancePenalty +
    Math.abs(balanceMetrics.cogX) * profile.cogXPenalty +
    Math.abs(balanceMetrics.cogZ) * profile.cogZPenalty;
  const envelopePenalty =
    (envelopeMetrics.wasteRatio || 0) * (profile.wastePenalty || 0) +
    (envelopeMetrics.heightRatio || 0) * (profile.heightSpanPenalty || 0) +
    (envelopeMetrics.depthRatio || 0) * (profile.depthSpanPenalty || 0) +
    (envelopeMetrics.widthRatio || 0) * (profile.widthSpanPenalty || 0);
  const contactBonus =
    contactRatio * (profile.contactBonus || 0) +
    boundaryContactRatio * (profile.boundaryContactBonus || 0) +
    floorCoverageRatio * (profile.floorCoverageBonus || 0) +
    (box.y <= EPSILON ? densityKgM3 * (profile.densityBaseBonus || 0) : 0);
  const zoneCenterPenalty = getDeliveryZoneCenterPenalty(box, container) * (profile.zoneCenterPenalty || 0);
  const zoneOverflowPenalty = getZoneOverflowRatio(box, container) * (profile.zoneOverflowPenalty || 0);

  return (
    contactBonus -
    (
    floorPenalty +
    headPenalty +
    lateralBalancePenalty +
    supportPenalty +
    getZonePenalty(box, container) +
      zoneCenterPenalty +
      zoneOverflowPenalty +
      balancePenalty +
      envelopePenalty
    )
  );
}

function expandBoxTypes(boxTypes) {
  const items = [];

  boxTypes.forEach((type, idx) => {
    const normalized = normalizeBoxType(type, idx);
    const qty = Math.max(0, Number(normalized.qty || 0));

    for (let i = 0; i < qty; i++) {
      items.push({
        ...normalized,
        id: `${normalized.itemId}-${i + 1}`,
      });
    }
  });

  return items;
}

function summarizeRejectedItems(items) {
  const map = new Map();

  items.forEach((item) => {
    const normalized = normalizeBoxType(item, item.typeIndex ?? 0);
    const reason = item.reason || '';
    const stackLimitKey = Number.isFinite(normalized.stackLimit) ? normalized.stackLimit : 'inf';
    const maxLoadAboveKey = Number.isFinite(normalized.maxLoadAbove)
      ? normalized.maxLoadAbove
      : 'inf';
    const key = [
      normalized.label,
      normalized.w,
      normalized.h,
      normalized.d,
      normalized.weight,
      normalized.priorityGroup,
      normalized.allowRotate ? 1 : 0,
      normalized.noStack ? 1 : 0,
      normalized.noTilt ? 1 : 0,
      stackLimitKey,
      maxLoadAboveKey,
      normalized.deliveryZone || 'any',
      reason,
    ].join('|');

    if (!map.has(key)) {
      map.set(key, {
        label: normalized.label,
        w: normalized.w,
        h: normalized.h,
        d: normalized.d,
        weight: normalized.weight,
        allowRotate: normalized.allowRotate,
        noStack: normalized.noStack,
        noTilt: normalized.noTilt,
        priorityGroup: normalized.priorityGroup,
        deliveryOrder: normalized.deliveryOrder,
        rotationMode: normalized.rotationMode,
        fragile: normalized.fragile,
        stackLimit: normalized.stackLimit,
        maxLoadAbove: normalized.maxLoadAbove,
        deliveryZone: normalized.deliveryZone || 'any',
        reason,
        count: 0,
      });
    }

    map.get(key).count += 1;
  });

  return [...map.values()].sort((a, b) => b.count - a.count);
}

function getPointComparator(mode, container) {
  const centerX = container.w / 2;

  if (mode === 'floor-center-front') {
    return (a, b) =>
      a.y - b.y ||
      Math.abs(a.x - centerX) - Math.abs(b.x - centerX) ||
      a.z - b.z ||
      a.x - b.x;
  }

  if (mode === 'floor-front-center') {
    return (a, b) =>
      a.y - b.y ||
      a.z - b.z ||
      Math.abs(a.x - centerX) - Math.abs(b.x - centerX) ||
      a.x - b.x;
  }

  if (mode === 'front-floor-center') {
    return (a, b) =>
      a.z - b.z ||
      a.y - b.y ||
      Math.abs(a.x - centerX) - Math.abs(b.x - centerX) ||
      a.x - b.x;
  }

  if (mode === 'pct-deep-bottom-left') {
    return (a, b) =>
      a.y - b.y ||
      a.z - b.z ||
      a.x - b.x ||
      Math.abs(a.x - centerX) - Math.abs(b.x - centerX);
  }

  return (a, b) => a.y - b.y || a.z - b.z || a.x - b.x;
}

function normalizeCandidatePoints(points, placed, container, pointSortMode = 'floor-front-left') {
  const seen = new Set();
  const pointComparator = getPointComparator(pointSortMode, container);

  return points
    .filter(
      (point) =>
        point.x <= container.w + EPSILON &&
        point.y <= container.h + EPSILON &&
        point.z <= container.d + EPSILON
    )
    .filter((point) => {
      const key = `${point.x.toFixed(4)}|${point.y.toFixed(4)}|${point.z.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter(
      (point) =>
        !placed.some(
          (box) =>
            point.x > box.x + EPSILON &&
            point.x < box.x + box.w - EPSILON &&
            point.y > box.y + EPSILON &&
            point.y < box.y + box.h - EPSILON &&
            point.z > box.z + EPSILON &&
            point.z < box.z + box.d - EPSILON
        )
    )
    .sort(pointComparator);
}

function convertPlacedToCenteredCoords(placed, container) {
  return placed.map((box) => ({
    ...clonePlacementBox(box),
    x: box.x - container.w / 2,
    z: box.z - container.d / 2,
  }));
}

function convertPlacedFromCenteredCoords(placed, container) {
  return placed.map((box) => ({
    ...clonePlacementBox(box),
    x: box.x + container.w / 2,
    z: box.z + container.d / 2,
  }));
}

function sortPlacedForEvaluation(placed) {
  return [...placed].sort((a, b) => {
    if (Math.abs(a.y - b.y) > EPSILON) return a.y - b.y;
    if (Math.abs(a.z - b.z) > EPSILON) return a.z - b.z;
    if (Math.abs(a.x - b.x) > EPSILON) return a.x - b.x;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

function evaluateFixedLayout({
  placed,
  container,
  floorLoadLimit,
}) {
  const evaluated = [];
  const placedById = new Map();

  for (const rawBox of sortPlacedForEvaluation(placed)) {
    const candidate = clonePlacementBox(rawBox);

    if (!fitsInside(container, candidate)) {
      return { isValid: false, reason: 'Compaction đẩy item ra ngoài container' };
    }

    if (collides(candidate, evaluated)) {
      return { isValid: false, reason: 'Compaction tạo va chạm giữa các item' };
    }

    const supportCheck = hasSupport(candidate, evaluated);
    if (!supportCheck.isValid) {
      return { isValid: false, reason: supportCheck.reason };
    }

    const ruleCheck = violatesRules({
      placement: candidate,
      box: candidate,
      container,
      supportInfo: supportCheck.supportInfo,
      placedById,
      floorLoadLimit,
    });

    if (!ruleCheck.isValid) {
      return { isValid: false, reason: ruleCheck.reason };
    }

    const evaluatedPlacement = buildPlacementState(
      candidate,
      supportCheck.supportInfo,
      ruleCheck,
      Number(candidate.score || 0)
    );

    evaluated.push(evaluatedPlacement);
    placedById.set(evaluatedPlacement.id, evaluatedPlacement);
    applyPlacementStateUpdates(evaluatedPlacement, placedById);
  }

  return {
    isValid: true,
    placed: evaluated,
  };
}

function getFaceSnapTargets(box, placed, container, axis, snapTolerance = FACE_SNAP_TOLERANCE) {
  const sizeKey = getAxisSizeKey(axis);
  const containerSize = getContainerAxisSize(container, axis);
  const currentValue = Number(box[axis] || 0);
  const candidates = [0, containerSize - Number(box[sizeKey] || 0)];

  placed.forEach((other) => {
    if (other.id === box.id) return;
    if (!hasFaceOverlapForAxis(box, other, axis)) return;

    candidates.push(
      Number(other[axis] || 0) + Number(other[sizeKey] || 0),
      Number(other[axis] || 0) - Number(box[sizeKey] || 0)
    );
  });

  const uniqueCandidates = [...new Set(candidates.map((value) => Number(value.toFixed(6))))];

  return uniqueCandidates
    .filter((value) => Math.abs(value - currentValue) > CONTACT_EPSILON)
    .filter((value) => Math.abs(value - currentValue) <= snapTolerance + EPSILON)
    .filter(
      (value) =>
        value >= -EPSILON &&
        value + Number(box[sizeKey] || 0) <= containerSize + EPSILON
    )
    .sort((a, b) => Math.abs(a - currentValue) - Math.abs(b - currentValue));
}

function snapPackedLayoutToFaces({
  placed,
  container,
  floorLoadLimit,
  snapTolerance = FACE_SNAP_TOLERANCE,
  maxPasses = 3,
}) {
  const initialLayout = evaluateFixedLayout({
    placed,
    container,
    floorLoadLimit,
  });

  if (!initialLayout.isValid) {
    return initialLayout;
  }

  let working = initialLayout.placed.map(clonePlacementBox);

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    const orderedIds = sortPlacedForEvaluation(working).map((box) => box.id);

    for (const boxId of orderedIds) {
      for (const axis of ['x', 'z']) {
        const currentIndex = working.findIndex((box) => box.id === boxId);
        if (currentIndex < 0) continue;

        const currentBox = working[currentIndex];
        const snapTargets = getFaceSnapTargets(
          currentBox,
          working,
          container,
          axis,
          snapTolerance
        );

        let snapped = false;

        for (const target of snapTargets) {
          const trial = working.map(clonePlacementBox);
          const trialIndex = trial.findIndex((box) => box.id === boxId);
          if (trialIndex < 0) continue;

          trial[trialIndex][axis] = target;

          const validated = evaluateFixedLayout({
            placed: trial,
            container,
            floorLoadLimit,
          });

          if (!validated.isValid) continue;

          working = validated.placed.map(clonePlacementBox);
          changed = true;
          snapped = true;
          break;
        }

        if (snapped) continue;
      }
    }

    if (!changed) break;
  }

  return evaluateFixedLayout({
    placed: working,
    container,
    floorLoadLimit,
  });
}

function compactPackedLayout({
  placed,
  container,
  floorLoadLimit,
}) {
  const compactedCentered = compactPlacedLayout(
    convertPlacedToCenteredCoords(placed, container),
    container,
    {
      step: 1,
      maxPasses: 40,
      compactFloor: true,
      compactFront: true,
      compactLeft: true,
      preserveSupport: true,
    }
  );

  return evaluateFixedLayout({
    placed: convertPlacedFromCenteredCoords(compactedCentered, container),
    container,
    floorLoadLimit,
  });
}

function sortBoxes(items, strategy = STRATEGY_PRESETS[0]) {
  return [...items].sort(strategy.itemComparator || defaultItemComparator);
}

function fitsInside(container, placement) {
  return isInsideContainer(placement, container);
}

function collides(placement, placed) {
  return placed.some((placedBox) => intersects(placement, placedBox));
}

function hasAnyOverlap(placed) {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (intersects(placed[i], placed[j])) {
        return true;
      }
    }
  }

  return false;
}

function hasSupport(placement, placed) {
  const supportInfo = getSupportInfo(placement, placed);

  return {
    isValid: supportInfo.isSupported,
    reason: supportInfo.isSupported ? '' : 'Không đủ mặt đỡ để xếp chồng ổn định',
    supportInfo,
  };
}

function violatesRules({
  placement,
  box,
  container,
  supportInfo,
  placedById,
  floorLoadLimit,
}) {
  if (!isInsideDeliveryZone(placement, container) && !placement.softZoneOverflowAllowed) {
    return { isValid: false, reason: 'Không đúng vùng xếp ưu tiên' };
  }

  if (box.noStack && placement.y > EPSILON) {
    return { isValid: false, reason: 'Item noStack chỉ được đặt trực tiếp trên sàn' };
  }

  if (supportInfo.supports.some((support) => support.noStack || support.fragile)) {
    return { isValid: false, reason: 'Không được đặt lên item đang bật noStack' };
  }

  const violatesPriorityStacking = supportInfo.supports.some(
    (support) => Number(support.priorityGroup || support.deliveryOrder || 1) < Number(box.priorityGroup || 1)
  );

  if (violatesPriorityStacking) {
    return { isValid: false, reason: 'Vi phạm thứ tự ưu tiên giữa các lớp xếp chồng' };
  }

  const stackInfo = getStackInfo(placement, supportInfo);
  if (!stackInfo.isValid) {
    return {
      isValid: false,
      reason: box.noStack ? 'Item noStack không cho phép chồng lớp' : 'Vượt giới hạn stack của cột xếp',
    };
  }

  const floorLoadInfo = getFloorLoadInfo(placement, supportInfo, placedById, floorLoadLimit);
  if (!floorLoadInfo.isValid) {
    return { isValid: false, reason: 'Vượt tải sàn container' };
  }

  const supportLoadInfo = getSupportLoadInfo(placement, supportInfo, placedById);
  if (!supportLoadInfo.isValid) {
    return { isValid: false, reason: 'Vượt tải đè cho phép của item đỡ phía dưới' };
  }

  return {
    isValid: true,
    reason: '',
    stackInfo,
    floorLoadInfo,
    supportLoadInfo,
  };
}

function buildPlacementState(candidate, supportInfo, ruleCheck, score = 0) {
  return {
    ...candidate,
    score,
    supportRatio: supportInfo.supportRatio,
    stackLevel: ruleCheck.stackInfo.stackLevel,
    columnStackLimit: ruleCheck.stackInfo.columnStackLimit,
    floorContacts: ruleCheck.floorLoadInfo.contacts,
    floorLoadUpdates: ruleCheck.floorLoadInfo.floorPressureUpdates,
    floorBearingWeight: 0,
    floorPressureKgM2: 0,
    loadUpdates: ruleCheck.supportLoadInfo.loadUpdates,
    loadAboveKg: 0,
    loadPropagationBelow: ruleCheck.supportLoadInfo.loadPropagationBelow,
  };
}

function applyPlacementStateUpdates(placement, placedById) {
  placement.floorLoadUpdates.forEach((update) => {
    const baseBox = placedById.get(update.baseId);
    if (!baseBox) return;
    baseBox.floorBearingWeight = update.nextBearing;
    baseBox.floorPressureKgM2 = update.nextPressure;
  });

  placement.loadUpdates.forEach((update) => {
    const supportBox = placedById.get(update.boxId);
    if (!supportBox) return;
    supportBox.loadAboveKg = update.nextLoadAbove;
  });
}

function buildPlacementCandidate(item, orientation, point, nextPlacementId, strategy = {}) {
  return {
    id: item.id || `placement-${nextPlacementId}`,
    x: point.x,
    y: point.y,
    z: point.z,
    w: orientation.w,
    h: orientation.h,
    d: orientation.d,
    weight: item.weight,
    label: item.label,
    typeIndex: item.typeIndex,
    itemId: item.itemId,
    originalSize: {
      w: item.w,
      h: item.h,
      d: item.d,
    },
    allowRotate: item.allowRotate,
    noStack: item.noStack,
    noTilt: item.noTilt,
    priorityGroup: item.priorityGroup,
    deliveryOrder: item.deliveryOrder,
    rotationMode: item.rotationMode,
    fragile: item.fragile,
    stackLimit: item.stackLimit,
    maxLoadAbove: item.maxLoadAbove,
    deliveryZone: item.deliveryZone,
    softZoneOverflowAllowed: Boolean(strategy.allowSoftZoneOverflow),
  };
}

function comparePlacementCandidates(candidate, currentBest) {
  const comparisons = [
    candidate.score - currentBest.score,
    (candidate.supportRatio || 0) - (currentBest.supportRatio || 0),
    currentBest.y - candidate.y,
    currentBest.z - candidate.z,
    currentBest.x - candidate.x,
  ];

  for (const value of comparisons) {
    if (Math.abs(value) > EPSILON) {
      return value > 0 ? 1 : -1;
    }
  }

  return 0;
}

function buildPctAnchorPoints({ item, orientation, placed, container }) {
  const zoneRange = getDeliveryZoneRange(item.deliveryZone, container);
  const maxX = Math.max(0, container.w - orientation.w);
  const minZ = clampNumber(zoneRange.min, 0, Math.max(0, container.d - orientation.d));
  const maxZ = clampNumber(
    zoneRange.max - orientation.d,
    minZ,
    Math.max(minZ, container.d - orientation.d)
  );
  const centerZ = clampNumber((zoneRange.min + zoneRange.max - orientation.d) / 2, minZ, maxZ);
  const centerX = maxX / 2;
  const xAnchors = [0, maxX, centerX, centerX * 0.5, centerX + maxX * 0.25]
    .map((value) => clampNumber(value, 0, maxX));
  const zAnchors = [minZ, maxZ, centerZ];
  const layerHeights = [0];

  placed.forEach((box) => {
    const top = Number(box.y || 0) + Number(box.h || 0);
    if (top + orientation.h <= container.h + EPSILON) {
      layerHeights.push(top);
    }
  });

  const uniqueLayers = [...new Set(layerHeights.map((value) => Number(value.toFixed(4))))]
    .sort((a, b) => a - b)
    .slice(0, 8);
  const anchors = [];

  uniqueLayers.forEach((y) => {
    xAnchors.forEach((x) => {
      zAnchors.forEach((z) => {
        anchors.push({ x, y, z });
      });
    });
  });

  return anchors;
}

function getCandidatePointsForOrientation({
  item,
  orientation,
  placed,
  candidatePoints,
  container,
  strategy,
}) {
  if (strategy.anchorMode !== 'pct-online') {
    return candidatePoints;
  }

  return normalizeCandidatePoints(
    [
      ...candidatePoints,
      ...buildPctAnchorPoints({
        item,
        orientation,
        placed,
        container,
      }),
    ],
    placed,
    container,
    strategy.pointSortMode
  );
}

function enumeratePlacementCandidates({
  item,
  placed,
  candidatePoints,
  placedById,
  container,
  strategy,
  floorLoadLimit,
  nextPlacementId,
}) {
  const placements = [];
  const constraintReasons = new Set();
  const orientations = getAllowedOrientations(item);

  for (const orientation of orientations) {
    const pointsForOrientation = getCandidatePointsForOrientation({
      item,
      orientation,
      placed,
      candidatePoints,
      container,
      strategy,
    });

    for (const point of pointsForOrientation) {
      const candidate = buildPlacementCandidate(item, orientation, point, nextPlacementId, strategy);

      if (!fitsInside(container, candidate)) continue;
      if (collides(candidate, placed)) continue;

      const supportCheck = hasSupport(candidate, placed);
      if (!supportCheck.isValid) {
        constraintReasons.add(supportCheck.reason);
        continue;
      }

      const ruleCheck = violatesRules({
        placement: candidate,
        box: item,
        container,
        supportInfo: supportCheck.supportInfo,
        placedById,
        floorLoadLimit,
      });

      if (!ruleCheck.isValid) {
        constraintReasons.add(ruleCheck.reason);
        continue;
      }

      const score = scorePlacement(
        candidate,
        container,
        supportCheck.supportInfo,
        placed,
        strategy.scoringProfile
      );

      placements.push(
        buildPlacementState(candidate, supportCheck.supportInfo, ruleCheck, score)
      );
    }
  }

  placements.sort((a, b) => comparePlacementCandidates(a, b) * -1);

  return {
    placements,
    constraintReasons,
  };
}

function deriveCandidatePointsFromPlaced(placed, container, pointSortMode = 'floor-front-left') {
  const rawPoints = [{ x: 0, y: 0, z: 0 }];

  placed.forEach((placement) => {
    rawPoints.push(
      { x: placement.x + placement.w, y: placement.y, z: placement.z },
      { x: placement.x, y: placement.y + placement.h, z: placement.z },
      { x: placement.x, y: placement.y, z: placement.z + placement.d },
      { x: placement.x + placement.w, y: placement.y + placement.h, z: placement.z },
      { x: placement.x + placement.w, y: placement.y, z: placement.z + placement.d },
      { x: placement.x, y: placement.y + placement.h, z: placement.z + placement.d },
      {
        x: placement.x + placement.w,
        y: placement.y + placement.h,
        z: placement.z + placement.d,
      }
    );
  });

  return normalizeCandidatePoints(rawPoints, placed, container, pointSortMode);
}

function repairPackedLayout({
  placed,
  rejectedBySpace,
  rejectedByConstraint,
  rejectedByWeight,
  totalPlacedWeight,
  strategy,
  container,
  maxWeight,
  floorLoadLimit,
}) {
  const evaluatedLayout = evaluateFixedLayout({
    placed,
    container,
    floorLoadLimit,
  });

  if (!evaluatedLayout.isValid) {
    return { isValid: false, reason: evaluatedLayout.reason };
  }

  const workingPlaced = evaluatedLayout.placed.map(clonePlacementBox);
  const placedById = new Map(workingPlaced.map((box) => [box.id, box]));
  const pendingItems = sortBoxes(
    [...rejectedByConstraint, ...rejectedBySpace].map((item) =>
      normalizeBoxType(item, item.typeIndex ?? 0)
    ),
    strategy
  );

  let candidatePoints = deriveCandidatePointsFromPlaced(
    workingPlaced,
    container,
    strategy.pointSortMode
  );
  let workingWeight = totalPlacedWeight;
  let nextPlacementId = workingPlaced.length + 1;

  const nextRejectedBySpace = [];
  const nextRejectedByConstraint = [];
  const nextRejectedByWeight = [...rejectedByWeight];

  for (const item of pendingItems) {
    if (workingWeight + item.weight > maxWeight) {
      nextRejectedByWeight.push(item);
      continue;
    }

    const { placements, constraintReasons } = enumeratePlacementCandidates({
      item,
      placed: workingPlaced,
      candidatePoints,
      placedById,
      container,
      strategy,
      floorLoadLimit,
      nextPlacementId,
    });

    const bestPlacement = placements[0];

    if (!bestPlacement) {
      if (constraintReasons.size > 0) {
        nextRejectedByConstraint.push({
          ...item,
          reason: [...constraintReasons].slice(0, 2).join(' / '),
        });
      } else {
        nextRejectedBySpace.push(item);
      }
      continue;
    }

    workingPlaced.push(bestPlacement);
    placedById.set(bestPlacement.id, bestPlacement);
    workingWeight += item.weight;
    applyPlacementStateUpdates(bestPlacement, placedById);
    candidatePoints = updateCandidatePoints(
      candidatePoints,
      bestPlacement,
      workingPlaced,
      container,
      strategy.pointSortMode
    );
    nextPlacementId += 1;
  }

  return {
    isValid: true,
    placed: workingPlaced,
    totalPlacedWeight: workingWeight,
    rejectedBySpace: nextRejectedBySpace,
    rejectedByConstraint: nextRejectedByConstraint,
    rejectedByWeight: nextRejectedByWeight,
  };
}

function createPackingState() {
  return {
    placed: [],
    placedById: new Map(),
    candidatePoints: [{ x: 0, y: 0, z: 0 }],
    totalPlacedWeight: 0,
    rejectedBySpace: [],
    rejectedByWeight: [],
    rejectedByConstraint: [],
    nextPlacementId: 1,
    searchScore: 0,
  };
}

function clonePackingState(state) {
  const placed = state.placed.map(clonePlacementBox);

  return {
    placed,
    placedById: new Map(placed.map((box) => [box.id, box])),
    candidatePoints: state.candidatePoints.map((point) => ({ ...point })),
    totalPlacedWeight: state.totalPlacedWeight,
    rejectedBySpace: state.rejectedBySpace.map((item) => ({ ...item })),
    rejectedByWeight: state.rejectedByWeight.map((item) => ({ ...item })),
    rejectedByConstraint: state.rejectedByConstraint.map((item) => ({ ...item })),
    nextPlacementId: state.nextPlacementId,
    searchScore: state.searchScore,
  };
}

function createAdaptivePackingState(items) {
  return {
    ...createPackingState(),
    remainingItems: items.map((item, index) => normalizeBoxType(item, item.typeIndex ?? index)),
  };
}

function cloneAdaptivePackingState(state) {
  return {
    ...clonePackingState(state),
    remainingItems: (state.remainingItems || []).map((item) => ({ ...item })),
  };
}

function scorePackingState(state, container) {
  const envelopeMetrics = getEnvelopeMetrics(state.placed, container);
  const balanceMetrics = getLoadBalanceMetrics(state.placed, container);

  return (
    state.placed.length * 200000 +
    envelopeMetrics.usedRatio * 120000 -
    envelopeMetrics.wasteRatio * 45000 -
    envelopeMetrics.heightRatio * 7000 -
    envelopeMetrics.depthRatio * 5000 -
    envelopeMetrics.widthRatio * 3500 -
    balanceMetrics.sideImbalancePercent * 180 -
    balanceMetrics.lengthImbalancePercent * 120 -
    state.rejectedByConstraint.length * 4000 -
    state.rejectedBySpace.length * 2200 -
    state.rejectedByWeight.length * 1400 +
    state.searchScore
  );
}

function getPackingStateSignature(state) {
  const placedKey = [...state.placed]
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
    .map(
      (box) =>
        `${box.id}:${box.x.toFixed(1)},${box.y.toFixed(1)},${box.z.toFixed(1)},${box.w}x${box.h}x${box.d}`
    )
    .join('|');

  return [
    placedKey,
    `s${state.rejectedBySpace.length}`,
    `c${state.rejectedByConstraint.length}`,
    `w${state.rejectedByWeight.length}`,
  ].join('||');
}

function getSkipBranchPenalty(item) {
  return (
    8500 +
    Number(item.priorityGroup || item.deliveryOrder || 1) * 2600 +
    getPackingDifficulty(item) * 0.32 +
    getVolume(item) / 220
  );
}

function getRejectedItemPenalty(item, reason = 'space') {
  const reasonMultiplier = reason === 'weight' ? 0.65 : reason === 'constraint' ? 1.35 : 1;

  return getSkipBranchPenalty(item) * reasonMultiplier;
}

function removeRemainingItemAt(items, removeIndex) {
  return items.filter((_, index) => index !== removeIndex);
}

function getAdaptiveItemChoices(remainingItems, strategy) {
  const reorderWindow = Math.max(
    1,
    Math.min(Number(strategy.reorderWindow || 4), remainingItems.length)
  );
  const fillerWindow = Math.max(
    reorderWindow,
    Math.min(Number(strategy.fillerWindow || reorderWindow), remainingItems.length)
  );
  const choices = remainingItems.slice(0, reorderWindow).map((item, index) => ({
    item,
    itemIndex: index,
  }));
  const seen = new Set(choices.map((choice) => choice.item.id));

  const fillerChoice = remainingItems
    .slice(reorderWindow, fillerWindow)
    .map((item, index) => ({
      item,
      itemIndex: reorderWindow + index,
      score: getFootprint(item) + getVolume(item) / 5000 - getPackingDifficulty(item) * 0.18,
    }))
    .sort((a, b) => a.score - b.score)[0];

  if (fillerChoice && !seen.has(fillerChoice.item.id)) {
    choices.push({
      item: fillerChoice.item,
      itemIndex: fillerChoice.itemIndex,
    });
  }

  return choices;
}

function pruneBeamStates(states, container, beamWidth) {
  const bestBySignature = new Map();

  states.forEach((state) => {
    const signature = getPackingStateSignature(state);
    const score = scorePackingState(state, container);
    const current = bestBySignature.get(signature);

    if (!current || score > current.score) {
      bestBySignature.set(signature, { state, score });
    }
  });

  return [...bestBySignature.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, beamWidth)
    .map((entry) => entry.state);
}

function runAdaptiveReorderBeamPack({
  container,
  boxes,
  strategy,
  maxWeight,
  floorLoadLimit,
}) {
  const itemCount = boxes.length;
  const beamWidth = Math.max(
    2,
    Math.min(Number(strategy.beamWidth || 4), itemCount > 36 ? 5 : 7)
  );
  const branchFactor = Math.max(
    2,
    Math.min(Number(strategy.branchFactor || 2), itemCount > 30 ? 2 : 3)
  );
  const beamLookaheadCount = Math.max(
    4,
    Math.min(Number(strategy.beamLookaheadCount || 14), itemCount)
  );

  let states = [createAdaptivePackingState(boxes)];

  for (let step = 0; step < itemCount; step++) {
    const nextStates = [];

    states.forEach((state) => {
      if (!state.remainingItems?.length) {
        nextStates.push(state);
        return;
      }

      const activeBranchFactor = step < beamLookaheadCount ? branchFactor : 1;
      const choices = getAdaptiveItemChoices(state.remainingItems, strategy);

      choices.forEach(({ item, itemIndex }) => {
        const remainingAfterChoice = removeRemainingItemAt(state.remainingItems, itemIndex);

        if (state.totalPlacedWeight + item.weight > maxWeight) {
          const nextState = cloneAdaptivePackingState(state);
          nextState.remainingItems = remainingAfterChoice;
          nextState.rejectedByWeight.push(item);
          nextState.searchScore -= getRejectedItemPenalty(item, 'weight');
          nextStates.push(nextState);
          return;
        }

        const { placements, constraintReasons } = enumeratePlacementCandidates({
          item,
          placed: state.placed,
          candidatePoints: state.candidatePoints,
          placedById: state.placedById,
          container,
          strategy,
          floorLoadLimit,
          nextPlacementId: state.nextPlacementId,
        });

        if (placements.length === 0) {
          const nextState = cloneAdaptivePackingState(state);
          const rejectedItem =
            constraintReasons.size > 0
              ? {
                  ...item,
                  reason: [...constraintReasons].slice(0, 2).join(' / '),
                }
              : item;

          nextState.remainingItems = remainingAfterChoice;

          if (constraintReasons.size > 0) {
            nextState.rejectedByConstraint.push(rejectedItem);
            nextState.searchScore -= getRejectedItemPenalty(item, 'constraint');
          } else {
            nextState.rejectedBySpace.push(rejectedItem);
            nextState.searchScore -= getRejectedItemPenalty(item, 'space');
          }

          nextStates.push(nextState);
          return;
        }

        if (
          strategy.allowSkipBranch &&
          step < beamLookaheadCount &&
          state.remainingItems.length > 1 &&
          itemIndex === 0
        ) {
          const skippedState = cloneAdaptivePackingState(state);
          skippedState.remainingItems = remainingAfterChoice;
          skippedState.rejectedBySpace.push({
            ...item,
            reason: 'PCT adaptive beam: bỏ nhánh item này để tránh khóa layout tổng thể',
          });
          skippedState.searchScore -= getSkipBranchPenalty(item);
          nextStates.push(skippedState);
        }

        placements.slice(0, activeBranchFactor).forEach((placement) => {
          const nextState = cloneAdaptivePackingState(state);
          const appliedPlacement = clonePlacementBox(placement);

          nextState.remainingItems = remainingAfterChoice;
          nextState.placed.push(appliedPlacement);
          nextState.placedById.set(appliedPlacement.id, appliedPlacement);
          nextState.totalPlacedWeight += item.weight;
          nextState.searchScore +=
            appliedPlacement.score +
            getPackingDifficulty(item) * 0.12 +
            Number(item.priorityGroup || item.deliveryOrder || 1) * 180;
          applyPlacementStateUpdates(appliedPlacement, nextState.placedById);
          nextState.candidatePoints = updateCandidatePoints(
            nextState.candidatePoints,
            appliedPlacement,
            nextState.placed,
            container,
            strategy.pointSortMode
          );
          nextState.nextPlacementId += 1;

          nextStates.push(nextState);
        });
      });
    });

    states = pruneBeamStates(nextStates, container, beamWidth);

    if (states.every((state) => !state.remainingItems?.length)) {
      break;
    }
  }

  const bestState = states.reduce((best, state) => {
    if (!best) return state;
    return scorePackingState(state, container) > scorePackingState(best, container)
      ? state
      : best;
  }, null);

  return {
    placed: bestState?.placed || [],
    rejectedBySpace: bestState?.rejectedBySpace || [],
    rejectedByWeight: bestState?.rejectedByWeight || [],
    rejectedByConstraint: bestState?.rejectedByConstraint || [],
    totalPlacedWeight: bestState?.totalPlacedWeight || 0,
  };
}

function runBeamPack({
  container,
  boxes,
  strategy,
  maxWeight,
  floorLoadLimit,
}) {
  const itemCount = boxes.length;
  const beamWidth = Math.max(
    2,
    Math.min(Number(strategy.beamWidth || 4), itemCount > 28 ? 4 : 6)
  );
  const branchFactor = Math.max(
    2,
    Math.min(Number(strategy.branchFactor || 2), itemCount > 24 ? 2 : 3)
  );
  const beamLookaheadCount = Math.max(
    4,
    Math.min(Number(strategy.beamLookaheadCount || 12), itemCount)
  );

  let states = [createPackingState()];

  for (let index = 0; index < boxes.length; index++) {
    const item = normalizeBoxType(boxes[index], boxes[index].typeIndex ?? 0);
    const nextStates = [];
    const activeBranchFactor = index < beamLookaheadCount ? branchFactor : 1;

    states.forEach((state) => {
      if (state.totalPlacedWeight + item.weight > maxWeight) {
        const nextState = clonePackingState(state);
        nextState.rejectedByWeight.push(item);
        nextStates.push(nextState);
        return;
      }

      const { placements, constraintReasons } = enumeratePlacementCandidates({
        item,
        placed: state.placed,
        candidatePoints: state.candidatePoints,
        placedById: state.placedById,
        container,
        strategy,
        floorLoadLimit,
        nextPlacementId: state.nextPlacementId,
      });

      if (placements.length === 0) {
        const nextState = clonePackingState(state);

        if (constraintReasons.size > 0) {
          nextState.rejectedByConstraint.push({
            ...item,
            reason: [...constraintReasons].slice(0, 2).join(' / '),
          });
        } else {
          nextState.rejectedBySpace.push(item);
        }

        nextStates.push(nextState);
        return;
      }

      if (strategy.allowSkipBranch && index < beamLookaheadCount && index < boxes.length - 1) {
        const skippedState = clonePackingState(state);
        skippedState.rejectedBySpace.push({
          ...item,
          reason: 'PCT skip branch: bỏ tạm item này để thử nghiệm bố cục tổng thể tốt hơn',
        });
        skippedState.searchScore -= getSkipBranchPenalty(item);
        nextStates.push(skippedState);
      }

      placements.slice(0, activeBranchFactor).forEach((placement) => {
        const nextState = clonePackingState(state);
        const appliedPlacement = clonePlacementBox(placement);

        nextState.placed.push(appliedPlacement);
        nextState.placedById.set(appliedPlacement.id, appliedPlacement);
        nextState.totalPlacedWeight += item.weight;
        nextState.searchScore += appliedPlacement.score;
        applyPlacementStateUpdates(appliedPlacement, nextState.placedById);
        nextState.candidatePoints = updateCandidatePoints(
          nextState.candidatePoints,
          appliedPlacement,
          nextState.placed,
          container,
          strategy.pointSortMode
        );
        nextState.nextPlacementId += 1;

        nextStates.push(nextState);
      });
    });

    states = pruneBeamStates(nextStates, container, beamWidth);

    if (states.length === 0) {
      states = [createPackingState()];
    }
  }

  const bestState = states.reduce((best, state) => {
    if (!best) return state;
    return scorePackingState(state, container) > scorePackingState(best, container)
      ? state
      : best;
  }, null);

  return {
    placed: bestState?.placed || [],
    rejectedBySpace: bestState?.rejectedBySpace || [],
    rejectedByWeight: bestState?.rejectedByWeight || [],
    rejectedByConstraint: bestState?.rejectedByConstraint || [],
    totalPlacedWeight: bestState?.totalPlacedWeight || 0,
  };
}

function updateCandidatePoints(points, placement, placed, container, pointSortMode = 'floor-front-left') {
  return normalizeCandidatePoints(
    [
      ...points,
      { x: placement.x + placement.w, y: placement.y, z: placement.z },
      { x: placement.x, y: placement.y + placement.h, z: placement.z },
      { x: placement.x, y: placement.y, z: placement.z + placement.d },
      { x: placement.x + placement.w, y: placement.y + placement.h, z: placement.z },
      { x: placement.x + placement.w, y: placement.y, z: placement.z + placement.d },
      { x: placement.x, y: placement.y + placement.h, z: placement.z + placement.d },
      { x: placement.x + placement.w, y: placement.y + placement.h, z: placement.z + placement.d },
    ],
    placed,
    container,
    pointSortMode
  );
}

function buildStrategyRunsSummary(results, intelligence) {
  const planById = new Map(
    Array.isArray(intelligence?.strategyPlans)
      ? intelligence.strategyPlans.map((plan) => [plan.id, plan])
      : []
  );

  return results.map((result) => ({
    id: result.strategyId,
    label: result.strategyLabel,
    dispatchRank: planById.get(result.strategyId)?.dispatchRank || null,
    dispatchReason: planById.get(result.strategyId)?.dispatchReason || '',
    packedCount: result.packedCount,
    remaining: result.remaining,
    efficiency: result.efficiency,
    totalPlacedWeight: result.totalPlacedWeight,
    sideImbalancePercent: result.loadBalance.sideImbalancePercent,
    lengthImbalancePercent: result.loadBalance.lengthImbalancePercent,
    rejectedByConstraintCount: result.rejectedByConstraintCount,
  }));
}

function buildOptimizerSelectionReason(bestResult, intelligence) {
  if (!bestResult || !intelligence?.primaryStrategyId) {
    return '';
  }

  if (bestResult.strategyId === intelligence.primaryStrategyId) {
    return `Manifest advisor va ket qua heuristic deu chon ${bestResult.strategyLabel}.`;
  }

  return `Manifest advisor de xuat ${intelligence.primaryStrategyLabel} truoc, nhung ${bestResult.strategyLabel} dat ket qua thuc te tot hon tren layout nay.`;
}

function buildOptimizerIntelligence(bestResult, intelligence) {
  if (!intelligence) {
    return null;
  }

  return {
    ...intelligence,
    selectedStrategyId: bestResult?.strategyId || intelligence.primaryStrategyId,
    selectedStrategyLabel: bestResult?.strategyLabel || intelligence.primaryStrategyLabel,
    selectionReason: buildOptimizerSelectionReason(bestResult, intelligence),
    usedRecommendedPrimary: bestResult?.strategyId === intelligence.primaryStrategyId,
  };
}

function comparePackingResults(candidate, currentBest) {
  if (!currentBest) return 1;

  const comparisons = [
    Number(currentBest.strictOverlapDetected) - Number(candidate.strictOverlapDetected),
    candidate.packedCount - currentBest.packedCount,
    candidate.efficiency - currentBest.efficiency,
    currentBest.remaining - candidate.remaining,
    currentBest.rejectedByConstraintCount - candidate.rejectedByConstraintCount,
    currentBest.loadBalance.sideImbalancePercent - candidate.loadBalance.sideImbalancePercent,
    currentBest.loadBalance.lengthImbalancePercent - candidate.loadBalance.lengthImbalancePercent,
    currentBest.maxFloorPressure - candidate.maxFloorPressure,
    currentBest.maxLoadAboveKg - candidate.maxLoadAboveKg,
    currentBest.occupiedHeight - candidate.occupiedHeight,
    currentBest.occupiedDepth - candidate.occupiedDepth,
  ];

  for (const value of comparisons) {
    if (Math.abs(value) > EPSILON) {
      return value > 0 ? 1 : -1;
    }
  }

  return 0;
}

function buildFinalResult({
  strategy,
  container,
  items,
  placed,
  rejectedBySpace,
  rejectedByWeight,
  rejectedByConstraint,
  totalPlacedWeight,
  maxWeight,
  floorLoadLimit,
}) {
  const totalRequested = items.length;
  const packedCount = placed.length;
  const remaining = totalRequested - packedCount;
  const usedVolume = placed.reduce((sum, box) => sum + box.w * box.h * box.d, 0);
  const totalVolume = container.w * container.h * container.d;
  const efficiency = totalVolume > 0 ? (usedVolume / totalVolume) * 100 : 0;

  const requestedWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const overWeightRequested = requestedWeight > maxWeight;
  const overSpaceRequested =
    items.reduce((sum, item) => sum + item.w * item.h * item.d, 0) > totalVolume;

  const maxFloorPressure = placed.reduce(
    (max, box) => Math.max(max, Number(box.floorPressureKgM2 || 0)),
    0
  );
  const maxStackLevel = placed.reduce(
    (max, box) => Math.max(max, Number(box.stackLevel || 1)),
    0
  );
  const maxLoadAboveKg = placed.reduce(
    (max, box) => Math.max(max, Number(box.loadAboveKg || 0)),
    0
  );
  const occupiedHeight = placed.reduce((max, box) => Math.max(max, box.y + box.h), 0);
  const occupiedDepth = placed.reduce((max, box) => Math.max(max, box.z + box.d), 0);
  const balanceMetrics = getLoadBalanceMetrics(placed, container);
  const balanceWarnings = getBalanceWarnings(balanceMetrics, container);
  const strictOverlapDetected = hasAnyOverlap(placed);
  const softZoneOverflowCount = placed.filter(
    (box) => box.softZoneOverflowAllowed && !isInsideDeliveryZone(box, container)
  ).length;
  const effectiveBalanceWarnings = strictOverlapDetected
    ? ['Phat hien box giao nhau, layout nay khong hop le', ...balanceWarnings]
    : softZoneOverflowCount > 0
      ? [
          `${softZoneOverflowCount} item duoc xep tran delivery zone co kiem soat de tang fill-rate; can review thu tu do hang truoc khi chot.`,
          ...balanceWarnings,
        ]
    : balanceWarnings;

  return {
    strategyId: strategy.id,
    strategyLabel: strategy.label,
    algorithm: PACKING_ALGORITHM_LABEL,
    placed: convertPlacedToCenteredCoords(placed, container),
    totalRequested,
    packedCount,
    remaining,
    usedVolume,
    totalVolume,
    efficiency,
    totalPlacedWeight,
    requestedWeight,
    maxWeight,
    overWeightRequested,
    overSpaceRequested,
    floorLoadLimit,
    maxFloorPressure,
    maxStackLevel,
    maxLoadAboveKg,
    occupiedHeight,
    occupiedDepth,
    strictOverlapDetected,
    softZoneOverflowCount,
    loadBalance: balanceMetrics,
    balanceWarnings: effectiveBalanceWarnings,
    rejectedBySpaceCount: rejectedBySpace.length,
    rejectedByWeightCount: rejectedByWeight.length,
    rejectedByConstraintCount: rejectedByConstraint.length,
    rejectedBySpace,
    rejectedByWeight,
    rejectedByConstraint,
    rejectedBySpaceSummary: summarizeRejectedItems(rejectedBySpace),
    rejectedByWeightSummary: summarizeRejectedItems(rejectedByWeight),
    rejectedByConstraintSummary: summarizeRejectedItems(rejectedByConstraint),
  };
}

function autoPack({
  container,
  boxes,
  strategy,
  maxWeight,
  floorLoadLimit,
}) {
  const placed = [];
  const placedById = new Map();
  const rejectedBySpace = [];
  const rejectedByWeight = [];
  const rejectedByConstraint = [];

  let candidatePoints = [{ x: 0, y: 0, z: 0 }];
  let totalPlacedWeight = 0;
  let nextPlacementId = 1;

  for (const rawBox of boxes) {
    const item = normalizeBoxType(rawBox, rawBox.typeIndex ?? 0);

    if (totalPlacedWeight + item.weight > maxWeight) {
      rejectedByWeight.push(item);
      continue;
    }

    const { placements, constraintReasons } = enumeratePlacementCandidates({
      item,
      placed,
      candidatePoints,
      placedById,
      container,
      strategy,
      floorLoadLimit,
      nextPlacementId,
    });
    const bestPlacement = placements[0] || null;

    if (!bestPlacement) {
      if (constraintReasons.size > 0) {
        rejectedByConstraint.push({
          ...item,
          reason: [...constraintReasons].slice(0, 2).join(' / '),
        });
      } else {
        rejectedBySpace.push(item);
      }
      continue;
    }

    placed.push(bestPlacement);
    placedById.set(bestPlacement.id, bestPlacement);
    totalPlacedWeight += item.weight;

    applyPlacementStateUpdates(bestPlacement, placedById);

    candidatePoints = updateCandidatePoints(
      candidatePoints,
      bestPlacement,
      placed,
      container,
      strategy.pointSortMode
    );
    nextPlacementId += 1;
  }

  return {
    placed,
    rejectedBySpace,
    rejectedByWeight,
    rejectedByConstraint,
    totalPlacedWeight,
  };
}

function runPackingStrategy({
  container,
  items,
  strategy,
  maxWeight,
  floorLoadLimit,
}) {
  const {
    placed,
    rejectedBySpace,
    rejectedByWeight,
    rejectedByConstraint,
    totalPlacedWeight,
  } =
    strategy.searchMode === 'adaptive-beam'
      ? runAdaptiveReorderBeamPack({
          container,
          boxes: items,
          strategy,
          maxWeight,
          floorLoadLimit,
        })
      : strategy.searchMode === 'beam'
      ? runBeamPack({
          container,
          boxes: items,
          strategy,
          maxWeight,
          floorLoadLimit,
        })
      : autoPack({
          container,
          boxes: items,
          strategy,
          maxWeight,
          floorLoadLimit,
        });

  const baseResult = buildFinalResult({
    strategy,
    container,
    items,
    placed,
    rejectedBySpace,
    rejectedByWeight,
    rejectedByConstraint,
    totalPlacedWeight,
    maxWeight,
    floorLoadLimit,
  });

  let bestResult = baseResult;
  let bestSeedLayout = placed;

  const compactedLayout = compactPackedLayout({
    placed,
    container,
    floorLoadLimit,
  });

  const snappedCompactedLayout = compactedLayout.isValid
    ? snapPackedLayoutToFaces({
        placed: compactedLayout.placed,
        container,
        floorLoadLimit,
      })
    : compactedLayout;

  if (snappedCompactedLayout.isValid) {
    const compactedResult = buildFinalResult({
      strategy,
      container,
      items,
      placed: snappedCompactedLayout.placed,
      rejectedBySpace,
      rejectedByWeight,
      rejectedByConstraint,
      totalPlacedWeight,
      maxWeight,
      floorLoadLimit,
    });

    if (comparePackingResults(compactedResult, bestResult) >= 0) {
      bestResult = compactedResult;
      bestSeedLayout = snappedCompactedLayout.placed;
    }
  }

  const repairedLayout = repairPackedLayout({
    placed: bestSeedLayout,
    rejectedBySpace,
    rejectedByConstraint,
    rejectedByWeight,
    totalPlacedWeight,
    strategy,
    container,
    maxWeight,
    floorLoadLimit,
  });

  if (!repairedLayout.isValid) {
    return bestResult;
  }

  const repairedResult = buildFinalResult({
    strategy,
    container,
    items,
    placed: repairedLayout.placed,
    rejectedBySpace: repairedLayout.rejectedBySpace,
    rejectedByWeight: repairedLayout.rejectedByWeight,
    rejectedByConstraint: repairedLayout.rejectedByConstraint,
    totalPlacedWeight: repairedLayout.totalPlacedWeight,
    maxWeight,
    floorLoadLimit,
  });

  if (comparePackingResults(repairedResult, bestResult) > 0) {
    bestResult = repairedResult;
  }

  const repairedCompactedLayout = compactPackedLayout({
    placed: repairedLayout.placed,
    container,
    floorLoadLimit,
  });

  const repairedSnappedLayout = repairedCompactedLayout.isValid
    ? snapPackedLayoutToFaces({
        placed: repairedCompactedLayout.placed,
        container,
        floorLoadLimit,
      })
    : repairedCompactedLayout;

  if (!repairedSnappedLayout.isValid) {
    return bestResult;
  }

  const repairedCompactedResult = buildFinalResult({
    strategy,
    container,
    items,
    placed: repairedSnappedLayout.placed,
    rejectedBySpace: repairedLayout.rejectedBySpace,
    rejectedByWeight: repairedLayout.rejectedByWeight,
    rejectedByConstraint: repairedLayout.rejectedByConstraint,
    totalPlacedWeight: repairedLayout.totalPlacedWeight,
    maxWeight,
    floorLoadLimit,
  });

  return comparePackingResults(repairedCompactedResult, bestResult) >= 0
    ? repairedCompactedResult
    : bestResult;
}

function buildEmptyPackingResult(container, maxWeight, floorLoadLimit) {
  return {
    strategyId: STRATEGY_PRESETS[0].id,
    strategyLabel: STRATEGY_PRESETS[0].label,
    algorithm: PACKING_ALGORITHM_LABEL,
    placed: [],
    totalRequested: 0,
    packedCount: 0,
    remaining: 0,
    usedVolume: 0,
    totalVolume: container.w * container.h * container.d,
    efficiency: 0,
    totalPlacedWeight: 0,
    requestedWeight: 0,
    maxWeight,
    overWeightRequested: false,
    overSpaceRequested: false,
    floorLoadLimit,
    maxFloorPressure: 0,
    maxStackLevel: 0,
    maxLoadAboveKg: 0,
    occupiedHeight: 0,
    occupiedDepth: 0,
    strictOverlapDetected: false,
    loadBalance: {
      totalWeight: 0,
      leftWeight: 0,
      rightWeight: 0,
      headWeight: 0,
      doorWeight: 0,
      sideImbalanceRatio: 0,
      lengthImbalanceRatio: 0,
      sideImbalancePercent: 0,
      lengthImbalancePercent: 0,
      cogX: 0,
      cogZ: 0,
    },
    balanceWarnings: [],
    rejectedBySpaceCount: 0,
    rejectedByWeightCount: 0,
    rejectedByConstraintCount: 0,
    rejectedBySpace: [],
    rejectedByWeight: [],
    rejectedByConstraint: [],
    rejectedBySpaceSummary: [],
    rejectedByWeightSummary: [],
    rejectedByConstraintSummary: [],
    evaluatedStrategies: [],
    optimizerIntelligence: null,
  };
}

export function optimizeMixedPacking({
  container,
  boxTypes,
  maxWeight = Infinity,
  floorLoadLimit = Infinity,
}) {
  const internalContainer = {
    w: Number(container.w),
    h: Number(container.h),
    d: Number(container.d),
  };

  const resolvedFloorLoadLimit =
    Number(floorLoadLimit) > 0 ? Number(floorLoadLimit) : Infinity;

  const items = expandBoxTypes(boxTypes).filter(
    (item) => item.w > 0 && item.h > 0 && item.d > 0 && item.weight > 0
  );

  if (items.length === 0) {
    return buildEmptyPackingResult(internalContainer, maxWeight, resolvedFloorLoadLimit);
  }

  const intelligence = analyzeOptimizerManifest({
    container: internalContainer,
    boxTypes,
    maxWeight,
    floorLoadLimit: resolvedFloorLoadLimit,
  });
  const strategyPresetById = new Map(STRATEGY_PRESETS.map((strategy) => [strategy.id, strategy]));
  const plannedStrategies = intelligence.strategyOrder
    .map((strategyId) => {
      const preset = strategyPresetById.get(strategyId);
      if (!preset) return null;

      return {
        ...preset,
        ...(intelligence.strategyOverrides?.[strategyId] || {}),
      };
    })
    .filter(Boolean);

  const strategyResults = plannedStrategies.map((strategy) =>
    runPackingStrategy({
      container: internalContainer,
      items: sortBoxes(items, strategy),
      strategy,
      maxWeight,
      floorLoadLimit: resolvedFloorLoadLimit,
    })
  );

  const bestResult = strategyResults.reduce((best, candidate) => {
    return comparePackingResults(candidate, best) > 0 ? candidate : best;
  }, null);

  return {
    ...bestResult,
    evaluatedStrategies: buildStrategyRunsSummary(strategyResults, intelligence),
    optimizerIntelligence: buildOptimizerIntelligence(bestResult, intelligence),
  };
}

export {
  autoPack,
  collides,
  fitsInside,
  getAllowedOrientations,
  hasSupport,
  scorePlacement,
  sortBoxes,
  updateCandidatePoints,
  violatesRules,
};
