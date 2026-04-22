import { normalizeCommercialSettings } from './commercialHub.js';

const SCENE_STATE_STORAGE_KEY = 'packet-opt-scene-state-v6';
const LEGACY_SCENE_STATE_STORAGE_KEYS = [
  'packet-opt-scene-state-v5',
  'packet-opt-scene-state-v4',
  'packet-opt-scene-state-v1',
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return Boolean(value);
}

function toPriorityGroup(value, fallback = 1) {
  const parsed = Number(value);
  return parsed > 0 ? parsed : fallback;
}

function cloneSize(size = {}) {
  return {
    w: toNumber(size.w),
    h: toNumber(size.h),
    d: toNumber(size.d),
  };
}

function resolveAllowRotate(source = {}) {
  if (source.allowRotate !== undefined) {
    return Boolean(source.allowRotate);
  }

  return source.rotationMode !== 'fixed';
}

function resolveNoTilt(source = {}) {
  if (source.noTilt !== undefined) {
    return Boolean(source.noTilt);
  }

  return source.rotationMode === 'upright';
}

function resolveNoStack(source = {}) {
  if (source.noStack !== undefined) {
    return Boolean(source.noStack);
  }

  return Boolean(source.fragile);
}

function resolveDeliveryZone(value) {
  return ['head', 'middle', 'door'].includes(value) ? value : 'any';
}

function cloneMultiBoxTypes(items = []) {
  return items.map((item, index) => ({
    id: toNumber(item.id, Date.now() + index),
    label: item.label || `Item ${index + 1}`,
    w: toNumber(item.w),
    h: toNumber(item.h),
    d: toNumber(item.d),
    weight: toNumber(item.weight),
    qty: toNumber(item.qty),
    allowRotate: resolveAllowRotate(item),
    noStack: resolveNoStack(item),
    noTilt: resolveNoTilt(item),
    priorityGroup: toPriorityGroup(item.priorityGroup ?? item.deliveryOrder, 1),
    stackLimit: resolveNoStack(item) ? 1 : toNumber(item.stackLimit),
    maxLoadAbove: resolveNoStack(item) ? 0 : toNumber(item.maxLoadAbove),
    deliveryZone: resolveDeliveryZone(item.deliveryZone),
  }));
}

function serializeBox(box) {
  const size = cloneSize(box.userData.size);
  const originalSize = cloneSize(box.userData.originalSize || size);

  return {
    id: toNumber(box.userData.id),
    label: box.userData.label || 'Thùng',
    size,
    originalSize,
    weight: toNumber(box.userData.weight),
    allowRotate: resolveAllowRotate(box.userData),
    noStack: resolveNoStack(box.userData),
    noTilt: resolveNoTilt(box.userData),
    priorityGroup: toPriorityGroup(box.userData.priorityGroup ?? box.userData.deliveryOrder, 1),
    deliveryOrder: toPriorityGroup(box.userData.deliveryOrder, 1),
    rotationMode: box.userData.rotationMode || 'all',
    fragile: toBoolean(box.userData.fragile),
    stackLimit: toNumber(box.userData.stackLimit),
    maxLoadAbove: toNumber(box.userData.maxLoadAbove),
    deliveryZone: box.userData.deliveryZone || 'any',
    stackLevel: toNumber(box.userData.stackLevel),
    loadAboveKg: toNumber(box.userData.loadAboveKg),
    supportRatio: toNumber(box.userData.supportRatio),
    floorBearingWeight: toNumber(box.userData.floorBearingWeight),
    floorPressureKgM2: toNumber(box.userData.floorPressureKgM2),
    isSample: toBoolean(box.userData.isSampleBox),
    sceneRole: box.userData.sceneRole || 'placement',
    previewQuantity: toNumber(box.userData.previewQuantity),
    position: {
      x: toNumber(box.position.x),
      y: toNumber(box.position.y),
      z: toNumber(box.position.z),
    },
    quaternion: {
      x: toNumber(box.quaternion.x),
      y: toNumber(box.quaternion.y),
      z: toNumber(box.quaternion.z),
      w: toNumber(box.quaternion.w, 1),
    },
  };
}

export function serializeSceneState({
  boxes,
  selected,
  contType,
  container,
  opacity,
  multiBoxTypes,
  capacityInputs,
  shockMode,
  shockNet,
  transformMode,
  viewerSettings,
  packingSettings,
  commercialSettings,
  cameraState,
}) {
  return {
    version: 6,
    selectedBoxId: selected?.userData?.id ?? null,
    contType: contType || 'custom',
    container: {
      w: toNumber(container?.w),
      h: toNumber(container?.h),
      d: toNumber(container?.d),
    },
    opacity: toNumber(opacity, 0.18),
    multiBoxTypes: cloneMultiBoxTypes(multiBoxTypes),
    capacityInputs: {
      containerLength: toNumber(capacityInputs?.containerLength),
      containerWidth: toNumber(capacityInputs?.containerWidth),
      containerHeight: toNumber(capacityInputs?.containerHeight),
      containerMaxWeight: toNumber(capacityInputs?.containerMaxWeight),
      boxLength: toNumber(capacityInputs?.boxLength),
      boxWidth: toNumber(capacityInputs?.boxWidth),
      boxHeight: toNumber(capacityInputs?.boxHeight),
      boxWeight: toNumber(capacityInputs?.boxWeight),
    },
    shockMode: shockMode || 'basic',
    shockNet: Boolean(shockNet),
    transformMode: transformMode || 'translate',
    viewerSettings: {
      autoHideWalls: Boolean(viewerSettings?.autoHideWalls),
      wallOcclusionMode: viewerSettings?.wallOcclusionMode || 'hide',
      cutawayMode: viewerSettings?.cutawayMode || 'off',
    },
    packingSettings: {
      floorLoadLimit: toNumber(packingSettings?.floorLoadLimit),
    },
    commercialSettings: normalizeCommercialSettings(commercialSettings),
    cameraState: {
      position: {
        x: toNumber(cameraState?.position?.x),
        y: toNumber(cameraState?.position?.y),
        z: toNumber(cameraState?.position?.z),
      },
      target: {
        x: toNumber(cameraState?.target?.x),
        y: toNumber(cameraState?.target?.y),
        z: toNumber(cameraState?.target?.z),
      },
    },
    boxes: boxes.map(serializeBox),
  };
}

export function saveSceneState(state) {
  localStorage.setItem(SCENE_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function loadSceneState() {
  const raw =
    localStorage.getItem(SCENE_STATE_STORAGE_KEY) ||
    LEGACY_SCENE_STATE_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
