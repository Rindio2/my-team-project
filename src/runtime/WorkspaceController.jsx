import { useEffect, useEffectEvent, useRef } from 'react';

import { CONTAINER_TYPES } from '../constants/containerTypes.js';
import { SCENARIO_PRESETS } from '../constants/scenarioPresets.js';
import { calculateCapacity } from '../utils/capacity.js';
import {
  buildCloudPlanSummary,
  formatCloudPlanOptionLabel,
  getCloudPlanStatusLines,
} from '../utils/cloudPlanHub.js';
import {
  analyzeCommercialPlan,
  formatCurrencyUsd,
  normalizeCommercialSettings,
  runCommercialPreflight,
} from '../utils/commercialHub.js';
import { buildOperationsSummaryHtml } from '../utils/projectHub.js';
import {
  loadSceneState,
  saveSceneState,
  serializeSceneState,
} from '../utils/sceneState.js';
import {
  getSupabaseSession,
  isSupabaseConfigured,
  listCloudPlans,
  loadCloudPlan,
  savePlanToCloud,
  sendMagicLink,
  signOutSupabase,
  subscribeToAuthChanges,
} from '../utils/supabaseClient.js';
import {
  showCapacityResult,
  showPackingReport,
  showSelectedInfo,
} from '../utils/uiHelpers.js';
import { isFreeDeploymentMode } from '../utils/deploymentMode.js';

import { createSceneSystem } from '../three/initScene.js';
import {
  createContainerGroup,
  updateContainerMesh,
  renderShockVisuals,
  clearShockVisuals,
  resolveContainerFaceFromCamera,
  setContainerClipping,
  updateContainerViewOcclusion,
} from '../three/container3d.js';
import {
  createCarton,
  disposeBox,
  getBoxOrientationPresets,
  setCartonClipping,
  setCartonPreviewLabelVisible,
  setCartonSelection,
  updateCartonGeometry,
} from '../three/boxes3d.js';

let projectWorkflowModulePromise = null;
let platformApiModulePromise = null;

function loadProjectWorkflowModule() {
  if (!projectWorkflowModulePromise) {
    projectWorkflowModulePromise = import('../utils/projectWorkflow.js').catch((error) => {
      projectWorkflowModulePromise = null;
      throw error;
    });
  }

  return projectWorkflowModulePromise;
}

function loadPlatformApiModule() {
  if (!platformApiModulePromise) {
    platformApiModulePromise = import('../utils/platformApi.js').catch((error) => {
      platformApiModulePromise = null;
      throw error;
    });
  }

  return platformApiModulePromise;
}

export default function WorkspaceController({ onReady = () => {}, onError = () => {} }) {
  const initializedRef = useRef(false);
  const emitReady = useEffectEvent(() => {
    onReady();
  });
  const emitError = useEffectEvent((error) => {
    onError(error);
  });

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const canvasDiv = document.getElementById('canvas');
      const sidebarEl = document.getElementById('sidebar');
      const statsEl = document.getElementById('stats');
      const infoPanel = document.getElementById('infoPanel');
      const infoText = document.getElementById('infoText');
      const reportEl = document.getElementById('report');
      const capacityResult = document.getElementById('capacityResult');
      const btnAutoArrangeCapacity = document.getElementById('btnAutoArrangeCapacity');
      const shockOptions = document.getElementById('shockOptions');
      const multiBoxTypesList = document.getElementById('multiBoxTypesList');
      const autoHideWalls = document.getElementById('autoHideWalls');
      const wallOcclusionMode = document.getElementById('wallOcclusionMode');
      const cutawayMode = document.getElementById('cutawayMode');
      const viewerStatus = document.getElementById('viewerStatus');
      const packingFloorLoadLimit = document.getElementById('packingFloorLoadLimit');
      const manualArrangeStatus = document.getElementById('manualArrangeStatus');
      const manualArrangeControls = document.getElementById('manualArrangeControls');
      const manualRotationPanel = document.getElementById('manualRotationPanel');
      const projectPreset = document.getElementById('projectPreset');
      const projectPresetHint = document.getElementById('projectPresetHint');
      const planImportInput = document.getElementById('planImportInput');
      const manifestPasteInput = document.getElementById('manifestPasteInput');
      const manifestImportInput = document.getElementById('manifestImportInput');
      const operationsSummary = document.getElementById('operationsSummary');
      const manualOrientationButtons = Array.from(
        document.querySelectorAll('[data-orientation-index]')
      );
      const getCommandButtons = (command) =>
        Array.from(document.querySelectorAll(`[data-command="${command}"]`));
      const bindCommandButtons = (command, handler) => {
        const buttons = getCommandButtons(command);
        buttons.forEach((button) => button.addEventListener('click', handler));
        return () => {
          buttons.forEach((button) => button.removeEventListener('click', handler));
        };
      };
      const setCommandButtonsActive = (command, isActive) => {
        getCommandButtons(command).forEach((button) =>
          button.classList.toggle('active', isActive)
        );
      };
      const setCommandButtonsDisabled = (commands, disabled) => {
        const commandList = Array.isArray(commands) ? commands : [commands];
        commandList.forEach((command) => {
          getCommandButtons(command).forEach((button) => {
            button.disabled = disabled;
          });
        });
      };

      const cw = document.getElementById('cw');
      const ch = document.getElementById('ch');
      const cd = document.getElementById('cd');
      const contType = document.getElementById('contType');
      const opacitySlider = document.getElementById('opacitySlider');
      const calcContainerLength = document.getElementById('calcContainerLength');
      const calcContainerWidth = document.getElementById('calcContainerWidth');
      const calcContainerHeight = document.getElementById('calcContainerHeight');
      const calcContainerMaxWeight = document.getElementById('calcContainerMaxWeight');
      const calcBoxLength = document.getElementById('calcBoxLength');
      const calcBoxWidth = document.getElementById('calcBoxWidth');
      const calcBoxHeight = document.getElementById('calcBoxHeight');
      const calcBoxWeight = document.getElementById('calcBoxWeight');
      const shockBasic = document.getElementById('shockBasic');
      const shockCenter = document.getElementById('shockCenter');
      const shockNetCheckbox = document.getElementById('shockNet');
      const bLabel = document.getElementById('bLabel');
      const bw = document.getElementById('bw');
      const bh = document.getElementById('bh');
      const bd = document.getElementById('bd');
      const bWeight = document.getElementById('bWeight');
      const bQty = document.getElementById('bQty');
      const bPriorityGroup = document.getElementById('bPriorityGroup');
      const bAllowRotate = document.getElementById('bAllowRotate');
      const bNoStack = document.getElementById('bNoStack');
      const bNoTilt = document.getElementById('bNoTilt');
      const bDeliveryZone = document.getElementById('bDeliveryZone');
      const bStackLimit = document.getElementById('bStackLimit');
      const bMaxLoadAbove = document.getElementById('bMaxLoadAbove');
      const commercialProjectName = document.getElementById('commercialProjectName');
      const commercialCustomerName = document.getElementById('commercialCustomerName');
      const commercialRouteName = document.getElementById('commercialRouteName');
      const commercialServiceLevel = document.getElementById('commercialServiceLevel');
      const commercialDeclaredValue = document.getElementById('commercialDeclaredValue');
      const commercialFreightCost = document.getElementById('commercialFreightCost');
      const commercialTargetUtilization = document.getElementById('commercialTargetUtilization');
      const commercialTargetMaxImbalance =
        document.getElementById('commercialTargetMaxImbalance');
      const authEmail = document.getElementById('authEmail');
      const authStatus = document.getElementById('authStatus');
      const cloudPlanName = document.getElementById('cloudPlanName');
      const cloudPlanList = document.getElementById('cloudPlanList');
      const cloudPlanStatus = document.getElementById('cloudPlanStatus');
      const leadName = document.getElementById('leadName');
      const leadEmail = document.getElementById('leadEmail');
      const leadCompany = document.getElementById('leadCompany');
      const leadMessage = document.getElementById('leadMessage');
      const reportRecipientEmail = document.getElementById('reportRecipientEmail');
      const crmStatus = document.getElementById('crmStatus');
      const commercialInputElements = [
        commercialProjectName,
        commercialCustomerName,
        commercialRouteName,
        commercialServiceLevel,
        commercialDeclaredValue,
        commercialFreightCost,
        commercialTargetUtilization,
        commercialTargetMaxImbalance,
      ].filter(Boolean);

      const missingRequiredElements = [
        'canvas',
        'sidebar',
        'stats',
        'infoPanel',
        'infoText',
        'report',
        'capacityResult',
        'btnAutoArrangeCapacity',
        'shockOptions',
        'multiBoxTypesList',
        'autoHideWalls',
        'wallOcclusionMode',
        'cutawayMode',
        'viewerStatus',
        'packingFloorLoadLimit',
        'manualArrangeStatus',
        'manualArrangeControls',
        'manualRotationPanel',
        'projectPreset',
        'projectPresetHint',
        'planImportInput',
        'manifestPasteInput',
        'manifestImportInput',
        'operationsSummary',
        'cw',
        'ch',
        'cd',
        'contType',
        'opacitySlider',
        'calcContainerLength',
        'calcContainerWidth',
        'calcContainerHeight',
        'calcContainerMaxWeight',
        'calcBoxLength',
        'calcBoxWidth',
        'calcBoxHeight',
        'calcBoxWeight',
        'shockBasic',
        'shockCenter',
        'shockNet',
        'bLabel',
        'bw',
        'bh',
        'bd',
        'bWeight',
        'bQty',
        'bPriorityGroup',
        'bAllowRotate',
        'bNoStack',
        'bNoTilt',
        'bDeliveryZone',
        'bStackLimit',
        'bMaxLoadAbove',
        'commercialProjectName',
        'commercialCustomerName',
        'commercialRouteName',
        'commercialServiceLevel',
        'commercialDeclaredValue',
        'commercialFreightCost',
        'commercialTargetUtilization',
        'commercialTargetMaxImbalance',
        'authEmail',
        'authStatus',
        'cloudPlanName',
        'cloudPlanList',
        'cloudPlanStatus',
        'leadName',
        'leadEmail',
        'leadCompany',
        'leadMessage',
        'reportRecipientEmail',
        'crmStatus',
      ].filter((id) => !document.getElementById(id));

      if (missingRequiredElements.length > 0) {
        throw new Error(
          `Thiếu các phần tử UI bắt buộc: ${missingRequiredElements.join(', ')}. Kiểm tra lại Sidebar và các section đã render.`
        );
      }

      const sceneSys = createSceneSystem(canvasDiv);
      const { scene, camera, renderer, orbit, transformControl, stars, cogMarker } = sceneSys;
      transformControl.visible = false;
      transformControl.enabled = false;
      const freeModeEnabled = isFreeDeploymentMode();

      const SIDEBAR_COLLAPSED_STORAGE_KEY = 'packet-opt-sidebar-collapsed';
      const containerSys = createContainerGroup();
      scene.add(containerSys.group);

      let boxes = [];
      let selected = null;
      let animationId;
      let resizeObserver;
      let lastCapacityData = null;
      let isApplyingSceneState = false;
      let transformSnapshotBeforeDrag = null;
      let historyPast = [];
      let historyFuture = [];
      let lastWorkspaceMode = 'preview';
      let lastWorkspaceAction = 'Sẵn sàng dựng phương án xếp hàng.';
      let lastWorkspaceResult = null;
      let lastWorkspaceUpdatedAt = new Date();
      let optimizerJobSeq = 0;
      let optimizerIsRunning = false;
      let activeOptimizerWorker = null;
      let authSession = null;
      let activeCloudPlanId = null;
      let cloudPlansCache = [];
      let cloudRuntimeInitialized = false;
      let sidebarCollapsedPreference =
        typeof window !== 'undefined' &&
        window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
      let platformStatus = {
        checked: false,
        available: false,
        capabilities: {},
        release: {
          ready: false,
          issues: [],
        },
      };
      let removeAuthSubscription = () => {};

    let multiBoxTypes = [
      {
        id: Date.now(),
        label: 'Loại 1',
        w: 60,
        h: 50,
        d: 80,
        weight: 20,
        qty: 2,
        allowRotate: true,
        noStack: false,
        noTilt: false,
        priorityGroup: 1,
        stackLimit: 0,
        maxLoadAbove: 0,
        deliveryZone: 'any',
      },
    ];

    const raycaster = new sceneSys.THREE.Raycaster();
    const pointer = new sceneSys.THREE.Vector2();
    const sharedCutawayPlane = new sceneSys.THREE.Plane(new sceneSys.THREE.Vector3(0, 0, 1), 0);
    const clippingPlaneList = [sharedCutawayPlane];
    const pointerClickState = {
      x: 0,
      y: 0,
    };
    const dragState = {
      active: false,
      hasMoved: false,
      pointerId: null,
      box: null,
      startSignature: '',
      offset: new sceneSys.THREE.Vector3(),
      intersection: new sceneSys.THREE.Vector3(),
      plane: new sceneSys.THREE.Plane(new sceneSys.THREE.Vector3(0, 1, 0), 0),
    };

    function deriveRotationModeFromItem(item = {}) {
      if (!item.allowRotate) return 'fixed';
      if (item.noTilt) return 'upright';
      return 'all';
    }

    function normalizePriorityGroup(value) {
      return Number(value) > 0 ? Number(value) : 1;
    }

    function normalizeDeliveryZone(value) {
      return ['head', 'middle', 'door'].includes(value) ? value : 'any';
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function sanitizeInlineStatusHtml(value) {
      return escapeHtml(value)
        .replaceAll('&lt;b&gt;', '<b>')
        .replaceAll('&lt;/b&gt;', '</b>')
        .replaceAll('&lt;br&gt;', '<br>')
        .replaceAll('&lt;br/&gt;', '<br/>')
        .replaceAll('&lt;code&gt;', '<code>')
        .replaceAll('&lt;/code&gt;', '</code>');
    }

    function syncSidebarToggleButtons(isCollapsed) {
      const expanded = !isCollapsed;

      getCommandButtons('toggle-sidebar').forEach((button) => {
        button.setAttribute('aria-expanded', String(expanded));
        button.setAttribute(
          'aria-label',
          expanded ? 'Thu gọn hoặc mở rộng sidebar' : 'Mở rộng sidebar'
        );
        button.title = expanded ? 'Thu gọn sidebar' : 'Mở rộng sidebar';
        button.classList.toggle('active', isCollapsed);
      });
    }

    function applySidebarCollapsedState(nextCollapsed, { persist = true, refitCamera = false } = {}) {
      sidebarCollapsedPreference = Boolean(nextCollapsed);
      const shouldCollapse = sidebarCollapsedPreference;

      sidebarEl?.classList.toggle('collapsed', shouldCollapse);
      syncSidebarToggleButtons(shouldCollapse);

      if (persist && typeof window !== 'undefined') {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_STORAGE_KEY,
          sidebarCollapsedPreference ? '1' : '0'
        );
      }

      if (refitCamera) {
        window.setTimeout(() => {
          sceneSys.resize();
          sceneSys.fitCameraToBox(+cw.value, +ch.value, +cd.value);
        }, 310);
      }
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    }

    function normalizeCargoItem(item = {}, index = 0) {
      const allowRotate =
        item.allowRotate !== undefined
          ? Boolean(item.allowRotate)
          : item.rotationMode !== 'fixed';
      const noTilt =
        item.noTilt !== undefined
          ? Boolean(item.noTilt)
          : item.rotationMode === 'upright';
      const noStack =
        item.noStack !== undefined ? Boolean(item.noStack) : Boolean(item.fragile);
      const stackLimit = noStack ? 1 : Math.max(0, Number(item.stackLimit || 0));
      const maxLoadAbove = noStack ? 0 : Math.max(0, Number(item.maxLoadAbove || 0));

      return {
        id: Number(item.id) || Date.now() + index,
        label: item.label || `Item ${index + 1}`,
        w: Number(item.w) || 0,
        h: Number(item.h) || 0,
        d: Number(item.d) || 0,
        weight: Number(item.weight) || 0,
        qty: Number(item.qty) || 0,
        allowRotate,
        noStack,
        noTilt,
        priorityGroup: normalizePriorityGroup(item.priorityGroup ?? item.deliveryOrder),
        stackLimit,
        maxLoadAbove,
        deliveryZone: normalizeDeliveryZone(item.deliveryZone),
      };
    }

    function toPackingItem(item = {}) {
      const normalized = normalizeCargoItem(item);
      return {
        ...normalized,
        deliveryOrder: normalized.priorityGroup,
        rotationMode: deriveRotationModeFromItem(normalized),
        fragile: normalized.noStack,
        stackLimit: normalized.stackLimit,
        maxLoadAbove: normalized.maxLoadAbove,
        deliveryZone: normalized.deliveryZone,
      };
    }

    function cloneMultiBoxTypeList(items = []) {
      return items.map((item, index) => normalizeCargoItem(item, index));
    }

    function readCapacityInputs() {
      return {
        containerLength: Number(calcContainerLength?.value || 0),
        containerWidth: Number(calcContainerWidth?.value || 0),
        containerHeight: Number(calcContainerHeight?.value || 0),
        containerMaxWeight: Number(calcContainerMaxWeight?.value || 0),
        boxLength: Number(calcBoxLength?.value || 0),
        boxWidth: Number(calcBoxWidth?.value || 0),
        boxHeight: Number(calcBoxHeight?.value || 0),
        boxWeight: Number(calcBoxWeight?.value || 0),
      };
    }

    function readCommercialInputs() {
      return normalizeCommercialSettings({
        projectName: commercialProjectName?.value,
        customerName: commercialCustomerName?.value,
        routeName: commercialRouteName?.value,
        serviceLevel: commercialServiceLevel?.value,
        declaredValue: commercialDeclaredValue?.value,
        freightCost: commercialFreightCost?.value,
        targetUtilization: commercialTargetUtilization?.value,
        targetMaxImbalance: commercialTargetMaxImbalance?.value,
      });
    }

    function applyCommercialSettings(settings = {}) {
      const normalized = normalizeCommercialSettings(settings);

      if (commercialProjectName) commercialProjectName.value = normalized.projectName;
      if (commercialCustomerName) commercialCustomerName.value = normalized.customerName;
      if (commercialRouteName) commercialRouteName.value = normalized.routeName;
      if (commercialServiceLevel) commercialServiceLevel.value = normalized.serviceLevel;
      if (commercialDeclaredValue) commercialDeclaredValue.value = normalized.declaredValue;
      if (commercialFreightCost) commercialFreightCost.value = normalized.freightCost;
      if (commercialTargetUtilization) {
        commercialTargetUtilization.value = normalized.targetUtilization;
      }
      if (commercialTargetMaxImbalance) {
        commercialTargetMaxImbalance.value = normalized.targetMaxImbalance;
      }

      syncCloudPlanNameFromCommercial();
      return normalized;
    }

    function getPublicAppUrl() {
      return (
        String(import.meta.env.VITE_PUBLIC_APP_URL || '').trim() ||
        window.location.origin ||
        window.location.href
      );
    }

    function syncCloudPlanNameFromCommercial(force = false) {
      if (!cloudPlanName) return;

      const suggestedName =
        commercialProjectName?.value?.trim() ||
        commercialCustomerName?.value?.trim() ||
        'Packet Opt Plan';

      if (force || !cloudPlanName.value.trim()) {
        cloudPlanName.value = suggestedName;
      }
    }

    function setStatusCard(element, { tone = 'neutral', title, lines = [] }) {
      if (!element) return;

      element.dataset.tone = tone;
      element.innerHTML = `
        <div class="status-card-title">${escapeHtml(title)}</div>
        ${lines.map((line) => `<div class="status-card-line">${escapeHtml(line)}</div>`).join('')}
      `;
    }

    function getCurrentReportPayload() {
      return {
        contType: contType?.value || 'custom',
        container: getCurrentContainerSize(),
        multiBoxTypes,
        boxes,
        result: lastWorkspaceResult,
        maxWeight: getCurrentContainerMaxLoad(),
        floorLoadLimit: getPackingFloorLoadLimit(),
        lastAction: lastWorkspaceAction,
        commercialSettings: readCommercialInputs(),
      };
    }

    async function getCurrentReportHtml() {
      const { buildOperationalReportHtml } = await loadProjectWorkflowModule();
      return buildOperationalReportHtml(getCurrentReportPayload());
    }

    function getCurrentCloudPlanSummary() {
      return buildCloudPlanSummary({
        ...getCurrentReportPayload(),
      });
    }

    function getPlatformCapabilityState() {
      const capabilities = platformStatus?.capabilities || {};
      const releaseIssues = Array.isArray(platformStatus?.release?.issues)
        ? platformStatus.release.issues
        : [];

      return {
        checked: freeModeEnabled || Boolean(platformStatus?.checked),
        available: freeModeEnabled ? true : Boolean(platformStatus?.available),
        canSubmitLead: freeModeEnabled
          ? false
          : Boolean(capabilities.crmLeadPersist || capabilities.crmLeadNotify),
        canSendReport: freeModeEnabled ? false : Boolean(capabilities.reportEmail),
        canPersistLead: freeModeEnabled ? false : Boolean(capabilities.crmLeadPersist),
        canNotifyLead: freeModeEnabled ? false : Boolean(capabilities.crmLeadNotify),
        canLogReport: freeModeEnabled ? false : Boolean(capabilities.reportLog),
        releaseReady: freeModeEnabled ? true : Boolean(platformStatus?.release?.ready),
        releaseIssues: freeModeEnabled
          ? ['Free mode đang bật: CRM, email workflow và cloud sync đã được tắt có chủ đích.']
          : releaseIssues,
        isFreeMode: freeModeEnabled,
      };
    }

    function readSingleBoxInputs() {
      return normalizeCargoItem({
        label: bLabel?.value?.trim() || 'Thùng đơn',
        w: Number(bw?.value || 0),
        h: Number(bh?.value || 0),
        d: Number(bd?.value || 0),
        weight: Number(bWeight?.value || 0),
        qty: Number(bQty?.value || 0),
        priorityGroup: Number(bPriorityGroup?.value || 1),
        allowRotate: Boolean(bAllowRotate?.checked),
        noStack: Boolean(bNoStack?.checked),
        noTilt: Boolean(bNoTilt?.checked),
        deliveryZone: bDeliveryZone?.value || 'any',
        stackLimit: Number(bStackLimit?.value || 0),
        maxLoadAbove: Number(bMaxLoadAbove?.value || 0),
      });
    }

    function getCurrentContainerSize() {
      return {
        w: Number(cw.value || 0),
        h: Number(ch.value || 0),
        d: Number(cd.value || 0),
      };
    }

    function getOptimizerCommandList() {
      return ['pack-basic', 'pack-pro', 'pack-optimize'];
    }

    function setOptimizerRunningState(isRunning, label = 'Engine đang chạy nền') {
      optimizerIsRunning = isRunning;
      setCommandButtonsDisabled(getOptimizerCommandList(), isRunning);

      if (!reportEl || !isRunning) return;

      reportEl.innerHTML = `
        <div style="color:#38bdf8;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ⚙️ ${label}
        </div>
        <div style="padding:12px;border-radius:10px;background:rgba(59,130,246,0.10);border:1px solid rgba(96,165,250,0.35);line-height:1.65;color:#dbeafe;">
          Optimizer đang chạy trong background worker để giữ UI mượt. Bạn vẫn có thể xem scene hiện tại trong lúc chờ kết quả mới.
        </div>
      `;
      reportEl.style.display = 'block';
    }

    function buildOptimizationContextSignature({
      boxTypes,
      container,
      maxWeight,
      floorLoadLimit,
    }) {
      return JSON.stringify({
        boxTypes,
        container,
        maxWeight,
        floorLoadLimit,
      });
    }

    async function computeOptimizedPacking(payload) {
      const workerJobId = ++optimizerJobSeq;

      try {
        const result = await new Promise((resolve, reject) => {
          const worker = new Worker(new URL('../workers/optimizer.worker.js', import.meta.url), {
            type: 'module',
          });

          activeOptimizerWorker = worker;

          const cleanup = () => {
            worker.onmessage = null;
            worker.onerror = null;
            worker.terminate();
            if (activeOptimizerWorker === worker) {
              activeOptimizerWorker = null;
            }
          };

          worker.onmessage = (event) => {
            const { id, status, result: nextResult, error } = event.data || {};
            if (id !== workerJobId) return;

            cleanup();

            if (status === 'success') {
              resolve(nextResult);
              return;
            }

            reject(new Error(error || 'Optimizer worker failed.'));
          };

          worker.onerror = () => {
            cleanup();
            reject(new Error('Optimizer worker crashed.'));
          };

          worker.postMessage({
            id: workerJobId,
            type: 'optimize',
            payload,
          });
        });

        return result;
      } catch (error) {
        const { optimizeMixedPacking: optimizeMixedPackingFallback } = await import(
          '../utils/multiBoxPacking.js'
        );

        if (!(error instanceof Error)) {
          return optimizeMixedPackingFallback(payload);
        }

        showStatusMessage({
          title: '⚠️ Worker không sẵn sàng, đang dùng fallback cục bộ',
          lines: [
            `${error.message}`,
            'Engine sẽ chạy trực tiếp trên main thread cho lần này.',
          ],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });

        return optimizeMixedPackingFallback(payload);
      }
    }

    function refreshOperationsSummary(options = {}) {
      const hasMode = Object.prototype.hasOwnProperty.call(options, 'mode');
      const hasAction = Object.prototype.hasOwnProperty.call(options, 'action');
      const hasResult = Object.prototype.hasOwnProperty.call(options, 'result');

      if (hasMode) {
        lastWorkspaceMode = options.mode;
      }
      if (hasAction) {
        lastWorkspaceAction = options.action;
      }
      if (hasResult) {
        lastWorkspaceResult = options.result;
      }

      lastWorkspaceUpdatedAt = new Date();

      if (!operationsSummary) return;

      operationsSummary.innerHTML = buildOperationsSummaryHtml({
        contType: contType?.value || 'custom',
        container: getCurrentContainerSize(),
        multiBoxTypes,
        boxes,
        result: lastWorkspaceResult,
        mode: lastWorkspaceMode,
        lastAction: lastWorkspaceAction,
        lastUpdatedAt: lastWorkspaceUpdatedAt,
        maxWeight: getCurrentContainerMaxLoad(),
        floorLoadLimit: getPackingFloorLoadLimit(),
        commercialSettings: readCommercialInputs(),
      });
    }

    function findCloudPlanById(planId) {
      return cloudPlansCache.find((plan) => plan.id === planId) || null;
    }

    function getSelectedCloudPlan() {
      const selectedId = cloudPlanList?.value || activeCloudPlanId;
      return selectedId ? findCloudPlanById(selectedId) : null;
    }

    function updatePlatformCommandAvailability() {
      const capabilityState = getPlatformCapabilityState();

      setCommandButtonsDisabled('crm-submit-lead', !capabilityState.canSubmitLead);
      setCommandButtonsDisabled('crm-send-report', !capabilityState.canSendReport);

      [leadName, leadEmail, leadCompany, leadMessage].forEach((element) => {
        if (element) element.disabled = !capabilityState.canSubmitLead;
      });

      if (reportRecipientEmail) {
        reportRecipientEmail.disabled = !capabilityState.canSendReport;
      }
    }

    function renderPlatformStatusCard() {
      const capabilityState = getPlatformCapabilityState();

      if (capabilityState.isFreeMode) {
        setStatusCard(crmStatus, {
          tone: 'neutral',
          title: 'Free mode: CRM và email tự động đã tắt',
          lines: [
            'Bản thi hiện chỉ giữ các luồng local để không phát sinh chi phí dịch vụ.',
            'Dùng Export HTML để bàn giao report và ghi lead thủ công nếu cần follow-up.',
          ],
        });
        return;
      }

      if (!platformStatus.checked) {
        setStatusCard(crmStatus, {
          tone: 'neutral',
          title: 'Đang kiểm tra backend workflow',
          lines: ['App đang đọc capability của Pages Functions để khóa đúng các luồng CRM/report.'],
        });
        return;
      }

      if (!platformStatus.available) {
        setStatusCard(crmStatus, {
          tone: 'danger',
          title: 'Backend workflow chưa sẵn sàng',
          lines: [
            'Không đọc được /api/status từ môi trường hiện tại.',
            'CRM và email report đã bị khóa để tránh fail mơ hồ khi phát hành.',
          ],
        });
        return;
      }

      const lines = [
        capabilityState.canSubmitLead
          ? capabilityState.canPersistLead && capabilityState.canNotifyLead
            ? 'Lead capture đang mở: vừa log CRM vừa notify sales/ops.'
            : capabilityState.canPersistLead
              ? 'Lead capture đang mở ở chế độ DB-only: chưa có notify email nội bộ.'
              : 'Lead capture đang mở ở chế độ email-only: chưa có logging DB server-side.'
          : 'Lead capture đang bị khóa do backend chưa đủ capability CRM.',
        capabilityState.canSendReport
          ? capabilityState.canLogReport
            ? 'Executive report đang mở và có log DB cho mỗi lần gửi.'
            : 'Executive report đang mở nhưng chưa có log DB server-side.'
          : 'Executive report đang bị khóa do Resend chưa được cấu hình.',
      ];

      if (capabilityState.releaseIssues[0]) {
        lines.push(`Release gate: ${capabilityState.releaseIssues[0]}`);
      }

      setStatusCard(crmStatus, {
        tone: capabilityState.releaseReady
          ? 'positive'
          : capabilityState.canSubmitLead || capabilityState.canSendReport
            ? 'warning'
            : 'danger',
        title: capabilityState.releaseReady
          ? 'Backend workflow release-ready'
          : 'Backend workflow đang bị khóa một phần',
        lines,
      });
    }

    async function refreshPlatformStatus({ silent = false } = {}) {
      if (freeModeEnabled) {
        platformStatus = {
          checked: true,
          available: true,
          capabilities: {},
          release: {
            ready: true,
            issues: ['Free mode giữ app ở local-only để không cần Supabase, Resend hay CRM backend.'],
          },
        };
        updatePlatformCommandAvailability();
        if (!silent) {
          renderPlatformStatusCard();
        }
        return platformStatus;
      }

      try {
        const { getPlatformStatus } = await loadPlatformApiModule();
        const status = await getPlatformStatus();
        platformStatus = {
          ...status,
          checked: true,
          available: true,
        };
      } catch (error) {
        platformStatus = {
          checked: true,
          available: false,
          capabilities: {},
          release: {
            ready: false,
            issues: [
              error instanceof Error
                ? error.message
                : 'Không thể đọc capability từ Pages Functions.',
            ],
          },
        };
      }

      updatePlatformCommandAvailability();

      if (!silent) {
        renderPlatformStatusCard();
      }

      return platformStatus;
    }

    function updateCloudCommandAvailability() {
      if (freeModeEnabled) {
        setCommandButtonsDisabled(
          ['auth-send-link', 'auth-sign-out', 'cloud-refresh-plans', 'cloud-load-plan', 'cloud-save-plan'],
          true
        );
        if (authEmail) authEmail.disabled = true;
        if (cloudPlanName) cloudPlanName.disabled = true;
        if (cloudPlanList) cloudPlanList.disabled = true;
        return;
      }

      const configured = isSupabaseConfigured();
      const signedIn = Boolean(authSession?.user);

      setCommandButtonsDisabled('auth-send-link', !configured);
      setCommandButtonsDisabled('auth-sign-out', !configured || !signedIn);
      setCommandButtonsDisabled(
        ['cloud-refresh-plans', 'cloud-load-plan', 'cloud-save-plan'],
        !configured || !signedIn
      );

      if (authEmail) authEmail.disabled = !configured;
      if (cloudPlanName) cloudPlanName.disabled = !configured || !signedIn;
      if (cloudPlanList) cloudPlanList.disabled = !configured || !signedIn;
    }

    function hasPendingCloudAuthRedirect() {
      if (freeModeEnabled) {
        return false;
      }

      const { hash = '', search = '' } = window.location;
      const combined = `${search}${hash}`;

      return ['access_token=', 'refresh_token=', 'token_hash=', 'code=', 'type=magiclink'].some(
        (marker) => combined.includes(marker)
      );
    }

    function renderFreeModeCloudCards() {
      if (authStatus) {
        setStatusCard(authStatus, {
          tone: 'neutral',
          title: 'Free mode: cloud auth đã tắt',
          lines: [
            'Bản thi hiện không dùng Supabase để tránh chi phí vận hành.',
            'Nếu cần chia sẻ phương án, hãy dùng Export JSON hoặc Export HTML.',
          ],
        });
      }

      if (cloudPlanStatus) {
        setStatusCard(cloudPlanStatus, {
          tone: 'neutral',
          title: 'Free mode: cloud save đã tắt',
          lines: [
            'Dùng Save scene để lưu trên máy hiện tại.',
            'Dùng Export JSON và Import JSON để chuyển scene giữa các máy.',
          ],
        });
      }
    }

    function renderCloudPlanStatus(plan = null) {
      if (!cloudPlanStatus) return;

      if (freeModeEnabled) {
        renderFreeModeCloudCards();
        return;
      }

      if (!plan) {
        setStatusCard(cloudPlanStatus, {
          tone: 'neutral',
          title: 'Cloud plans',
          lines: [
            authSession?.user
              ? 'Chọn một plan để nạp hoặc lưu snapshot mới theo tên bạn nhập.'
              : 'Đăng nhập trước để mở khóa danh sách phương án cloud.',
          ],
        });
        return;
      }

      const readinessScore = Number(plan.summary?.readinessScore || 0);
      const tone =
        readinessScore >= 85 ? 'positive' : readinessScore >= 65 ? 'warning' : 'danger';

      setStatusCard(cloudPlanStatus, {
        tone,
        title: plan.name || 'Cloud plan',
        lines: [
          ...getCloudPlanStatusLines(plan),
          `Updated: ${new Date(plan.updated_at || plan.created_at || Date.now()).toLocaleString('vi-VN')}`,
        ],
      });
    }

    function renderCloudPlanList(plans = [], { preserveSelection = true } = {}) {
      if (!cloudPlanList) return;

      if (freeModeEnabled) {
        cloudPlanList.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Free mode: dùng Save scene hoặc Export JSON';
        cloudPlanList.appendChild(option);
        cloudPlanList.value = '';
        activeCloudPlanId = null;
        renderCloudPlanStatus(null);
        return;
      }

      const previousSelection = preserveSelection ? activeCloudPlanId || cloudPlanList.value : null;
      cloudPlanList.innerHTML = '';

      if (!plans.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Chưa có phương án cloud nào';
        cloudPlanList.appendChild(option);
        cloudPlanList.value = '';
        activeCloudPlanId = null;
        renderCloudPlanStatus(null);
        return;
      }

      plans.forEach((plan) => {
        const option = document.createElement('option');
        option.value = plan.id;
        option.textContent = formatCloudPlanOptionLabel(plan);
        cloudPlanList.appendChild(option);
      });

      const nextSelection =
        plans.find((plan) => plan.id === previousSelection)?.id || plans[0]?.id || '';

      cloudPlanList.value = nextSelection;
      activeCloudPlanId = nextSelection || null;
      renderCloudPlanStatus(findCloudPlanById(activeCloudPlanId));
    }

    async function refreshCloudPlans({ preserveSelection = true, silent = false } = {}) {
      if (freeModeEnabled) {
        cloudPlansCache = [];
        renderCloudPlanList([]);
        updateCloudCommandAvailability();
        return [];
      }

      if (!isSupabaseConfigured()) {
        cloudPlansCache = [];
        renderCloudPlanList([]);
        updateCloudCommandAvailability();
        return [];
      }

      if (!authSession?.user) {
        cloudPlansCache = [];
        renderCloudPlanList([]);
        updateCloudCommandAvailability();
        return [];
      }

      try {
        const plans = await listCloudPlans(24);
        cloudPlansCache = plans;
        renderCloudPlanList(plans, { preserveSelection });

        if (!silent) {
          setStatusCard(cloudPlanStatus, {
            tone: plans.length ? 'positive' : 'neutral',
            title: plans.length ? 'Cloud đã đồng bộ' : 'Cloud đang trống',
            lines: plans.length
              ? [`Đã đồng bộ ${plans.length} snapshot mới nhất từ workspace cloud.`]
              : ['Tài khoản đã sẵn sàng. Hãy lưu snapshot đầu tiên lên cloud.'],
          });
          renderCloudPlanStatus(findCloudPlanById(activeCloudPlanId));
        }

        return plans;
      } catch (error) {
        cloudPlansCache = [];
        renderCloudPlanList([]);
        setStatusCard(cloudPlanStatus, {
          tone: 'danger',
          title: 'Cloud sync lỗi',
          lines: [error instanceof Error ? error.message : 'Không thể tải danh sách plan từ cloud.'],
        });
        throw error;
      }
    }

    async function activateCloudWorkspace({ syncSession = true, silent = false } = {}) {
      if (freeModeEnabled) {
        authSession = null;
        cloudPlansCache = [];
        renderCloudPlanList([]);
        renderFreeModeCloudCards();
        updateCloudCommandAvailability();
        return null;
      }

      if (!isSupabaseConfigured()) {
        updateCloudCommandAvailability();
        return null;
      }

      if (!cloudRuntimeInitialized) {
        removeAuthSubscription = await subscribeToAuthChanges(({ session }) => {
          authSession = session;
          updateCloudCommandAvailability();

          if (authSession?.user) {
            setStatusCard(authStatus, {
              tone: 'positive',
              title: 'Cloud auth đã mở',
              lines: [
                `Email: ${authSession.user.email || 'Không xác định'}`,
                'Session mới vừa được đồng bộ vào workspace hiện tại.',
              ],
            });
            refreshCloudPlans({ preserveSelection: true, silent: true }).catch(() => {});
          } else {
            cloudPlansCache = [];
            activeCloudPlanId = null;
            renderCloudPlanList([]);
            setStatusCard(authStatus, {
              tone: 'neutral',
              title: 'Chưa đăng nhập cloud',
              lines: ['Nhập email work và bấm Magic link để mở khóa workspace cloud.'],
            });
          }
        });
        cloudRuntimeInitialized = true;
      }

      if (!syncSession) {
        updateCloudCommandAvailability();
        return authSession;
      }

      return syncAuthSession({ silent });
    }

    async function syncAuthSession({ silent = false } = {}) {
      if (freeModeEnabled) {
        authSession = null;
        cloudPlansCache = [];
        renderCloudPlanList([]);
        renderFreeModeCloudCards();
        updateCloudCommandAvailability();
        return null;
      }

      if (!isSupabaseConfigured()) {
        authSession = null;
        cloudPlansCache = [];
        renderCloudPlanList([]);
        setStatusCard(authStatus, {
          tone: 'warning',
          title: 'Supabase chưa cấu hình',
          lines: [
            'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.',
            'Cloud auth và save/load plan sẽ tự mở khi bạn thêm env vào project.',
          ],
        });
        updateCloudCommandAvailability();
        return null;
      }

      try {
        authSession = await getSupabaseSession();
        updateCloudCommandAvailability();

        if (authSession?.user) {
          setStatusCard(authStatus, {
            tone: 'positive',
            title: 'Cloud auth đã mở',
            lines: [
              `Email: ${authSession.user.email || 'Không xác định'}`,
              'Magic link hợp lệ. Bạn có thể lưu và nạp phương án trực tiếp từ Supabase.',
            ],
          });
          await refreshCloudPlans({ preserveSelection: true, silent: true });
        } else {
          cloudPlansCache = [];
          renderCloudPlanList([]);
          setStatusCard(authStatus, {
            tone: 'neutral',
            title: 'Chưa đăng nhập cloud',
            lines: ['Nhập email work và bấm Magic link để mở khóa workspace cloud.'],
          });
        }

        if (!silent && authSession?.user) {
          renderCloudPlanStatus(findCloudPlanById(activeCloudPlanId));
        }

        return authSession;
      } catch (error) {
        authSession = null;
        cloudPlansCache = [];
        renderCloudPlanList([]);
        setStatusCard(authStatus, {
          tone: 'danger',
          title: 'Cloud auth lỗi',
          lines: [error instanceof Error ? error.message : 'Không thể đọc session Supabase hiện tại.'],
        });
        updateCloudCommandAvailability();
        return null;
      }
    }

    async function handleSendMagicLink() {
      if (freeModeEnabled) {
        renderFreeModeCloudCards();
        return;
      }

      if (!isSupabaseConfigured()) {
        setStatusCard(authStatus, {
          tone: 'warning',
          title: 'Thiếu cấu hình Supabase',
          lines: ['Hãy thêm env Supabase trước khi gửi magic link.'],
        });
        return;
      }

      const email = authEmail?.value?.trim();
      if (!isValidEmail(email)) {
        setStatusCard(authStatus, {
          tone: 'warning',
          title: 'Email chưa hợp lệ',
          lines: ['Nhập đúng email công việc trước khi gửi magic link.'],
        });
        return;
      }

      try {
        await activateCloudWorkspace({ syncSession: false, silent: true });
        await sendMagicLink(email, getPublicAppUrl());
        setStatusCard(authStatus, {
          tone: 'positive',
          title: 'Magic link đã gửi',
          lines: [
            `Địa chỉ: ${email}`,
            'Mở email và click link để hoàn tất đăng nhập vào cloud workspace.',
          ],
        });
      } catch (error) {
        setStatusCard(authStatus, {
          tone: 'danger',
          title: 'Không gửi được magic link',
          lines: [error instanceof Error ? error.message : 'Supabase từ chối yêu cầu gửi magic link.'],
        });
      }
    }

    async function handleSignOutCloud() {
      if (freeModeEnabled) {
        renderFreeModeCloudCards();
        return;
      }

      await activateCloudWorkspace({ syncSession: false, silent: true });

      if (!authSession?.user) {
        setStatusCard(authStatus, {
          tone: 'neutral',
          title: 'Cloud đã khóa',
          lines: ['Hiện chưa có session đăng nhập nào để sign out.'],
        });
        return;
      }

      try {
        await signOutSupabase();
        authSession = null;
        cloudPlansCache = [];
        activeCloudPlanId = null;
        renderCloudPlanList([]);
        setStatusCard(authStatus, {
          tone: 'neutral',
          title: 'Đã sign out',
          lines: ['Workspace cloud đã được khóa lại trên trình duyệt hiện tại.'],
        });
        updateCloudCommandAvailability();
      } catch (error) {
        setStatusCard(authStatus, {
          tone: 'danger',
          title: 'Sign out lỗi',
          lines: [error instanceof Error ? error.message : 'Không thể sign out khỏi Supabase.'],
        });
      }
    }

    async function handleRefreshCloudPlans() {
      if (freeModeEnabled) {
        renderFreeModeCloudCards();
        return;
      }

      await activateCloudWorkspace({ syncSession: true, silent: false });

      if (!authSession?.user) {
        return;
      }

      await refreshCloudPlans({ preserveSelection: true, silent: false });
    }

    async function handleCloudSavePlan() {
      if (freeModeEnabled) {
        renderFreeModeCloudCards();
        return;
      }

      await activateCloudWorkspace({ syncSession: true, silent: true });

      if (!authSession?.user) {
        setStatusCard(cloudPlanStatus, {
          tone: 'warning',
          title: 'Chưa mở cloud workspace',
          lines: ['Đăng nhập bằng magic link trước khi lưu phương án lên cloud.'],
        });
        return;
      }

      const planName =
        cloudPlanName?.value?.trim() ||
        commercialProjectName?.value?.trim() ||
        `Packet Opt Plan ${new Date().toLocaleDateString('vi-VN')}`;
      const selectedPlan = getSelectedCloudPlan();
      const shouldUpdateExisting = Boolean(selectedPlan && planName === selectedPlan.name);

      try {
        const savedPlan = await savePlanToCloud({
          planId: shouldUpdateExisting ? selectedPlan.id : null,
          name: planName,
          scene: captureSceneState(),
          summary: getCurrentCloudPlanSummary(),
          containerType: contType?.value || 'custom',
        });

        activeCloudPlanId = savedPlan.id;
        if (cloudPlanName) cloudPlanName.value = savedPlan.name || planName;
        await refreshCloudPlans({ preserveSelection: true, silent: true });
        renderCloudPlanStatus(findCloudPlanById(activeCloudPlanId));
        setStatusCard(cloudPlanStatus, {
          tone: 'positive',
          title: shouldUpdateExisting ? 'Đã cập nhật snapshot cloud' : 'Đã lưu snapshot cloud',
          lines: [
            `Plan: ${savedPlan.name || planName}`,
            shouldUpdateExisting
              ? 'Snapshot hiện có đã được cập nhật theo scene mới nhất.'
              : 'Một snapshot mới đã được tạo trong workspace cloud.',
          ],
        });
        showStatusMessage({
          title: '☁️ Đã lưu phương án lên cloud',
          lines: [
            `Tên plan: <b>${escapeHtml(savedPlan.name || planName)}</b>`,
            shouldUpdateExisting
              ? 'Snapshot hiện có đã được cập nhật theo layout mới nhất.'
              : 'Đã tạo snapshot mới để đội khác có thể mở lại cùng phương án.',
          ],
          color: '#22c55e',
          background: 'rgba(34,197,94,0.12)',
          border: 'rgba(74,222,128,0.45)',
        });
        refreshOperationsSummary({
          mode: 'saved',
          action: `Đã lưu phương án "${savedPlan.name || planName}" lên cloud workspace.`,
        });
      } catch (error) {
        setStatusCard(cloudPlanStatus, {
          tone: 'danger',
          title: 'Không lưu được plan cloud',
          lines: [error instanceof Error ? error.message : 'Supabase từ chối lưu snapshot hiện tại.'],
        });
      }
    }

    async function handleCloudLoadPlan() {
      if (freeModeEnabled) {
        renderFreeModeCloudCards();
        return;
      }

      await activateCloudWorkspace({ syncSession: true, silent: true });

      if (!authSession?.user) {
        setStatusCard(cloudPlanStatus, {
          tone: 'warning',
          title: 'Cloud chưa mở',
          lines: ['Đăng nhập trước khi nạp phương án đã lưu từ cloud.'],
        });
        return;
      }

      const selectedPlan = getSelectedCloudPlan();
      if (!selectedPlan?.id) {
        setStatusCard(cloudPlanStatus, {
          tone: 'warning',
          title: 'Chưa chọn plan',
          lines: ['Hãy chọn một snapshot trong danh sách cloud rồi thử lại.'],
        });
        return;
      }

      try {
        const loadedPlan = await loadCloudPlan(selectedPlan.id);
        const applied = applySceneState(loadedPlan.scene);
        if (!applied) {
          throw new Error('Scene cloud không hợp lệ hoặc không thể áp dụng vào workspace hiện tại.');
        }

        activeCloudPlanId = loadedPlan.id;
        if (cloudPlanName) cloudPlanName.value = loadedPlan.name || '';
        pushHistorySnapshot();
        renderCloudPlanStatus({
          ...selectedPlan,
          ...loadedPlan,
        });
        showStatusMessage({
          title: '📥 Đã nạp phương án từ cloud',
          lines: [
            `Plan: <b>${escapeHtml(loadedPlan.name || 'Cloud plan')}</b>`,
            'Scene hiện tại đã được khôi phục từ workspace cloud.',
          ],
          color: '#38bdf8',
          background: 'rgba(59,130,246,0.12)',
          border: 'rgba(96,165,250,0.4)',
        });
        refreshOperationsSummary({
          mode: 'loaded',
          action: `Đã nạp phương án "${loadedPlan.name || 'Cloud plan'}" từ cloud workspace.`,
          result: null,
        });
      } catch (error) {
        setStatusCard(cloudPlanStatus, {
          tone: 'danger',
          title: 'Không nạp được plan cloud',
          lines: [error instanceof Error ? error.message : 'Cloud plan đã chọn không thể khôi phục.'],
        });
      }
    }

    async function handleSubmitLead() {
      const capabilityState = getPlatformCapabilityState();
      if (!capabilityState.canSubmitLead) {
        renderPlatformStatusCard();
        return;
      }

      const email = leadEmail?.value?.trim();
      if (!isValidEmail(email)) {
        setStatusCard(crmStatus, {
          tone: 'warning',
          title: 'Lead email chưa hợp lệ',
          lines: ['Cần email hợp lệ để lưu lead và gửi follow-up cho đội sales.'],
        });
        return;
      }

      try {
        const { submitLeadCapture } = await loadPlatformApiModule();
        const response = await submitLeadCapture({
          name: leadName?.value?.trim() || '',
          email,
          company: leadCompany?.value?.trim() || '',
          message: leadMessage?.value?.trim() || '',
          source: 'packet-opt-control-tower',
          context: {
            summary: getCurrentCloudPlanSummary(),
            commercialSettings: readCommercialInputs(),
          },
        });

        if (reportRecipientEmail && !reportRecipientEmail.value.trim()) {
          reportRecipientEmail.value = email;
        }
        if (authEmail && !authEmail.value.trim()) {
          authEmail.value = email;
        }

        setStatusCard(crmStatus, {
          tone: 'positive',
          title: 'Lead đã vào pipeline',
          lines: [
            response.persisted
              ? 'Lead đã được ghi vào Supabase CRM.'
              : 'Lead chưa được ghi DB nhưng workflow email vẫn đã chạy.',
            response.emailNotified
              ? 'Đội sales/ops đã nhận email thông báo lead mới.'
              : 'Chưa có email notify vì Resend hoặc recipient chưa được cấu hình.',
          ],
        });
      } catch (error) {
        setStatusCard(crmStatus, {
          tone: 'danger',
          title: 'Lead capture lỗi',
          lines: [error instanceof Error ? error.message : 'Không thể gửi lead vào workflow CRM.'],
        });
      }
    }

    async function handleSendOperationalReport() {
      const capabilityState = getPlatformCapabilityState();
      if (!capabilityState.canSendReport) {
        renderPlatformStatusCard();
        return;
      }

      const recipientEmail = reportRecipientEmail?.value?.trim();
      const hasWorkspaceData = getValidCargoItems().length > 0 || boxes.length > 0;

      if (!isValidEmail(recipientEmail)) {
        setStatusCard(crmStatus, {
          tone: 'warning',
          title: 'Email nhận report chưa hợp lệ',
          lines: ['Nhập đúng email đích trước khi gửi executive report.'],
        });
        return;
      }

      if (!hasWorkspaceData) {
        setStatusCard(crmStatus, {
          tone: 'warning',
          title: 'Chưa có dữ liệu để gửi report',
          lines: ['Hãy nạp manifest hoặc dựng ít nhất một layout trước khi gửi báo cáo.'],
        });
        return;
      }

      const commercialSettings = readCommercialInputs();
      const summary = getCurrentCloudPlanSummary();
      const subjectBase = commercialSettings.projectName || 'Packet Opt Executive Report';

      try {
        const { sendOperationalReportEmail } = await loadPlatformApiModule();
        const reportHtml = await getCurrentReportHtml();
        const response = await sendOperationalReportEmail({
          recipientEmail,
          subject: `${subjectBase} • ${new Date().toLocaleDateString('vi-VN')}`,
          html: reportHtml,
          summary,
          context: {
            contactName: leadName?.value?.trim() || '',
            contactEmail: leadEmail?.value?.trim() || '',
            company: leadCompany?.value?.trim() || '',
          },
        });

        setStatusCard(crmStatus, {
          tone: 'positive',
          title: 'Report đã gửi',
          lines: [
            `Đích: ${recipientEmail}`,
            response.logged
              ? 'Lần gửi này đã được log lại trong workflow nội bộ.'
              : 'Email đã đi nhưng chưa có log DB do Supabase service chưa cấu hình.',
          ],
        });
        refreshOperationsSummary({
          mode: 'report',
          action: `Đã gửi executive report qua email tới ${recipientEmail}.`,
        });
      } catch (error) {
        setStatusCard(crmStatus, {
          tone: 'danger',
          title: 'Không gửi được report',
          lines: [error instanceof Error ? error.message : 'API email workflow đang từ chối yêu cầu.'],
        });
      }
    }

    function syncProjectPresetHint() {
      if (!projectPresetHint) return;

      const preset =
        SCENARIO_PRESETS.find((item) => item.id === projectPreset?.value) || SCENARIO_PRESETS[0];

      projectPresetHint.innerHTML = `
        <b>${escapeHtml(preset.label)}</b><br/>
        ${escapeHtml(preset.description)}
      `;
    }

    async function applyScenarioPreset() {
      const presetId = projectPreset?.value || SCENARIO_PRESETS[0].id;
      const preset =
        SCENARIO_PRESETS.find((item) => item.id === presetId) || SCENARIO_PRESETS[0];
      try {
        const { buildPresetSceneState } = await loadProjectWorkflowModule();
        const sceneSeed = buildPresetSceneState(preset.id, captureSceneState());

        applySceneState(sceneSeed);
        pushHistorySnapshot();

        showStatusMessage({
          title: `🧭 Đã nạp preset ${preset.label}`,
          lines: [
            preset.description,
            `Container: <b>${sceneSeed.container.d} × ${sceneSeed.container.w} × ${sceneSeed.container.h}</b> cm`,
            `Số SKU mẫu: <b>${sceneSeed.multiBoxTypes.length}</b>`,
          ],
          color: '#22c55e',
          background: 'rgba(34,197,94,0.12)',
          border: 'rgba(74,222,128,0.45)',
        });

        refreshOperationsSummary({
          mode: 'preset',
          action: `Đã nạp preset "${preset.label}" để demo nhanh luồng pack.`,
          result: null,
        });
      } catch (error) {
        showStatusMessage({
          title: '❌ Không thể nạp preset',
          lines: [
            `Preset: <b>${preset.label}</b>`,
            `<b>Chi tiết:</b> ${error instanceof Error ? error.message : 'Không xác định'}`,
          ],
          color: '#fb7185',
          background: 'rgba(244,63,94,0.12)',
          border: 'rgba(251,113,133,0.45)',
        });
        refreshOperationsSummary({
          mode: 'attention',
          action: `Nạp preset "${preset.label}" thất bại.`,
          result: null,
        });
      }
    }

    async function exportProjectPlan() {
      try {
        const { buildSceneBundle } = await loadProjectWorkflowModule();
        const bundle = buildSceneBundle(captureSceneState());
        const blob = new Blob([JSON.stringify(bundle, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        link.href = url;
        link.download = `packet-opt-plan-${timestamp}.json`;
        link.click();
        URL.revokeObjectURL(url);

        showStatusMessage({
          title: '📤 Đã xuất phương án ra JSON',
          lines: [
            'File chứa toàn bộ container, item list, layout 3D và các tuỳ chọn viewer hiện tại.',
            'Bạn có thể gửi file này cho người khác để import lại đúng phương án đang xem.',
          ],
          color: '#38bdf8',
          background: 'rgba(59,130,246,0.12)',
          border: 'rgba(96,165,250,0.4)',
        });

        refreshOperationsSummary({
          mode: 'exported',
          action: 'Đã xuất file JSON của phương án hiện tại.',
        });
      } catch (error) {
        showStatusMessage({
          title: '❌ Không thể xuất JSON',
          lines: [
            'Không thể dựng bundle phương án hiện tại.',
            `<b>Chi tiết:</b> ${error instanceof Error ? error.message : 'Không xác định'}`,
          ],
          color: '#fb7185',
          background: 'rgba(244,63,94,0.12)',
          border: 'rgba(251,113,133,0.45)',
        });
        refreshOperationsSummary({
          mode: 'attention',
          action: 'Xuất JSON thất bại.',
          result: null,
        });
      }
    }

    function triggerProjectPlanImport() {
      planImportInput?.click();
    }

    async function handleProjectPlanImport(event) {
      const file = event.target?.files?.[0];
      if (!file) return;

      try {
        const { unwrapImportedSceneState } = await loadProjectWorkflowModule();
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        const importedState = unwrapImportedSceneState(parsed);

        applySceneState(importedState);
        pushHistorySnapshot();

        showStatusMessage({
          title: '📥 Đã nhập phương án từ JSON',
          lines: [
            `Tên file: <b>${file.name}</b>`,
            'Scene đã được khôi phục với container, item list và layout đi kèm trong file.',
          ],
          color: '#22c55e',
          background: 'rgba(34,197,94,0.12)',
          border: 'rgba(74,222,128,0.45)',
        });

        refreshOperationsSummary({
          mode: 'imported',
          action: `Đã import phương án từ file "${file.name}".`,
          result: null,
        });
      } catch (error) {
        showStatusMessage({
          title: '❌ Không thể nhập file JSON',
          lines: [
            'File không đúng định dạng scene của app hoặc đang bị lỗi JSON.',
            `<b>Chi tiết:</b> ${error instanceof Error ? error.message : 'Không xác định'}`,
          ],
          color: '#fb7185',
          background: 'rgba(244,63,94,0.12)',
          border: 'rgba(251,113,133,0.45)',
        });

        refreshOperationsSummary({
          mode: 'attention',
          action: 'Import thất bại. File JSON cần đúng định dạng scene của app.',
          result: null,
        });
      } finally {
        event.target.value = '';
      }
    }

    function applyManifestItems(importedItems, sourceLabel = 'manifest') {
      const normalizedItems = cloneMultiBoxTypeList(importedItems).filter(
        (item) =>
          Number(item.w) > 0 &&
          Number(item.h) > 0 &&
          Number(item.d) > 0 &&
          Number(item.weight) > 0 &&
          Number(item.qty) > 0
      );

      if (normalizedItems.length === 0) {
        throw new Error('Manifest không có item hợp lệ sau khi parse.');
      }

      multiBoxTypes = normalizedItems;
      renderMultiBoxTypes();
      renderPreviewItemsScene();

      const firstItem = normalizedItems[0];
      if (calcBoxLength) calcBoxLength.value = firstItem.d;
      if (calcBoxWidth) calcBoxWidth.value = firstItem.w;
      if (calcBoxHeight) calcBoxHeight.value = firstItem.h;
      if (calcBoxWeight) calcBoxWeight.value = firstItem.weight;

      showStatusMessage({
        title: '📥 Đã áp manifest hàng loạt',
        lines: [
          `Nguồn dữ liệu: <b>${sourceLabel}</b>`,
          `Số SKU hợp lệ: <b>${normalizedItems.length}</b>`,
          `Tổng units yêu cầu: <b>${normalizedItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)}</b>`,
        ],
        color: '#22c55e',
        background: 'rgba(34,197,94,0.12)',
        border: 'rgba(74,222,128,0.45)',
      });

      refreshOperationsSummary({
        mode: 'manifest',
        action: `Đã nạp manifest từ ${sourceLabel} và dựng preview item list.`,
        result: null,
      });
    }

    async function importManifestFromTextarea() {
      try {
        const { parseManifestText } = await loadProjectWorkflowModule();
        const items = parseManifestText(manifestPasteInput?.value || '');
        applyManifestItems(items, 'ô dán manifest');
        pushHistorySnapshot();
      } catch (error) {
        showStatusMessage({
          title: '❌ Không đọc được manifest',
          lines: [
            `<b>Chi tiết:</b> ${error instanceof Error ? error.message : 'Không xác định'}`,
            'Hãy kiểm tra lại header CSV hoặc JSON item list.',
          ],
          color: '#fb7185',
          background: 'rgba(244,63,94,0.12)',
          border: 'rgba(251,113,133,0.45)',
        });
        refreshOperationsSummary({
          mode: 'attention',
          action: 'Manifest chưa đọc được. Cần chỉnh lại CSV hoặc JSON.',
          result: null,
        });
      }
    }

    function triggerManifestFileImport() {
      manifestImportInput?.click();
    }

    async function handleManifestFileImport(event) {
      const file = event.target?.files?.[0];
      if (!file) return;

      try {
        const { parseManifestText } = await loadProjectWorkflowModule();
        const raw = await file.text();
        const items = parseManifestText(raw);
        applyManifestItems(items, `file ${file.name}`);
        pushHistorySnapshot();
      } catch (error) {
        showStatusMessage({
          title: '❌ Không thể nhập file manifest',
          lines: [
            `Tên file: <b>${file.name}</b>`,
            `<b>Chi tiết:</b> ${error instanceof Error ? error.message : 'Không xác định'}`,
          ],
          color: '#fb7185',
          background: 'rgba(244,63,94,0.12)',
          border: 'rgba(251,113,133,0.45)',
        });
        refreshOperationsSummary({
          mode: 'attention',
          action: `Import manifest từ file "${file.name}" thất bại.`,
          result: null,
        });
      } finally {
        event.target.value = '';
      }
    }

    async function exportOperationalReport() {
      try {
        const html = await getCurrentReportHtml();
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        link.href = url;
        link.download = `packet-opt-report-${timestamp}.html`;
        link.click();
        URL.revokeObjectURL(url);

        showStatusMessage({
          title: '🧾 Đã xuất báo cáo HTML',
          lines: [
            'Báo cáo chứa KPI, manifest, các nhóm item bị loại và nhận định phương án hiện tại.',
            'Bạn có thể mở trực tiếp bằng trình duyệt hoặc gửi cho người khác review.',
          ],
          color: '#38bdf8',
          background: 'rgba(59,130,246,0.12)',
          border: 'rgba(96,165,250,0.4)',
        });

        refreshOperationsSummary({
          mode: 'report',
          action: 'Đã xuất báo cáo HTML của phương án hiện tại.',
        });
      } catch (error) {
        showStatusMessage({
          title: '❌ Không thể xuất báo cáo HTML',
          lines: [
            'Không thể dựng executive report từ snapshot hiện tại.',
            `<b>Chi tiết:</b> ${error instanceof Error ? error.message : 'Không xác định'}`,
          ],
          color: '#fb7185',
          background: 'rgba(244,63,94,0.12)',
          border: 'rgba(251,113,133,0.45)',
        });
        refreshOperationsSummary({
          mode: 'attention',
          action: 'Xuất report HTML thất bại.',
          result: null,
        });
      }
    }

    function runCommercialPreflightReview() {
      const preflight = runCommercialPreflight({
        items: multiBoxTypes,
        container: getCurrentContainerSize(),
        maxWeight: getCurrentContainerMaxLoad(),
        floorLoadLimit: getPackingFloorLoadLimit(),
        settings: readCommercialInputs(),
      });
      const alertColors = {
        critical: '#fb7185',
        warning: '#fbbf24',
        info: '#60a5fa',
      };
      const alertHtml =
        preflight.alerts.length > 0
          ? preflight.alerts
              .map(
                (alert) => `
                  <div style="padding:10px 12px;border-radius:10px;background:rgba(15,23,42,0.62);border:1px solid ${alertColors[alert.severity] || '#60a5fa'};line-height:1.6;">
                    <div style="font-weight:700;color:${alertColors[alert.severity] || '#60a5fa'};">${alert.title}</div>
                    <div>${alert.detail}</div>
                  </div>
                `
              )
              .join('')
          : '<div style="color:#86efac;">Không có cảnh báo lớn. Manifest đang khá sạch để đi tiếp.</div>';
      const optimizerAdviceHtml = preflight.optimizerAdvice
        ? `
          <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(14,116,144,0.10);border:1px solid rgba(34,211,238,0.28);color:#cffafe;line-height:1.65;">
            <div style="font-weight:700;color:#67e8f9;margin-bottom:8px;">🤖 Optimizer advisor</div>
            <div><b>Planning mode:</b> ${preflight.optimizerAdvice.planningMode}</div>
            <div><b>Chiến lược ưu tiên:</b> ${preflight.optimizerAdvice.primaryStrategyLabel}</div>
            <div><b>Độ tự tin:</b> ${preflight.optimizerAdvice.confidence}%</div>
            <div style="margin-top:8px;">${preflight.optimizerAdvice.headline}</div>
            <div style="margin-top:8px;">${preflight.optimizerAdvice.rationale.map((item) => `• ${item}`).join('<br/>')}</div>
          </div>
        `
        : '';

      reportEl.innerHTML = `
        <div style="color:#38bdf8;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          🧪 COMMERCIAL PREFLIGHT
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>Shipment:</div>
          <div style="text-align:right;font-weight:bold;">${preflight.settings.projectName}</div>

          <div>Customer:</div>
          <div style="text-align:right;font-weight:bold;">${preflight.settings.customerName}</div>

          <div>Service level:</div>
          <div style="text-align:right;font-weight:bold;">${preflight.serviceLabel}</div>

          <div>Readiness score:</div>
          <div style="text-align:right;font-weight:bold;">${preflight.score.toFixed(0)}/100 • ${preflight.scoreLabel}</div>

          <div>Risk profile:</div>
          <div style="text-align:right;font-weight:bold;">${preflight.riskLabel}</div>

          <div>Volume demand:</div>
          <div style="text-align:right;font-weight:bold;">${(preflight.ratios.requestedVolumeRatio * 100).toFixed(1)}%</div>

          <div>Weight demand:</div>
          <div style="text-align:right;font-weight:bold;">${(preflight.ratios.requestedWeightRatio * 100).toFixed(1)}%</div>

          <div>High-risk units:</div>
          <div style="text-align:right;font-weight:bold;">${preflight.counts.highRiskUnitCount}</div>
        </div>

        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.35);color:#dbeafe;line-height:1.65;">
          Giá trị lô hàng: <b>${formatCurrencyUsd(preflight.finance.declaredValue)}</b> •
          Cước container: <b>${formatCurrencyUsd(preflight.finance.freightCost)}</b> •
          Target fill: <b>${preflight.finance.targetUtilization.toFixed(0)}%</b> •
          Target lệch tải: <b>${preflight.finance.targetMaxImbalance.toFixed(0)}%</b>
        </div>

        <div style="display:grid;gap:8px;margin-top:12px;">
          ${alertHtml}
        </div>

        ${optimizerAdviceHtml}

        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(16,185,129,0.10);border:1px solid rgba(52,211,153,0.28);color:#d1fae5;line-height:1.65;">
          <div style="font-weight:700;color:#86efac;margin-bottom:8px;">Khuyến nghị tiếp theo</div>
          ${preflight.recommendations.map((item) => `• ${item}`).join('<br/>')}
        </div>
      `;
      reportEl.style.display = 'block';
      refreshOperationsSummary({
        mode: 'preflight',
        action: 'Đã chạy commercial preflight để audit manifest, SLA và rủi ro vận hành.',
      });
    }

    function formatPriorityGroupLabel(priorityGroup) {
      return `Nhóm ${normalizePriorityGroup(priorityGroup)}`;
    }

    function formatAllowRotateLabel(item) {
      return (item.allowRotate ?? item.rotationMode !== 'fixed') ? 'Có' : 'Không';
    }

    function formatNoStackLabel(value) {
      return value ? 'Có' : 'Không';
    }

    function formatNoTiltLabel(value) {
      return value ? 'Có' : 'Không';
    }

    function getPackingFloorLoadLimit() {
      const value = Number(packingFloorLoadLimit?.value || 0);
      return value > 0 ? value : Infinity;
    }

    function getWallOcclusionMode() {
      return wallOcclusionMode?.value || 'hide';
    }

    function getCutawayMode() {
      return cutawayMode?.value || 'off';
    }

    function resolveAutoCutawayFace() {
      const container = getCurrentContainerSize();
      return resolveContainerFaceFromCamera({
        camera,
        height: container.h,
      });
    }

    function updateCutawayPlane() {
      const container = getCurrentContainerSize();
      const mode = getCutawayMode();

      if (mode === 'off') {
        return null;
      }

      const resolvedMode = mode === 'auto' ? resolveAutoCutawayFace() : mode;

      if (resolvedMode === 'door') {
        sharedCutawayPlane.normal.set(0, 0, 1);
        sharedCutawayPlane.constant = 0;
        return sharedCutawayPlane;
      }

      if (resolvedMode === 'head') {
        sharedCutawayPlane.normal.set(0, 0, -1);
        sharedCutawayPlane.constant = 0;
        return sharedCutawayPlane;
      }

      if (resolvedMode === 'left') {
        sharedCutawayPlane.normal.set(-1, 0, 0);
        sharedCutawayPlane.constant = 0;
        return sharedCutawayPlane;
      }

      if (resolvedMode === 'right') {
        sharedCutawayPlane.normal.set(1, 0, 0);
        sharedCutawayPlane.constant = 0;
        return sharedCutawayPlane;
      }

      sharedCutawayPlane.normal.set(0, 1, 0);
      sharedCutawayPlane.constant = container.h / 2;
      return sharedCutawayPlane;
    }

    function getActiveClippingPlanes() {
      return getCutawayMode() === 'off' ? [] : clippingPlaneList;
    }

    function syncViewerClippingTargets() {
      updateCutawayPlane();
      const clippingPlanes = getActiveClippingPlanes();

      setContainerClipping(containerSys.group, clippingPlanes);
      boxes.forEach((box) => setCartonClipping(box, clippingPlanes));
    }

    function formatViewerFace(face) {
      if (face === 'head') return 'Đầu container';
      if (face === 'door') return 'Cửa container';
      if (face === 'left') return 'Vách trái';
      if (face === 'right') return 'Vách phải';
      if (face === 'side') return 'Hai vách hông';
      if (face === 'top') return 'Nóc container';
      return 'Không xác định';
    }

    function updateViewerStatus() {
      if (!viewerStatus) return;

      const container = getCurrentContainerSize();
      const cameraOcclusionFace =
        autoHideWalls?.checked !== false
          ? resolveContainerFaceFromCamera({ camera, height: container.h })
          : null;
      const occludedFace =
        cameraOcclusionFace === 'left' || cameraOcclusionFace === 'right' ? 'side' : cameraOcclusionFace;
      const cameraOffset = camera.position.clone().sub(orbit.target);
      const distance = cameraOffset.length();
      const yaw = sceneSys.THREE.MathUtils.radToDeg(Math.atan2(cameraOffset.x, cameraOffset.z));
      const pitch =
        distance > 0
          ? sceneSys.THREE.MathUtils.radToDeg(Math.asin(cameraOffset.y / distance))
          : 0;
      const cutaway = getCutawayMode();
      const cutawayFace = cutaway === 'off' ? null : cutaway === 'auto' ? resolveAutoCutawayFace() : cutaway;
      const selectedLabel = selected?.userData?.label || 'Chưa chọn';
      const selectedMeta = selected
        ? `#${selected.userData.id} • ${selected.userData.size.w}×${selected.userData.size.h}×${selected.userData.size.d}`
        : 'Click để ray-pick, double click để focus';

      viewerStatus.innerHTML = `
        <div><b>Camera:</b> Orbit / Pan / Zoom</div>
        <div><b>Yaw / Pitch:</b> ${yaw.toFixed(1)}° / ${pitch.toFixed(1)}°</div>
        <div><b>Mặt tự ẩn:</b> ${occludedFace ? formatViewerFace(occludedFace) : 'Tắt'}</div>
        <div><b>Kiểu xử lý vách:</b> ${autoHideWalls?.checked !== false ? (getWallOcclusionMode() === 'fade' ? 'Làm mờ vách gần' : 'Ẩn hẳn vách gần') : 'Tắt'}</div>
        <div><b>Cutaway:</b> ${cutawayFace ? formatViewerFace(cutawayFace) : 'Tắt'}</div>
        <div><b>Khoảng cách nhìn:</b> ${distance.toFixed(0)} cm</div>
        <div><b>Thùng đang focus:</b> ${selectedLabel}</div>
        <div><b>Chi tiết chọn:</b> ${selectedMeta}</div>
      `;
    }

    function focusCameraOnPosition(position, distanceScale = 1.15) {
      const container = getCurrentContainerSize();
      const offset = camera.position.clone().sub(orbit.target);
      const fallback = new sceneSys.THREE.Vector3(
        container.w * 0.95,
        container.h * 0.65,
        container.d * 1.05
      );
      const direction = offset.lengthSq() > 1 ? offset.normalize() : fallback.normalize();
      const distance = Math.max(
        240,
        Math.max(container.w, container.h, container.d) * distanceScale
      );
      const nextPosition = position.clone().add(direction.multiplyScalar(distance));

      orbit.target.copy(position);
      camera.position.copy(nextPosition);
      camera.lookAt(position);
      orbit.update();
      updateViewerStatus();
    }

    function focusSelectedBox() {
      if (!selected) return;
      focusCameraOnPosition(selected.position.clone(), 0.92);
    }

    function setViewPreset(face) {
      const container = getCurrentContainerSize();
      const target = new sceneSys.THREE.Vector3(0, container.h * 0.42, 0);
      const maxDim = Math.max(container.w, container.h, container.d);
      const sideDistance = Math.max(maxDim * 1.08, 260);
      const topDistance = Math.max(container.h * 1.65, 300);

      orbit.target.copy(target);

      if (face === 'head') {
        camera.position.set(0, container.h * 0.62, -sideDistance);
      } else if (face === 'door') {
        camera.position.set(0, container.h * 0.62, sideDistance);
      } else if (face === 'left') {
        camera.position.set(-sideDistance, container.h * 0.62, 0);
      } else if (face === 'right') {
        camera.position.set(sideDistance, container.h * 0.62, 0);
      } else {
        camera.position.set(0, topDistance, 0.01);
      }

      camera.lookAt(target);
      orbit.update();
      updateViewerStatus();
    }

    function clampValue(value, min, max) {
      if (!Number.isFinite(value)) return min;
      if (min > max) return (min + max) / 2;
      return Math.min(max, Math.max(min, value));
    }

    function getClampedBoxPosition(position, size) {
      const container = getCurrentContainerSize();
      const halfW = Number(size?.w || 0) / 2;
      const halfH = Number(size?.h || 0) / 2;
      const halfD = Number(size?.d || 0) / 2;

      return {
        x: clampValue(position.x, -container.w / 2 + halfW, container.w / 2 - halfW),
        y: clampValue(position.y, halfH, container.h - halfH),
        z: clampValue(position.z, -container.d / 2 + halfD, container.d / 2 - halfD),
      };
    }

    const MANUAL_FACE_SNAP_TOLERANCE = 4;
    const MANUAL_MIN_SUPPORT_RATIO = 0.72;

    function hasManualFaceOverlap(candidatePosition, size, box, axis) {
      const candidateHalfW = Number(size?.w || 0) / 2;
      const candidateHalfH = Number(size?.h || 0) / 2;
      const candidateHalfD = Number(size?.d || 0) / 2;
      const boxSize = box.userData.size;
      const boxHalfW = Number(boxSize?.w || 0) / 2;
      const boxHalfH = Number(boxSize?.h || 0) / 2;
      const boxHalfD = Number(boxSize?.d || 0) / 2;

      const overlapX = Math.max(
        0,
        Math.min(candidatePosition.x + candidateHalfW, box.position.x + boxHalfW) -
          Math.max(candidatePosition.x - candidateHalfW, box.position.x - boxHalfW)
      );
      const overlapY = Math.max(
        0,
        Math.min(candidatePosition.y + candidateHalfH, box.position.y + boxHalfH) -
          Math.max(candidatePosition.y - candidateHalfH, box.position.y - boxHalfH)
      );
      const overlapZ = Math.max(
        0,
        Math.min(candidatePosition.z + candidateHalfD, box.position.z + boxHalfD) -
          Math.max(candidatePosition.z - candidateHalfD, box.position.z - boxHalfD)
      );

      if (axis === 'x') return overlapY > 0.001 && overlapZ > 0.001;
      if (axis === 'z') return overlapX > 0.001 && overlapY > 0.001;
      return overlapX > 0.001 && overlapZ > 0.001;
    }

    function getManualFaceSnapTargets(size, ignoreBox = null) {
      const container = getCurrentContainerSize();
      const halfW = Number(size?.w || 0) / 2;
      const halfD = Number(size?.d || 0) / 2;
      const targets = {
        x: [
          { value: -container.w / 2 + halfW, source: 'wall' },
          { value: container.w / 2 - halfW, source: 'wall' },
        ],
        z: [
          { value: -container.d / 2 + halfD, source: 'wall' },
          { value: container.d / 2 - halfD, source: 'wall' },
        ],
      };

      boxes.forEach((box) => {
        if (box === ignoreBox) return;

        const boxSize = box.userData.size;
        const boxHalfW = Number(boxSize?.w || 0) / 2;
        const boxHalfD = Number(boxSize?.d || 0) / 2;

        targets.x.push(
          { value: box.position.x + boxHalfW + halfW, source: 'box', box },
          { value: box.position.x - boxHalfW - halfW, source: 'box', box }
        );
        targets.z.push(
          { value: box.position.z + boxHalfD + halfD, source: 'box', box },
          { value: box.position.z - boxHalfD - halfD, source: 'box', box }
        );
      });

      return targets;
    }

    function snapPositionToFaces(
      position,
      size,
      { ignoreBox = null, supportY = null, tolerance = MANUAL_FACE_SNAP_TOLERANCE } = {}
    ) {
      const halfH = Number(size?.h || 0) / 2;
      let snapped = getClampedBoxPosition(position, size);
      const resolvedSupportY = Number.isFinite(supportY) ? supportY : Math.max(0, snapped.y - halfH);
      const faceTargets = getManualFaceSnapTargets(size, ignoreBox);

      for (let pass = 0; pass < 2; pass++) {
        for (const axis of ['x', 'z']) {
          let bestValue = snapped[axis];
          let bestDistance = tolerance + 1;

          faceTargets[axis].forEach((target) => {
            const distance = Math.abs(target.value - snapped[axis]);
            if (distance <= 0.001 || distance > tolerance + 0.001) return;

            const candidate = {
              ...snapped,
              [axis]: target.value,
            };
            const clamped = getClampedBoxPosition(candidate, size);
            candidate.x = clamped.x;
            candidate.z = clamped.z;

            if (Math.abs(candidate[axis] - target.value) > 0.001) return;
            if (
              target.source === 'box' &&
              !hasManualFaceOverlap(candidate, size, target.box, axis)
            ) {
              return;
            }
            if (intersectsPlacedBoxAtPosition(candidate, size, ignoreBox)) return;

            const supportRatio = getSupportRatioForPlacement(
              candidate,
              size,
              resolvedSupportY,
              ignoreBox
            );
            if (supportRatio + 0.0001 < MANUAL_MIN_SUPPORT_RATIO) return;

            if (distance < bestDistance) {
              bestDistance = distance;
              bestValue = candidate[axis];
            }
          });

          snapped = {
            ...snapped,
            [axis]: bestValue,
          };
        }
      }

      return snapped;
    }

    function intersectsPlacedBoxAtPosition(position, size, ignoreBox = null) {
      const halfW = Number(size?.w || 0) / 2;
      const halfH = Number(size?.h || 0) / 2;
      const halfD = Number(size?.d || 0) / 2;

      const candidate = {
        minX: position.x - halfW,
        maxX: position.x + halfW,
        minY: position.y - halfH,
        maxY: position.y + halfH,
        minZ: position.z - halfD,
        maxZ: position.z + halfD,
      };

      return boxes.some((box) => {
        if (box === ignoreBox) return false;

        const currentSize = box.userData.size;
        const currentHalfW = Number(currentSize?.w || 0) / 2;
        const currentHalfH = Number(currentSize?.h || 0) / 2;
        const currentHalfD = Number(currentSize?.d || 0) / 2;
        const current = {
          minX: box.position.x - currentHalfW,
          maxX: box.position.x + currentHalfW,
          minY: box.position.y - currentHalfH,
          maxY: box.position.y + currentHalfH,
          minZ: box.position.z - currentHalfD,
          maxZ: box.position.z + currentHalfD,
        };

        return !(
          candidate.maxX <= current.minX ||
          candidate.minX >= current.maxX ||
          candidate.maxY <= current.minY ||
          candidate.minY >= current.maxY ||
          candidate.maxZ <= current.minZ ||
          candidate.minZ >= current.maxZ
        );
      });
    }

    function getFootprintOverlapArea(position, size, box) {
      const candidateHalfW = Number(size?.w || 0) / 2;
      const candidateHalfD = Number(size?.d || 0) / 2;
      const boxSize = box.userData.size;
      const boxHalfW = Number(boxSize?.w || 0) / 2;
      const boxHalfD = Number(boxSize?.d || 0) / 2;

      const overlapX = Math.max(
        0,
        Math.min(position.x + candidateHalfW, box.position.x + boxHalfW) -
          Math.max(position.x - candidateHalfW, box.position.x - boxHalfW)
      );
      const overlapZ = Math.max(
        0,
        Math.min(position.z + candidateHalfD, box.position.z + boxHalfD) -
          Math.max(position.z - candidateHalfD, box.position.z - boxHalfD)
      );

      return overlapX * overlapZ;
    }

    function getSupportRatioForPlacement(position, size, supportY, ignoreBox = null) {
      const baseArea = Number(size?.w || 0) * Number(size?.d || 0);
      if (baseArea <= 0) return 0;
      if (supportY <= 0.001) return 1;

      let supportArea = 0;

      boxes.forEach((box) => {
        if (box === ignoreBox) return;

        const boxTopY = box.position.y + Number(box.userData.size?.h || 0) / 2;
        if (Math.abs(boxTopY - supportY) > 0.5) return;

        supportArea += getFootprintOverlapArea(position, size, box);
      });

      return supportArea / baseArea;
    }

    function resolveDragPlacement(ray, draggedBox) {
      if (!draggedBox) return null;

      const size = draggedBox.userData.size;
      const halfW = Number(size?.w || 0) / 2;
      const halfH = Number(size?.h || 0) / 2;
      const halfD = Number(size?.d || 0) / 2;
      const container = getCurrentContainerSize();
      const supportLevels = new Set([0]);
      const plane = new sceneSys.THREE.Plane(new sceneSys.THREE.Vector3(0, 1, 0), 0);
      const intersection = new sceneSys.THREE.Vector3();
      let bestCandidate = null;

      boxes.forEach((box) => {
        if (box === draggedBox) return;
        const topY = box.position.y + Number(box.userData.size?.h || 0) / 2;
        if (topY > 0.001 && topY < container.h - halfH + 0.001) {
          supportLevels.add(Number(topY.toFixed(3)));
        }
      });

      [...supportLevels].forEach((supportY) => {
        plane.constant = -supportY;
        if (!ray.intersectPlane(plane, intersection)) return;

        const position = {
          x: clampValue(
            intersection.x + dragState.offset.x,
            -container.w / 2 + halfW,
            container.w / 2 - halfW
          ),
          y: supportY + halfH,
          z: clampValue(
            intersection.z + dragState.offset.z,
            -container.d / 2 + halfD,
            container.d / 2 - halfD
          ),
        };
        const snappedPosition = snapPositionToFaces(position, size, {
          ignoreBox: draggedBox,
          supportY,
        });

        if (
          snappedPosition.y < halfH - 0.001 ||
          snappedPosition.y > container.h - halfH + 0.001
        ) {
          return;
        }
        if (intersectsPlacedBoxAtPosition(snappedPosition, size, draggedBox)) return;

        const supportRatio = getSupportRatioForPlacement(
          snappedPosition,
          size,
          supportY,
          draggedBox
        );
        if (supportRatio < MANUAL_MIN_SUPPORT_RATIO) return;

        const distance = ray.origin.distanceTo(intersection);
        if (!bestCandidate || distance < bestCandidate.distance) {
          bestCandidate = {
            position: snappedPosition,
            supportRatio,
            supportY,
            distance,
          };
        }
      });

      return bestCandidate;
    }

    function resolveSupportedPosition(position, size, ignoreBox = null) {
      const container = getCurrentContainerSize();
      const halfW = Number(size?.w || 0) / 2;
      const halfH = Number(size?.h || 0) / 2;
      const halfD = Number(size?.d || 0) / 2;
      const clampedXZ = {
        x: clampValue(position.x, -container.w / 2 + halfW, container.w / 2 - halfW),
        z: clampValue(position.z, -container.d / 2 + halfD, container.d / 2 - halfD),
      };
      const supportLevels = [0];

      boxes.forEach((box) => {
        if (box === ignoreBox) return;
        const topY = box.position.y + Number(box.userData.size?.h || 0) / 2;
        if (topY > 0.001 && topY <= container.h - halfH + 0.001) {
          supportLevels.push(Number(topY.toFixed(3)));
        }
      });

      const sortedSupportLevels = [...new Set(supportLevels)].sort((a, b) => b - a);

      for (const supportY of sortedSupportLevels) {
        const candidate = snapPositionToFaces(
          {
          x: clampedXZ.x,
          y: supportY + halfH,
          z: clampedXZ.z,
          },
          size,
          { ignoreBox, supportY }
        );

        if (candidate.y < halfH - 0.001 || candidate.y > container.h - halfH + 0.001) continue;
        if (intersectsPlacedBoxAtPosition(candidate, size, ignoreBox)) continue;

        const supportRatio = getSupportRatioForPlacement(candidate, size, supportY, ignoreBox);
        if (supportRatio >= MANUAL_MIN_SUPPORT_RATIO) {
          return candidate;
        }
      }

      return getClampedBoxPosition(position, size);
    }

    function findManualSpawnPosition(size) {
      const container = getCurrentContainerSize();
      const gap = 6;
      const halfW = Number(size?.w || 0) / 2;
      const halfH = Number(size?.h || 0) / 2;
      const halfD = Number(size?.d || 0) / 2;
      const minX = -container.w / 2 + halfW;
      const maxX = container.w / 2 - halfW;
      const minY = halfH;
      const maxY = container.h - halfH;
      const minZ = -container.d / 2 + halfD;
      const maxZ = container.d / 2 - halfD;
      const headWallZ = minZ;
      const stepX = Math.max(halfW * 2 + gap, 18);
      const stepY = Math.max(halfH * 2 + gap, 18);
      const stepZ = Math.max(halfD * 2 + gap, 18);
      const xTargets = [minX];
      const yTargets = [minY];
      const zTargets = [headWallZ];

      boxes.forEach((box) => {
        const boxSize = box.userData.size;
        const boxHalfW = Number(boxSize?.w || 0) / 2;
        const boxHalfH = Number(boxSize?.h || 0) / 2;
        const boxHalfD = Number(boxSize?.d || 0) / 2;

        xTargets.push(
          box.position.x - boxHalfW - halfW,
          box.position.x + boxHalfW + halfW
        );
        yTargets.push(box.position.y + boxHalfH + halfH);
        zTargets.push(box.position.z + boxHalfD + halfD);
      });

      const sortedXTargets = [...new Set(xTargets.map((value) => Number(value.toFixed(3))))]
        .filter((value) => value >= minX - 0.001 && value <= maxX + 0.001)
        .sort((a, b) => a - b);
      const sortedYTargets = [...new Set(yTargets.map((value) => Number(value.toFixed(3))))]
        .filter((value) => value >= minY - 0.001 && value <= maxY + 0.001)
        .sort((a, b) => a - b);
      const sortedZTargets = [...new Set(zTargets.map((value) => Number(value.toFixed(3))))]
        .filter((value) => value >= minZ - 0.001 && value <= maxZ + 0.001)
        .sort((a, b) => a - b);

      for (const z of sortedZTargets) {
        for (const y of sortedYTargets) {
          for (const x of sortedXTargets) {
            const candidate = snapPositionToFaces(
              getClampedBoxPosition({ x, y, z }, size),
              size,
              { supportY: y - halfH, tolerance: 2.5 }
            );

            if (candidate.y < minY - 0.001 || candidate.y > maxY + 0.001) continue;
            if (candidate.z < minZ - 0.001 || candidate.z > maxZ + 0.001) continue;
            if (intersectsPlacedBoxAtPosition(candidate, size)) continue;

            const supportRatio = getSupportRatioForPlacement(candidate, size, candidate.y - halfH);
            if (supportRatio >= MANUAL_MIN_SUPPORT_RATIO) {
              return candidate;
            }
          }
        }
      }

      for (let y = minY; y <= maxY + 0.001; y += stepY) {
        for (let z = headWallZ; z <= maxZ + 0.001; z += stepZ) {
          for (let x = minX; x <= maxX + 0.001; x += stepX) {
            const candidate = snapPositionToFaces(getClampedBoxPosition({ x, y, z }, size), size, {
              supportY: y - halfH,
            });
            if (!intersectsPlacedBoxAtPosition(candidate, size)) {
              return candidate;
            }
          }
        }
      }

      return getClampedBoxPosition(
        {
          x: minX,
          y: minY,
          z: headWallZ,
        },
        size
      );
    }

    function updateManualControlsEnabledState(disabled) {
      manualArrangeControls?.querySelectorAll('input, button').forEach((element) => {
        element.disabled = disabled;
      });
    }

    function getCurrentManualMode() {
      return transformControl.getMode?.() || transformControl.mode || 'translate';
    }

    function setManualControlMode(mode, announce = false) {
      transformControl.setMode(mode);
      transformControl.visible = false;
      transformControl.enabled = false;
      syncManualArrangePanel();

      if (announce) {
        const modeLabel = mode === 'rotate' ? 'Lật' : 'Di chuyển';
        showStatusMessage({
          title: `🧩 Đã chuyển sang chế độ ${modeLabel}`,
          lines:
            mode === 'rotate'
              ? ['Chọn một preset trong mục lật 6 mặt để đổi hướng box đang chọn.']
              : ['Kéo gizmo trực tiếp trong scene để di chuyển box đang chọn.'],
          color: mode === 'rotate' ? '#8b5cf6' : '#38bdf8',
          background:
            mode === 'rotate' ? 'rgba(139,92,246,0.14)' : 'rgba(59,130,246,0.12)',
          border:
            mode === 'rotate' ? 'rgba(167,139,250,0.45)' : 'rgba(96,165,250,0.4)',
        });
      }
    }

    function getSelectedOrientationOptions() {
      const baseSize = selected?.userData?.originalSize || selected?.userData?.size;
      if (!baseSize) return [];
      return getBoxOrientationPresets(baseSize);
    }

    function syncManualArrangePanel() {
      if (!manualArrangeStatus) return;
      const isRotateMode = getCurrentManualMode() === 'rotate';
      const hasSelection = Boolean(selected);

      setCommandButtonsActive('manual-translate', !isRotateMode);
      setCommandButtonsActive('manual-rotate', isRotateMode);
      setCommandButtonsDisabled(
        ['manual-translate', 'manual-rotate', 'select-focus', 'select-cycle-orientation', 'select-remove'],
        !hasSelection
      );

      if (!selected) {
        manualArrangeStatus.innerHTML =
          'Click vào một thùng trong mô hình 3D, sau đó chọn Di chuyển hoặc Lật.';

        if (manualRotationPanel) {
          manualRotationPanel.style.display = isRotateMode ? 'block' : 'none';
        }

        manualOrientationButtons.forEach((button, index) => {
          button.textContent = `Hướng ${index + 1}`;
          button.classList.remove('active');
        });

        updateManualControlsEnabledState(true);
        return;
      }

      const { size, label, id } = selected.userData;
      manualArrangeStatus.innerHTML = `
        <b>Đang chọn:</b> ${escapeHtml(label || 'Thùng')} #${id}<br/>
        <span>Kích thước hiện tại: ${size.w} × ${size.h} × ${size.d} cm</span><br/>
        <span>Chế độ: <b>${isRotateMode ? 'Lật' : 'Di chuyển'}</b></span>
      `;
      if (manualRotationPanel) {
        manualRotationPanel.style.display = isRotateMode ? 'block' : 'none';
      }

      const orientations = getSelectedOrientationOptions();
      manualOrientationButtons.forEach((button, index) => {
        const option = orientations[index];
        if (!option) {
          button.textContent = `Hướng ${index + 1}`;
          button.classList.remove('active');
          button.disabled = true;
          return;
        }

        button.disabled = false;
        button.textContent = `${option.label} • ${option.size.w}×${option.size.h}×${option.size.d}`;

        const isActive =
          Number(size.w) === Number(option.size.w) &&
          Number(size.h) === Number(option.size.h) &&
          Number(size.d) === Number(option.size.d);

        button.classList.toggle('active', isActive);
      });

      updateManualControlsEnabledState(false);
    }

    function refreshSelectedBoxDetails() {
      updateStats();
      if (selected) {
        showSelectedInfo(infoPanel, infoText, selected);
      }
      syncManualArrangePanel();
    }

    function updatePointerRay(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    }

    function beginDirectBoxDrag(event) {
      if (getCurrentManualMode() !== 'translate') return false;

      updatePointerRay(event);
      const hits = raycaster.intersectObjects(boxes, false);
      if (hits.length === 0) return false;

      const hitBox = hits[0].object;
      if (!hitBox) return false;

      if (selected !== hitBox) {
        setSelectedBox(hitBox);
      }

      dragState.plane.set(new sceneSys.THREE.Vector3(0, 1, 0), -hitBox.position.y);
      if (!raycaster.ray.intersectPlane(dragState.plane, dragState.intersection)) {
        return false;
      }

      dragState.active = true;
      dragState.hasMoved = false;
      dragState.pointerId = event.pointerId;
      dragState.box = hitBox;
      dragState.startSignature = sceneStateSignature(captureSceneState());
      dragState.offset.copy(hitBox.position).sub(dragState.intersection);
      orbit.enabled = false;
      event.preventDefault();
      event.stopPropagation();
      renderer.domElement.setPointerCapture?.(event.pointerId);
      return true;
    }

    function handlePointerMove(event) {
      if (!dragState.active || dragState.pointerId !== event.pointerId || !dragState.box) return;
      event.preventDefault();

      updatePointerRay(event);
      const dragPlacement = resolveDragPlacement(raycaster.ray, dragState.box);
      if (!dragPlacement) {
        return;
      }

      dragState.box.position.set(
        dragPlacement.position.x,
        dragPlacement.position.y,
        dragPlacement.position.z
      );
      dragState.hasMoved = true;
      refreshSelectedBoxDetails();
    }

    function finishDirectBoxDrag(event) {
      if (!dragState.active || dragState.pointerId !== event.pointerId) return false;

      orbit.enabled = true;
      event.preventDefault?.();
      renderer.domElement.releasePointerCapture?.(event.pointerId);

      const changed = sceneStateSignature(captureSceneState()) !== dragState.startSignature;
      if (changed) {
        pushHistorySnapshot();
      }

      dragState.active = false;
      dragState.hasMoved = false;
      dragState.pointerId = null;
      dragState.box = null;
      dragState.startSignature = '';
      return true;
    }

    function syncPreviewSampleLabels() {
      boxes.forEach((box) => {
        const shouldShowLabel =
          box === selected && (box.userData.sceneRole === 'preview' || box.userData.isSampleBox);
        setCartonPreviewLabelVisible(box, shouldShowLabel);
      });
    }

    function showStatusMessage({
      title,
      lines = [],
      color = '#60a5fa',
      background = 'rgba(59,130,246,0.12)',
      border = 'rgba(96,165,250,0.4)',
    }) {
      if (!reportEl) return;

      reportEl.innerHTML = `
        <div style="color:${color};font-size:1.05rem;font-weight:bold;margin-bottom:8px;">
          ${sanitizeInlineStatusHtml(title)}
        </div>
        <div style="display:grid;gap:6px;padding:12px;border-radius:10px;background:${background};border:1px solid ${border};line-height:1.6;">
          ${lines.map((line) => `<div>${sanitizeInlineStatusHtml(line)}</div>`).join('')}
        </div>
      `;
      reportEl.style.display = 'block';
    }

    function showSelectionRequiredMessage(actionLabel) {
      showStatusMessage({
        title: '⚠️ Chưa chọn thùng',
        lines: [actionLabel],
        color: '#f59e0b',
        background: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.45)',
      });
    }

    function renderSingleItemAddedReport(singleBox) {
      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.05rem;font-weight:bold;margin-bottom:8px;">
          ✅ ĐÃ ADD ITEM
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>Tên item:</div>
          <div style="text-align:right;font-weight:bold;">${escapeHtml(singleBox.label)}</div>

          <div>Số lượng box units:</div>
          <div style="text-align:right;font-weight:bold;">${singleBox.qty}</div>

          <div>Kích thước:</div>
          <div style="text-align:right;font-weight:bold;">${singleBox.d} × ${singleBox.w} × ${singleBox.h} cm</div>

          <div>Khối lượng / box:</div>
          <div style="text-align:right;font-weight:bold;">${singleBox.weight} kg</div>
        </div>

        <div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(15,23,42,0.72);border:1px solid rgba(148,163,184,0.16);line-height:1.6;">
          • Allow rotate: <b>${formatAllowRotateLabel(singleBox)}</b><br/>
          • No stack: <b>${formatNoStackLabel(singleBox.noStack)}</b><br/>
          • No tilt: <b>${formatNoTiltLabel(singleBox.noTilt)}</b><br/>
          • Priority group: <b>${formatPriorityGroupLabel(singleBox.priorityGroup)}</b><br/>
          • Preview 3D chỉ hiển thị <b>1 box mẫu</b>. Bấm <b>AI Cơ bản</b>, <b>AI Pro</b> hoặc
          <b> Add + Xếp tối ưu</b> để engine bung quantity và tính placement thật.
        </div>
      `;
      reportEl.style.display = 'block';
    }

    function addSingleBoxType({
      renderPreview = true,
      renderReport = true,
      pushHistory = true,
    } = {}) {
      const singleBox = readSingleBoxInputs();
      if (
        singleBox.w <= 0 ||
        singleBox.h <= 0 ||
        singleBox.d <= 0 ||
        singleBox.weight <= 0 ||
        singleBox.qty <= 0
      ) {
        showStatusMessage({
          title: '⚠️ Item chưa hợp lệ',
          lines: [
            'Hãy nhập đầy đủ kích thước, khối lượng và số lượng lớn hơn 0 trước khi Add item.',
          ],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });
        return null;
      }

      multiBoxTypes.push({
        ...singleBox,
        id: Date.now() + Math.floor(Math.random() * 10000),
      });

      renderMultiBoxTypes();

      if (renderPreview) {
        renderPreviewItemsScene();
      }

      if (renderReport) {
        renderSingleItemAddedReport(singleBox);
      }

      if (pushHistory) {
        pushHistorySnapshot();
      }

      return singleBox;
    }

    function addSingleBoxTypeAndOptimize() {
      const addedBox = addSingleBoxType({
        renderPreview: false,
        renderReport: false,
        pushHistory: false,
      });
      if (!addedBox) return;
      optimizeMultiTypeBoxes();
    }

    function focusSelectedBoxFromCommand() {
      if (!selected) {
        showSelectionRequiredMessage('Hãy click vào một thùng trong mô hình 3D rồi bấm Focus box.');
        return;
      }

      focusSelectedBox();
    }

    function cycleSelectedOrientationFromCommand() {
      if (!selected) {
        showSelectionRequiredMessage('Hãy chọn một thùng trước khi dùng nút Lật tiếp.');
        return;
      }

      cycleSelectedOrientation();
    }

    function calculateAndArrangeCapacity() {
      handleCapacity();

      if (lastCapacityData?.ok) {
        autoArrangeFromCapacity();
      }
    }

    function toggleSidebarPanel() {
      applySidebarCollapsedState(!sidebarCollapsedPreference, {
        persist: true,
        refitCamera: true,
      });
    }

    function setSelectedBox(box) {
      if (selected && selected !== box) {
        setCartonSelection(selected, false);
      }

      selected = box || null;

      if (!selected) {
        transformControl.detach();
        if (infoPanel) infoPanel.style.display = 'none';
        syncPreviewSampleLabels();
        syncManualArrangePanel();
        updateViewerStatus();
        return;
      }

      setCartonSelection(selected, true);
      transformControl.attach(selected);
      syncPreviewSampleLabels();
      showSelectedInfo(infoPanel, infoText, selected);
      syncManualArrangePanel();
      updateViewerStatus();
    }

    function captureSceneState() {
      return serializeSceneState({
        boxes,
        selected,
        contType: contType.value,
        container: {
          w: Number(cw.value),
          h: Number(ch.value),
          d: Number(cd.value),
        },
        opacity: Number(opacitySlider?.value || 0.18),
        multiBoxTypes,
        capacityInputs: readCapacityInputs(),
        shockMode: getShockMode(),
        shockNet: getShockNet(),
        transformMode: transformControl.getMode?.() || transformControl.mode,
        viewerSettings: {
          autoHideWalls: autoHideWalls?.checked !== false,
          wallOcclusionMode: getWallOcclusionMode(),
          cutawayMode: getCutawayMode(),
        },
        packingSettings: {
          floorLoadLimit: Number.isFinite(getPackingFloorLoadLimit()) ? getPackingFloorLoadLimit() : 0,
        },
        commercialSettings: readCommercialInputs(),
        cameraState: {
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          target: {
            x: orbit.target.x,
            y: orbit.target.y,
            z: orbit.target.z,
          },
        },
      });
    }

    function sceneStateSignature(state) {
      return JSON.stringify(state);
    }

    function pushHistorySnapshot() {
      if (isApplyingSceneState) return;

      const snapshot = captureSceneState();
      const nextSignature = sceneStateSignature(snapshot);
      const lastSnapshot = historyPast[historyPast.length - 1];

      if (lastSnapshot && sceneStateSignature(lastSnapshot) === nextSignature) return;

      historyPast.push(snapshot);
      if (historyPast.length > 50) {
        historyPast = historyPast.slice(historyPast.length - 50);
      }
      historyFuture = [];
    }

    function applyCapacitySnapshot(capacityInputs) {
      if (!capacityInputs) {
        lastCapacityData = null;
        if (btnAutoArrangeCapacity) btnAutoArrangeCapacity.style.display = 'none';
        if (shockOptions) shockOptions.style.display = 'none';
        if (capacityResult) capacityResult.style.display = 'none';
        return;
      }

      if (calcContainerLength) calcContainerLength.value = capacityInputs.containerLength || cd.value;
      if (calcContainerWidth) calcContainerWidth.value = capacityInputs.containerWidth || cw.value;
      if (calcContainerHeight) calcContainerHeight.value = capacityInputs.containerHeight || ch.value;
      if (calcContainerMaxWeight) calcContainerMaxWeight.value = capacityInputs.containerMaxWeight || '';
      if (calcBoxLength) calcBoxLength.value = capacityInputs.boxLength || '';
      if (calcBoxWidth) calcBoxWidth.value = capacityInputs.boxWidth || '';
      if (calcBoxHeight) calcBoxHeight.value = capacityInputs.boxHeight || '';
      if (calcBoxWeight) calcBoxWeight.value = capacityInputs.boxWeight || '';

      lastCapacityData = calculateCapacity(readCapacityInputs());
      showCapacityResult(capacityResult, lastCapacityData);

      if (btnAutoArrangeCapacity) {
        btnAutoArrangeCapacity.style.display = lastCapacityData.ok ? 'block' : 'none';
      }
      if (shockOptions) {
        shockOptions.style.display = lastCapacityData.ok ? 'block' : 'none';
      }
    }

    function applySceneState(state) {
      if (!state) return false;

      isApplyingSceneState = true;

      try {
        if (contType && state.contType) {
          contType.value = state.contType;
        }

        if (cw && state.container?.w) cw.value = state.container.w;
        if (ch && state.container?.h) ch.value = state.container.h;
        if (cd && state.container?.d) cd.value = state.container.d;
        if (opacitySlider && state.opacity !== undefined) opacitySlider.value = state.opacity;

        if (shockBasic) shockBasic.checked = state.shockMode !== 'center';
        if (shockCenter) shockCenter.checked = state.shockMode === 'center';
        if (shockNetCheckbox) shockNetCheckbox.checked = Boolean(state.shockNet);
        if (autoHideWalls) {
          autoHideWalls.checked =
            state.viewerSettings?.autoHideWalls !== undefined
              ? Boolean(state.viewerSettings.autoHideWalls)
              : true;
        }
        if (wallOcclusionMode) {
          wallOcclusionMode.value = state.viewerSettings?.wallOcclusionMode || 'hide';
        }
        if (cutawayMode) {
          cutawayMode.value = state.viewerSettings?.cutawayMode || 'off';
        }
        if (packingFloorLoadLimit) {
          packingFloorLoadLimit.value = Number(state.packingSettings?.floorLoadLimit || 0);
        }
        applyCommercialSettings(state.commercialSettings);

        if (state.transformMode) {
          setManualControlMode(state.transformMode);
        }

        multiBoxTypes = cloneMultiBoxTypeList(state.multiBoxTypes?.length ? state.multiBoxTypes : []);
        if (multiBoxTypes.length === 0) {
          multiBoxTypes = [
            {
              id: Date.now(),
              label: 'Loại 1',
              w: 60,
              h: 50,
              d: 80,
              weight: 20,
              qty: 1,
              allowRotate: true,
              noStack: false,
              noTilt: false,
              priorityGroup: 1,
              stackLimit: 0,
              maxLoadAbove: 0,
              deliveryZone: 'any',
            },
          ];
        }

        renderMultiBoxTypes();
        clearBoxes();
        clearShockVisuals(containerSys.shockGroup);
        updateContainer({ fitCamera: true });
        syncCapacityInputs();
        applyCapacitySnapshot(state.capacityInputs);

        const restoredBoxes = Array.isArray(state.boxes) ? state.boxes : [];

        if (restoredBoxes.length === 0) {
          renderPreviewItemsScene();
        } else {
          restoredBoxes.forEach((item) => {
            const box = addBox({
              w: Number(item.size?.w || 0),
              h: Number(item.size?.h || 0),
              d: Number(item.size?.d || 0),
              x: Number(item.position?.x || 0),
              y: Number(item.position?.y || 0),
              z: Number(item.position?.z || 0),
              weight: Number(item.weight || 0),
              label: item.label || 'Thùng',
              originalSize: item.originalSize || item.size,
              isSample: Boolean(item.isSample),
              allowRotate: Boolean(item.allowRotate ?? item.rotationMode !== 'fixed'),
              noStack: Boolean(item.noStack ?? item.fragile),
              noTilt: Boolean(item.noTilt ?? item.rotationMode === 'upright'),
              priorityGroup: normalizePriorityGroup(item.priorityGroup ?? item.deliveryOrder),
              stackLevel: Number(item.stackLevel) || 1,
              loadAboveKg: Number(item.loadAboveKg || 0),
              supportRatio: Number(item.supportRatio || 0),
              floorBearingWeight: Number(item.floorBearingWeight || 0),
              floorPressureKgM2: Number(item.floorPressureKgM2 || 0),
              sceneRole: item.sceneRole || 'placement',
              previewQuantity: Number(item.previewQuantity || 0),
            });

            if (item.id) box.userData.id = item.id;
            if (item.quaternion) {
              box.quaternion.set(
                Number(item.quaternion.x || 0),
                Number(item.quaternion.y || 0),
                Number(item.quaternion.z || 0),
                Number(item.quaternion.w || 1)
              );
            }
          });
        }

        const nextSelected =
          boxes.find((box) => box.userData.id === state.selectedBoxId) || boxes[boxes.length - 1] || null;
        setSelectedBox(nextSelected);

        if (state.cameraState?.position && state.cameraState?.target) {
          camera.position.set(
            Number(state.cameraState.position.x || 0),
            Number(state.cameraState.position.y || 0),
            Number(state.cameraState.position.z || 0)
          );
          orbit.target.set(
            Number(state.cameraState.target.x || 0),
            Number(state.cameraState.target.y || 0),
            Number(state.cameraState.target.z || 0)
          );
          camera.lookAt(orbit.target);
          orbit.update();
        }

        updateStats();
        syncViewerClippingTargets();
        updateViewerStatus();
        localStorage.setItem('contType', contType.value);
        localStorage.setItem('cw', cw.value);
        localStorage.setItem('ch', ch.value);
        localStorage.setItem('cd', cd.value);
        return true;
      } finally {
        isApplyingSceneState = false;
      }
    }

    function getCurrentContainerMaxLoad() {
      const selectedType = contType.value;
      if (CONTAINER_TYPES[selectedType]?.maxLoad) {
        return CONTAINER_TYPES[selectedType].maxLoad;
      }

      if (calcContainerMaxWeight && Number(calcContainerMaxWeight.value) > 0) {
        return Number(calcContainerMaxWeight.value);
      }

      return Infinity;
    }

    function getShockMode() {
      return shockCenter?.checked ? 'center' : 'basic';
    }

    function getShockNet() {
      return !!shockNetCheckbox?.checked;
    }

    function syncCapacityInputs() {
      if (calcContainerLength) calcContainerLength.value = cd.value;
      if (calcContainerWidth) calcContainerWidth.value = cw.value;
      if (calcContainerHeight) calcContainerHeight.value = ch.value;

      const selectedType = contType.value;
      if (calcContainerMaxWeight && CONTAINER_TYPES[selectedType]?.maxLoad) {
        calcContainerMaxWeight.value = CONTAINER_TYPES[selectedType].maxLoad;
      }
    }

    function updateContainer({ fitCamera = false } = {}) {
      updateContainerMesh({
        group: containerSys.group,
        box3: containerSys.box3,
        width: +cw.value,
        height: +ch.value,
        depth: +cd.value,
        opacity: +(opacitySlider?.value || 0.18),
        shockGroup: containerSys.shockGroup,
        wallMeshes: containerSys.wallMeshes,
      });

      syncViewerClippingTargets();
      updateContainerViewOcclusion({
        wallMeshes: containerSys.wallMeshes,
        camera,
        height: +ch.value,
        enabled: autoHideWalls?.checked !== false,
        mode: getWallOcclusionMode(),
      });

      if (fitCamera) {
        sceneSys.fitCameraToBox(+cw.value, +ch.value, +cd.value);
      }

      sceneSys.resize();
      updateViewerStatus();
    }

    function updateStats() {
      const count = boxes.length;
      let vol = 0;
      let totalWeight = 0;
      const combinedPos = new sceneSys.THREE.Vector3(0, 0, 0);

      boxes.forEach((b) => {
        const s = b.userData.size;
        const w = b.userData.weight;
        vol += s.w * s.h * s.d;
        totalWeight += w;
        combinedPos.add(b.position.clone().multiplyScalar(w));
      });

      const containerVol = +cw.value * +ch.value * +cd.value;
      const perc = containerVol > 0 ? ((vol / containerVol) * 100).toFixed(1) : '0.0';
      statsEl.textContent = `${count} thùng | ${perc}% | ${(totalWeight / 1000).toFixed(1)} tấn`;

      if (totalWeight > 0) {
        combinedPos.divideScalar(totalWeight);
        cogMarker.position.copy(combinedPos);
        cogMarker.visible = true;
      } else {
        cogMarker.visible = false;
      }

      updateViewerStatus();
    }

    function addBox(params) {
      const packingItem = toPackingItem(params);
      const box = createCarton(scene, boxes.length, {
        ...params,
        meta: {
          allowRotate: Boolean(packingItem.allowRotate),
          noStack: Boolean(packingItem.noStack),
          noTilt: Boolean(packingItem.noTilt),
          priorityGroup: normalizePriorityGroup(packingItem.priorityGroup),
          fragile: Boolean(packingItem.fragile),
          deliveryOrder: Number(packingItem.deliveryOrder) || 1,
          rotationMode: packingItem.rotationMode || 'all',
          stackLimit: Number(packingItem.stackLimit) > 0 ? Number(packingItem.stackLimit) : 0,
          maxLoadAbove: Number(packingItem.maxLoadAbove) > 0 ? Number(packingItem.maxLoadAbove) : 0,
          deliveryZone: packingItem.deliveryZone || 'any',
          stackLevel: Number(params.stackLevel) || 1,
          loadAboveKg: Number(params.loadAboveKg || 0),
          supportRatio: Number(params.supportRatio || 0),
          floorBearingWeight: Number(params.floorBearingWeight || 0),
          floorPressureKgM2: Number(params.floorPressureKgM2 || 0),
          sceneRole: params.sceneRole || 'placement',
          previewQuantity: Number(params.previewQuantity || 0),
          showSampleLabel: Boolean(params.showSampleLabel),
        },
      });
      box.userData.label = params.label || 'Thùng';
      box.userData.originalSize = params.originalSize || { w: params.w, h: params.h, d: params.d };
      setCartonClipping(box, getActiveClippingPlanes());
      boxes.push(box);
      updateStats();
      return box;
    }

    function clearBoxes() {
      boxes.forEach((b) => disposeBox(scene, b));
      boxes = [];
      setSelectedBox(null);
      updateStats();
    }

    function getValidCargoItems() {
      return multiBoxTypes
        .map((item, index) => normalizeCargoItem(item, index))
        .filter(
          (item) =>
            Number(item.qty) > 0 &&
            Number(item.w) > 0 &&
            Number(item.h) > 0 &&
            Number(item.d) > 0 &&
            Number(item.weight) > 0
        );
    }

    function expandItemsToUnits(items = []) {
      const units = [];

      items.forEach((item, index) => {
        const normalized = normalizeCargoItem(item, index);
        const qty = Math.max(0, Number(normalized.qty || 0));

        for (let i = 0; i < qty; i++) {
          units.push({
            id: `${normalized.id}-${i + 1}`,
            itemId: normalized.id,
            label: normalized.label,
            w: normalized.w,
            h: normalized.h,
            d: normalized.d,
            weight: normalized.weight,
            allowRotate: normalized.allowRotate,
            noStack: normalized.noStack,
            noTilt: normalized.noTilt,
            priorityGroup: normalized.priorityGroup,
            stackLimit: normalized.stackLimit,
            maxLoadAbove: normalized.maxLoadAbove,
            deliveryZone: normalized.deliveryZone,
          });
        }
      });

      return units;
    }

    function renderPreviewItemsScene() {
      const validItems = getValidCargoItems();

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      updateContainer();

      if (validItems.length === 0) {
        reportEl.style.display = 'none';
        refreshOperationsSummary({
          mode: 'preview',
          action: 'Danh sách item đang trống. Hãy thêm item hoặc nạp preset để bắt đầu.',
          result: null,
        });
        return;
      }

      let lastBox = null;

      validItems.forEach((item, index) => {
        const previewPosition = findManualSpawnPosition({ w: item.w, h: item.h, d: item.d });

        lastBox = addBox({
          w: item.w,
          h: item.h,
          d: item.d,
          x: previewPosition.x,
          y: previewPosition.y,
          z: previewPosition.z,
          weight: item.weight,
          isSample: true,
          label: `${item.label} • preview`,
          originalSize: { w: item.w, h: item.h, d: item.d },
          allowRotate: item.allowRotate,
          noStack: item.noStack,
          noTilt: item.noTilt,
          priorityGroup: item.priorityGroup,
          stackLimit: item.stackLimit,
          maxLoadAbove: item.maxLoadAbove,
          deliveryZone: item.deliveryZone,
          sceneRole: 'preview',
          previewQuantity: item.qty,
          showSampleLabel: false,
        });

        if (index === validItems.length - 1) {
          setSelectedBox(lastBox);
        }
      });

      reportEl.innerHTML = `
        <div style="color:#38bdf8;font-size:1.05rem;font-weight:bold;margin-bottom:8px;">
          👁️ PREVIEW ITEM 3D
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>Số item đã lưu:</div>
          <div style="text-align:right;font-weight:bold;">${validItems.length}</div>
          <div>Tổng box units sẽ bung ra:</div>
          <div style="text-align:right;font-weight:bold;">${expandItemsToUnits(validItems).length}</div>
        </div>
        <div style="margin-top:10px;color:#bfdbfe;line-height:1.6;">
          Scene hiện tại chỉ hiển thị <b>1 box mẫu / item</b>. Khi bấm <b>AI Cơ bản</b> hoặc
          <b> AI Pro</b>, engine mới bung quantity thành từng box unit và tính placement thật trong
          cargo space.
        </div>
      `;
      reportEl.style.display = 'block';
      refreshOperationsSummary({
        mode: 'preview',
        action: 'Đang xem 3D preview của danh sách item trước khi pack thật.',
        result: null,
      });
    }

    function basicPacking() {
      const itemsToPack = expandItemsToUnits(getValidCargoItems()).map((item) => ({
        w: item.w,
        h: item.h,
        d: item.d,
        weight: item.weight,
        label: item.label,
        originalSize: { w: item.w, h: item.h, d: item.d },
        allowRotate: item.allowRotate,
        noStack: item.noStack,
        noTilt: item.noTilt,
        priorityGroup: item.priorityGroup,
        stackLimit: item.stackLimit,
        maxLoadAbove: item.maxLoadAbove,
        deliveryZone: item.deliveryZone,
      }));

      if (itemsToPack.length === 0) {
        showStatusMessage({
          title: '⚠️ Chưa có item để xếp',
          lines: ['Hãy Add item trước rồi mới chạy AI Cơ bản.'],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });
        return;
      }

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);

      const W = +cw.value;
      const H = +ch.value;
      const D = +cd.value;

      const containerMaxWeight = getCurrentContainerMaxLoad();
      let runningWeight = 0;

      itemsToPack.sort((a, b) => b.w * b.h * b.d - a.w * a.h * a.d);

      let layerY = 0;
      let usedVol = 0;
      let packedCount = 0;
      let rejectedByWeight = 0;

      while (layerY + 5 < H && itemsToPack.length > 0) {
        let layerH = 0;
        let z = -D / 2;

        while (z + 5 < D / 2 && itemsToPack.length > 0) {
          let rowD = 0;
          let x = -W / 2;

          for (let i = 0; i < itemsToPack.length; i++) {
            const it = itemsToPack[i];

            if (runningWeight + it.weight > containerMaxWeight) {
              rejectedByWeight++;
              itemsToPack.splice(i, 1);
              i--;
              continue;
            }

            if (x + it.w <= W / 2 && z + it.d <= D / 2 && layerY + it.h <= H) {
              addBox({
                w: it.w,
                h: it.h,
                d: it.d,
                x: x + it.w / 2,
                y: layerY + it.h / 2,
                z: z + it.d / 2,
                weight: it.weight,
                label: it.label,
                originalSize: it.originalSize,
                allowRotate: it.allowRotate,
                noStack: it.noStack,
                noTilt: it.noTilt,
                priorityGroup: it.priorityGroup,
              });
              usedVol += it.w * it.h * it.d;
              runningWeight += it.weight;
              packedCount++;
              x += it.w + 1;
              rowD = Math.max(rowD, it.d);
              layerH = Math.max(layerH, it.h);
              itemsToPack.splice(i, 1);
              i--;
            }
          }

          if (rowD === 0) break;
          z += rowD + 1;
        }

        if (layerH === 0) break;
        layerY += layerH + 1;
      }

      showPackingReport(reportEl, {
        packedCount,
        remaining: itemsToPack.length + rejectedByWeight,
        usedVol,
        totalVol: W * H * D,
      });
      reportEl.innerHTML += `
        <div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.35);color:#bfdbfe;line-height:1.6;">
          AI Cơ bản ưu tiên tốc độ, chủ yếu xếp theo lớp và tải trọng tổng. Nếu bạn cần engine xét
          <b> allowRotate</b>, <b>noStack</b>, <b>noTilt</b>, <b>priorityGroup</b>, <b>tải sàn</b>
          và <b>cân bằng tải</b>, hãy dùng <b>AI Pro</b>.
        </div>
      `;
      refreshOperationsSummary({
        mode: 'basicPack',
        action: 'AI Cơ bản vừa chạy xong một layout theo lớp để review nhanh.',
        result: {
          packedCount,
          remaining: itemsToPack.length + rejectedByWeight,
          efficiency: (usedVol / (W * H * D)) * 100,
          totalPlacedWeight: runningWeight,
          strategyLabel: 'AI Cơ bản',
          balanceWarnings: [],
          loadBalance: {
            sideImbalancePercent: 0,
            lengthImbalancePercent: 0,
          },
          rejectedByWeightCount: rejectedByWeight,
          rejectedByConstraintCount: 0,
          floorLoadLimit: getPackingFloorLoadLimit(),
        },
      });
      pushHistorySnapshot();
    }

    function handleCapacity() {
      const result = calculateCapacity({
        containerLength: +calcContainerLength.value,
        containerWidth: +calcContainerWidth.value,
        containerHeight: +calcContainerHeight.value,
        containerMaxWeight: +calcContainerMaxWeight.value,
        boxLength: +calcBoxLength.value,
        boxWidth: +calcBoxWidth.value,
        boxHeight: +calcBoxHeight.value,
        boxWeight: +calcBoxWeight.value,
      });

      lastCapacityData = result;
      showCapacityResult(capacityResult, result);

      if (btnAutoArrangeCapacity) {
        btnAutoArrangeCapacity.style.display = result.ok ? 'block' : 'none';
      }

      if (shockOptions) {
        shockOptions.style.display = result.ok ? 'block' : 'none';
      }

      refreshOperationsSummary({
        mode: 'capacity',
        action: result.ok
          ? 'Đã tính xong sức chứa tối đa theo bộ số liệu hiện tại.'
          : 'Bộ số liệu sức chứa chưa hợp lệ, cần chỉnh lại trước khi xếp.',
        result: null,
      });
    }

    function arrangeBoxesPlain() {
      if (!lastCapacityData?.ok) return { created: 0, usedVol: 0, totalVol: 0 };

      const { best, maxBoxes, boxWeight } = lastCapacityData;
      const { rotation, alongLength, alongWidth, alongHeight } = best;

      const containerWidth = +calcContainerWidth.value;
      const containerHeight = +calcContainerHeight.value;
      const containerLength = +calcContainerLength.value;

      const boxW = rotation.w;
      const boxH = rotation.h;
      const boxD = rotation.l;

      const startX = -containerWidth / 2 + boxW / 2;
      const startY = boxH / 2;
      const startZ = -containerLength / 2 + boxD / 2;

      let created = 0;
      let lastBox = null;

      for (let iy = 0; iy < alongHeight; iy++) {
        for (let iz = 0; iz < alongLength; iz++) {
          for (let ix = 0; ix < alongWidth; ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: startX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: created === 0,
              label: 'Auto capacity',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }
          if (created >= maxBoxes) break;
        }
        if (created >= maxBoxes) break;
      }

      if (lastBox) {
        setSelectedBox(lastBox);
      }

      return {
        created,
        usedVol: created * boxW * boxH * boxD,
        totalVol: containerWidth * containerHeight * containerLength,
      };
    }

    function arrangeBoxesBasicShock() {
      if (!lastCapacityData?.ok) return { created: 0, usedVol: 0, totalVol: 0 };

      const { best, maxBoxes, boxWeight } = lastCapacityData;
      const { rotation, alongLength, alongWidth, alongHeight, shockPads } = best;

      const containerWidth = +calcContainerWidth.value;
      const containerHeight = +calcContainerHeight.value;
      const containerLength = +calcContainerLength.value;

      const boxW = rotation.w;
      const boxH = rotation.h;
      const boxD = rotation.l;

      const leftGap = shockPads.left.width;
      const rightGap = shockPads.right.width;
      const frontGap = shockPads.front.length;
      const backGap = shockPads.back.length;
      const topGap = shockPads.top.height;

      const usableWidth = containerWidth - leftGap - rightGap;
      const usableLength = containerLength - frontGap - backGap;
      const usableHeight = containerHeight - topGap;

      const finalAlongWidth = Math.floor(usableWidth / boxW);
      const finalAlongLength = Math.floor(usableLength / boxD);
      const finalAlongHeight = Math.floor(usableHeight / boxH);

      const startX = -containerWidth / 2 + leftGap + boxW / 2;
      const startY = boxH / 2;
      const startZ = -containerLength / 2 + frontGap + boxD / 2;

      let created = 0;
      let lastBox = null;

      for (let iy = 0; iy < Math.min(alongHeight, finalAlongHeight); iy++) {
        for (let iz = 0; iz < Math.min(alongLength, finalAlongLength); iz++) {
          for (let ix = 0; ix < Math.min(alongWidth, finalAlongWidth); ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: startX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: created === 0,
              label: 'Shock basic',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }
          if (created >= maxBoxes) break;
        }
        if (created >= maxBoxes) break;
      }

      if (lastBox) {
        setSelectedBox(lastBox);
      }

      return {
        created,
        usedVol: created * boxW * boxH * boxD,
        totalVol: containerWidth * containerHeight * containerLength,
      };
    }

    function arrangeBoxesCenterShock() {
      if (!lastCapacityData?.ok) return { created: 0, usedVol: 0, totalVol: 0 };

      const { best, maxBoxes, boxWeight } = lastCapacityData;
      const { rotation, alongLength, alongWidth, alongHeight, shockPads } = best;

      const containerWidth = +calcContainerWidth.value;
      const containerHeight = +calcContainerHeight.value;
      const containerLength = +calcContainerLength.value;

      const boxW = rotation.w;
      const boxH = rotation.h;
      const boxD = rotation.l;

      const centerGap = shockPads.centerWidthSplit.width;
      const topGap = shockPads.topFull.height;
      const frontGap = shockPads.summary.halfLengthGap;
      const backGap = shockPads.summary.halfLengthGap;

      const usableHeight = containerHeight - topGap;
      const usableLength = containerLength - frontGap - backGap;

      const finalAlongHeight = Math.floor(usableHeight / boxH);
      const finalAlongLength = Math.floor(usableLength / boxD);

      const totalCols = alongWidth;
      const leftCols = Math.ceil(totalCols / 2);
      const rightCols = Math.floor(totalCols / 2);

      const leftStartX = -containerWidth / 2 + boxW / 2;
      const rightStartX = -containerWidth / 2 + leftCols * boxW + centerGap + boxW / 2;

      const startY = boxH / 2;
      const startZ = -containerLength / 2 + frontGap + boxD / 2;

      let created = 0;
      let lastBox = null;

      for (let iy = 0; iy < Math.min(alongHeight, finalAlongHeight); iy++) {
        for (let iz = 0; iz < Math.min(alongLength, finalAlongLength); iz++) {
          for (let ix = 0; ix < leftCols; ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: leftStartX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: created === 0,
              label: 'Shock center',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }

          for (let ix = 0; ix < rightCols; ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: rightStartX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: false,
              label: 'Shock center',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }

          if (created >= maxBoxes) break;
        }
        if (created >= maxBoxes) break;
      }

      if (lastBox) {
        setSelectedBox(lastBox);
      }

      return {
        created,
        usedVol: created * boxW * boxH * boxD,
        totalVol: containerWidth * containerHeight * containerLength,
      };
    }

    function autoArrangeFromCapacity() {
      if (!lastCapacityData || !lastCapacityData.ok) return;

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      updateContainer();

      const result = arrangeBoxesPlain();

      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ✅ TỰ ĐỘNG XẾP THÙNG TỐI ĐA
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>📦 Số thùng đã xếp:</div>
          <div style="text-align:right;font-weight:bold;">${result.created}</div>

          <div>🔄 Hướng xoay:</div>
          <div style="text-align:right;font-weight:bold;">${lastCapacityData.best.rotationText}</div>

          <div>📊 Hiệu suất thể tích:</div>
          <div style="text-align:right;font-weight:bold;">${((result.usedVol / result.totalVol) * 100).toFixed(2)}%</div>
        </div>

        <div style="margin-top:10px;font-size:0.85rem;color:#cbd5e1;line-height:1.5;">
          Chống sốc chưa được hiển thị. Khi bạn chọn kiểu chống sốc và bấm nút hiển thị, hệ thống sẽ xếp lại thùng theo đúng kiểu chống sốc để tránh chồng hình.
        </div>
      `;
      reportEl.style.display = 'block';
      refreshOperationsSummary({
        mode: 'capacityArrange',
        action: 'Đã dựng layout 3D tối đa theo kết quả tính sức chứa.',
        result: {
          packedCount: result.created,
          remaining: Math.max((lastCapacityData?.maxBoxes || 0) - result.created, 0),
          efficiency: (result.usedVol / result.totalVol) * 100,
          totalPlacedWeight: result.created * Number(lastCapacityData?.boxWeight || 0),
          strategyLabel: 'Auto arrange từ sức chứa',
          balanceWarnings: [],
          loadBalance: {
            sideImbalancePercent: 0,
            lengthImbalancePercent: 0,
          },
          rejectedByWeightCount: 0,
          rejectedByConstraintCount: 0,
          floorLoadLimit: getPackingFloorLoadLimit(),
        },
      });
      pushHistorySnapshot();
    }

    function applyShockVisual() {
      if (!lastCapacityData?.ok) return;

      const mode = getShockMode();
      const withNet = getShockNet();

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      updateContainer();

      const arrangement =
        mode === 'center' ? arrangeBoxesCenterShock() : arrangeBoxesBasicShock();

      const containerWidth = +calcContainerWidth.value;
      const containerHeight = +calcContainerHeight.value;
      const containerLength = +calcContainerLength.value;

      renderShockVisuals({
        shockGroup: containerSys.shockGroup,
        mode,
        withNet,
        containerWidth,
        containerHeight,
        containerLength,
        best: lastCapacityData.best,
      });

      const modeText = mode === 'center' ? 'Giữa container theo chiều rộng' : 'Cơ bản';
      const netText = withNet ? 'Có' : 'Không';

      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ✅ ĐÃ HIỂN THỊ CHỐNG SỐC TRÊN MÔ HÌNH 3D
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>Kiểu chống sốc:</div>
          <div style="text-align:right;font-weight:bold;">${modeText}</div>

          <div>Lưới chống rơi hàng:</div>
          <div style="text-align:right;font-weight:bold;">${netText}</div>

          <div>📦 Số thùng đang hiển thị:</div>
          <div style="text-align:right;font-weight:bold;">${arrangement.created}</div>

          <div>📊 Hiệu suất thể tích:</div>
          <div style="text-align:right;font-weight:bold;">${((arrangement.usedVol / arrangement.totalVol) * 100).toFixed(2)}%</div>
        </div>
      `;
      reportEl.style.display = 'block';
      refreshOperationsSummary({
        mode: 'shock',
        action: 'Đã dựng phương án chống sốc và cập nhật lại mô hình 3D.',
      });
      pushHistorySnapshot();
    }

    function handlePointerDown(e) {
      pointerClickState.x = e.clientX;
      pointerClickState.y = e.clientY;
      beginDirectBoxDrag(e);
    }

    function handlePointerUp(e) {
      if (finishDirectBoxDrag(e)) return;
      if (transformControl.dragging) return;

      const movedDistance = Math.hypot(
        e.clientX - pointerClickState.x,
        e.clientY - pointerClickState.y
      );

      if (movedDistance > 6) return;

      updatePointerRay(e);
      const hits = raycaster.intersectObjects(boxes, false);
      const nextSelected = hits.length > 0 ? hits[0].object : null;

      if (getCurrentManualMode() === 'rotate' && nextSelected) {
        if (selected === nextSelected) {
          cycleSelectedOrientation();
          return;
        }
      }

      setSelectedBox(nextSelected);
    }

    function handleCanvasDoubleClick() {
      if (selected) {
        focusSelectedBox();
      }
    }

    function handlePointerCancel(event) {
      finishDirectBoxDrag(event);
    }

    function renderMultiBoxTypeRow(item, index) {
      const normalized = normalizeCargoItem(item, index);

      return `
        <div class="multi-box-row" data-id="${normalized.id}">
          <div class="dimension-inputs">
            <div class="input-group">
              <label>Tên item</label>
              <input data-field="label" value="${escapeHtml(normalized.label || `Item ${index + 1}`)}" />
            </div>
            <div class="input-group">
              <label>Số lượng</label>
              <input data-field="qty" type="number" min="1" value="${normalized.qty}" />
            </div>
            <div class="input-group">
              <label>Priority group</label>
              <input data-field="priorityGroup" type="number" min="1" value="${normalized.priorityGroup}" />
            </div>
          </div>

          <div class="dimension-inputs">
            <div class="input-group">
              <label>Rộng</label>
              <input data-field="w" type="number" min="1" value="${normalized.w}" />
            </div>
            <div class="input-group">
              <label>Cao</label>
              <input data-field="h" type="number" min="1" value="${normalized.h}" />
            </div>
            <div class="input-group">
              <label>Dài</label>
              <input data-field="d" type="number" min="1" value="${normalized.d}" />
            </div>
          </div>

          <div class="dimension-inputs">
            <div class="input-group">
              <label>Khối lượng</label>
              <input data-field="weight" type="number" min="1" value="${normalized.weight}" />
            </div>
          </div>

          <div class="dimension-inputs">
            <div class="input-group">
              <label>Delivery zone</label>
              <select data-field="deliveryZone">
                <option value="any" ${normalized.deliveryZone === 'any' ? 'selected' : ''}>Không cố định</option>
                <option value="head" ${normalized.deliveryZone === 'head' ? 'selected' : ''}>Đầu container</option>
                <option value="middle" ${normalized.deliveryZone === 'middle' ? 'selected' : ''}>Giữa container</option>
                <option value="door" ${normalized.deliveryZone === 'door' ? 'selected' : ''}>Gần cửa</option>
              </select>
            </div>
            <div class="input-group">
              <label>Stack limit</label>
              <input data-field="stackLimit" type="number" min="0" value="${normalized.stackLimit}" />
            </div>
            <div class="input-group">
              <label>Max load above</label>
              <input data-field="maxLoadAbove" type="number" min="0" value="${normalized.maxLoadAbove}" />
            </div>
          </div>

          <div class="dimension-inputs">
            <label class="multi-box-checkbox">
              <input data-field="allowRotate" type="checkbox" ${normalized.allowRotate ? 'checked' : ''} />
              <span>Allow rotate</span>
            </label>
            <label class="multi-box-checkbox">
              <input data-field="noStack" type="checkbox" ${normalized.noStack ? 'checked' : ''} />
              <span>No stack</span>
            </label>
            <label class="multi-box-checkbox">
              <input data-field="noTilt" type="checkbox" ${normalized.noTilt ? 'checked' : ''} />
              <span>No tilt</span>
            </label>
          </div>

          <div class="section-note">
            Item list là đầu vào cho load planning engine. Bạn có thể mô tả thêm delivery zone,
            stack limit và tải đè tối đa để optimizer chạy sát điều kiện vận hành thực hơn.
          </div>

          <div class="multi-box-row-actions">
            <button type="button" class="btn-icon danger btn-remove-box-type" title="Xóa loại thùng">🗑️</button>
          </div>
        </div>
      `;
    }

    function bindMultiBoxTypeEvents() {
      if (!multiBoxTypesList) return;

      multiBoxTypesList.querySelectorAll('.multi-box-row').forEach((row) => {
        const id = Number(row.dataset.id);

        row.querySelectorAll('input, select').forEach((input) => {
          const updateTypeValue = (e) => {
            const field = e.target.dataset.field;
            const value =
              field === 'label' || field === 'deliveryZone'
                ? e.target.value
                : field === 'allowRotate' || field === 'noStack' || field === 'noTilt'
                  ? Boolean(e.target.checked)
                  : Number(e.target.value);

            multiBoxTypes = multiBoxTypes.map((item) =>
              item.id === id
                ? {
                    ...item,
                    [field]: value,
                  }
                : item
            );
          };

          input.addEventListener('input', updateTypeValue);

          input.addEventListener('change', (e) => {
            updateTypeValue(e);
            renderPreviewItemsScene();
            pushHistorySnapshot();
          });
        });

        const removeBtn = row.querySelector('.btn-remove-box-type');
        removeBtn?.addEventListener('click', () => {
          multiBoxTypes = multiBoxTypes.filter((item) => item.id !== id);
          renderMultiBoxTypes();
          renderPreviewItemsScene();
          pushHistorySnapshot();
        });
      });
    }

    function renderMultiBoxTypes() {
      if (!multiBoxTypesList) return;
      multiBoxTypesList.innerHTML = multiBoxTypes
        .map((item, index) => renderMultiBoxTypeRow(item, index))
        .join('');
      bindMultiBoxTypeEvents();
    }

    function addMultiBoxType() {
      multiBoxTypes.push({
        id: Date.now() + Math.floor(Math.random() * 10000),
        label: `Item ${multiBoxTypes.length + 1}`,
        w: 60,
        h: 50,
        d: 80,
        weight: 20,
        qty: 1,
        allowRotate: true,
        noStack: false,
        noTilt: false,
        priorityGroup: 1,
        stackLimit: 0,
        maxLoadAbove: 0,
        deliveryZone: 'any',
      });
      renderMultiBoxTypes();
      renderPreviewItemsScene();
      pushHistorySnapshot();
    }

    function buildRejectedListHtml(title, items, color = '#fbbf24') {
      if (!items || items.length === 0) return '';

      return `
        <div style="margin-top:12px;">
          <div style="font-weight:700;color:${color};margin-bottom:8px;">${title}</div>
          <div style="display:grid;gap:8px;">
            ${items
              .map(
                (item) => `
                  <div style="padding:10px;border-radius:8px;background:rgba(15,23,42,0.7);border:1px solid rgba(148,163,184,0.18);line-height:1.6;">
                    <div><b>Loại thùng:</b> ${item.label}</div>
                    <div><b>Kích thước:</b> Dài ${item.d} × Rộng ${item.w} × Cao ${item.h} cm</div>
                    <div><b>Khối lượng:</b> ${item.weight} kg</div>
                    <div><b>Priority group:</b> ${normalizePriorityGroup(item.priorityGroup ?? item.deliveryOrder)}</div>
                    <div><b>Allow rotate:</b> ${formatAllowRotateLabel(item)}</div>
                    <div><b>No stack:</b> ${formatNoStackLabel(Boolean(item.noStack ?? item.fragile))}</div>
                    <div><b>No tilt:</b> ${formatNoTiltLabel(Boolean(item.noTilt ?? item.rotationMode === 'upright'))}</div>
                    ${item.reason ? `<div><b>Lý do:</b> ${item.reason}</div>` : ''}
                    <div><b>Số lượng bị loại:</b> ${item.count} thùng</div>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    function buildOptimizeWarningHtml(result) {
      const warnings = [];

      if (result.overSpaceRequested) {
        warnings.push(
          `⚠️ Tổng số thùng yêu cầu vượt quá <b>dung tích không gian</b> của container. Hệ thống đã tự giảm bớt để chỉ giữ số lượng vừa đủ.`
        );
      }

      if (result.overWeightRequested) {
        warnings.push(
          `⚠️ Tổng khối lượng thùng yêu cầu vượt quá <b>tải trọng tối đa</b> của container. Hệ thống đã tự loại bớt thùng để không vượt tải.`
        );
      }

      if (result.rejectedByConstraintCount > 0) {
        warnings.push(
          `⚠️ Có item bị loại vì <b>noStack</b>, <b>noTilt</b>, <b>priority group</b> hoặc các kiểm tra mặt đỡ.`
        );
      }

      if (result.balanceWarnings?.length > 0) {
        warnings.push(
          `⚠️ Bố trí cuối cùng vẫn còn một số cảnh báo về <b>cân bằng tải trọng</b>, hãy xem chi tiết ở mục phân bố tải phía dưới.`
        );
      }

      const rejectedSpaceDetails =
        result.rejectedBySpaceSummary && result.rejectedBySpaceSummary.length > 0
          ? `
            <div style="margin-top:10px;">
              <div><b>📦 Thùng bị loại do không gian:</b> ${result.rejectedBySpaceCount} thùng</div>
              <div style="margin-top:6px;display:grid;gap:6px;">
                ${result.rejectedBySpaceSummary
                  .map(
                    (item) => `
                      <div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.06);">
                        • ${item.label}: Dài ${item.d} × Rộng ${item.w} × Cao ${item.h} cm, ${item.weight} kg, bị loại ${item.count} thùng
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `
          : '';

      const rejectedWeightDetails =
        result.rejectedByWeightSummary && result.rejectedByWeightSummary.length > 0
          ? `
            <div style="margin-top:10px;">
              <div><b>⚖️ Thùng bị loại do khối lượng:</b> ${result.rejectedByWeightCount} thùng</div>
              <div style="margin-top:6px;display:grid;gap:6px;">
                ${result.rejectedByWeightSummary
                  .map(
                    (item) => `
                      <div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.06);">
                        • ${item.label}: Dài ${item.d} × Rộng ${item.w} × Cao ${item.h} cm, ${item.weight} kg, bị loại ${item.count} thùng
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `
          : '';

      const rejectedConstraintDetails =
        result.rejectedByConstraintSummary && result.rejectedByConstraintSummary.length > 0
          ? `
            <div style="margin-top:10px;">
              <div><b>🧱 Thùng bị loại do ràng buộc:</b> ${result.rejectedByConstraintCount} thùng</div>
              <div style="margin-top:6px;display:grid;gap:6px;">
                ${result.rejectedByConstraintSummary
                  .map(
                    (item) => `
                      <div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.06);">
                        • ${item.label}: ${item.reason || 'Ràng buộc xếp chồng'}, bị loại ${item.count} thùng
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `
          : '';

      if (
        warnings.length === 0 &&
        !rejectedSpaceDetails &&
        !rejectedWeightDetails &&
        !rejectedConstraintDetails
      ) {
        return '';
      }

      return `
        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.45);color:#fde68a;line-height:1.65;">
          ${warnings.map((w) => `<div>${w}</div>`).join('')}
          ${rejectedSpaceDetails}
          ${rejectedWeightDetails}
          ${rejectedConstraintDetails}
        </div>
      `;
    }

    function renderOptimizedResultBoxes(result, sampleStrategy = 'first') {
      let lastBox = null;

      result.placed.forEach((item, index) => {
        const snappedPlacement = resolveSupportedPosition(
          {
            x: item.x + item.w / 2,
            y: item.y + item.h / 2,
            z: item.z + item.d / 2,
          },
          { w: item.w, h: item.h, d: item.d }
        );

        lastBox = addBox({
          w: item.w,
          h: item.h,
          d: item.d,
          x: snappedPlacement.x,
          y: snappedPlacement.y,
          z: snappedPlacement.z,
          weight: item.weight,
          isSample: sampleStrategy === 'first' ? index === 0 : false,
          label: item.label,
          originalSize: item.originalSize,
          allowRotate: Boolean(item.allowRotate ?? item.rotationMode !== 'fixed'),
          noStack: Boolean(item.noStack ?? item.fragile),
          noTilt: Boolean(item.noTilt ?? item.rotationMode === 'upright'),
          priorityGroup: normalizePriorityGroup(item.priorityGroup ?? item.deliveryOrder),
          stackLimit: Number(item.stackLimit || 0),
          maxLoadAbove: Number(item.maxLoadAbove || 0),
          deliveryZone: item.deliveryZone || 'any',
          stackLevel: item.stackLevel,
          loadAboveKg: item.loadAboveKg,
          supportRatio: item.supportRatio,
          floorBearingWeight: item.floorBearingWeight,
          floorPressureKgM2: item.floorPressureKgM2,
          sceneRole: 'placement',
        });
      });

      if (lastBox) {
        setSelectedBox(lastBox);
      }
    }

    function renderOptimizationReport(result, title) {
      const warningHtml = buildOptimizeWarningHtml(result);
      const rejectedSpaceHtml = buildRejectedListHtml(
        '📦 Danh sách thùng bị loại do không gian',
        result.rejectedBySpaceSummary,
        '#fbbf24'
      );
      const rejectedWeightHtml = buildRejectedListHtml(
        '⚖️ Danh sách thùng bị loại do khối lượng',
        result.rejectedByWeightSummary,
        '#fb7185'
      );
      const rejectedConstraintHtml = buildRejectedListHtml(
        '🧱 Danh sách thùng bị loại do ràng buộc',
        result.rejectedByConstraintSummary,
        '#c4b5fd'
      );
      const floorLoadText = Number.isFinite(result.floorLoadLimit)
        ? `${result.floorLoadLimit.toFixed(2)} kg/m²`
        : 'Không giới hạn';
      const commercial = analyzeCommercialPlan({
        items: multiBoxTypes,
        result,
        container: getCurrentContainerSize(),
        maxWeight: getCurrentContainerMaxLoad(),
        floorLoadLimit: getPackingFloorLoadLimit(),
        settings: readCommercialInputs(),
      });
      const strategiesHtml =
        Array.isArray(result.evaluatedStrategies) && result.evaluatedStrategies.length > 0
          ? `
            <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(15,23,42,0.72);border:1px solid rgba(45,212,191,0.22);line-height:1.65;color:#dcfce7;">
              <div style="font-weight:700;color:#86efac;margin-bottom:8px;">🧠 Các heuristic đã thử</div>
              <div style="margin-bottom:8px;">Chiến lược được chọn: <b>${result.strategyLabel || 'Không xác định'}</b></div>
              <div style="display:grid;gap:6px;">
                ${result.evaluatedStrategies
                  .map(
                    (strategy) => `
                      <div style="padding:8px 10px;border-radius:8px;background:${strategy.id === result.strategyId ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.04)'};border:1px solid ${strategy.id === result.strategyId ? 'rgba(74,222,128,0.35)' : 'rgba(148,163,184,0.12)'};">
                        <b>#${strategy.dispatchRank || '-'} ${strategy.label}</b>: ${strategy.packedCount} thùng, ${strategy.efficiency.toFixed(2)}% thể tích, lệch ngang ${strategy.sideImbalancePercent.toFixed(2)}%, lệch dọc ${strategy.lengthImbalancePercent.toFixed(2)}%
                        ${strategy.dispatchReason ? `<div style="margin-top:4px;color:#a7f3d0;">${strategy.dispatchReason}</div>` : ''}
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `
          : '';
      const optimizerIntelligenceHtml = result.optimizerIntelligence
        ? `
          <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(8,145,178,0.10);border:1px solid rgba(34,211,238,0.28);line-height:1.65;color:#cffafe;">
            <div style="font-weight:700;color:#67e8f9;margin-bottom:8px;">🤖 Optimizer intelligence</div>
            <div><b>Planning mode:</b> ${result.optimizerIntelligence.planningMode}</div>
            <div><b>Advisor confidence:</b> ${result.optimizerIntelligence.confidence}%</div>
            <div><b>Advisor primary strategy:</b> ${result.optimizerIntelligence.primaryStrategyLabel}</div>
            <div style="margin-top:8px;"><b>Nhánh được chọn thực tế:</b> ${result.optimizerIntelligence.selectedStrategyLabel}</div>
            <div style="margin-top:8px;">${result.optimizerIntelligence.selectionReason}</div>
            <div style="margin-top:8px;">${result.optimizerIntelligence.rationale.map((item) => `• ${item}`).join('<br/>')}</div>
          </div>
        `
        : '';
      const commercialHtml = `
        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(15,23,42,0.72);border:1px solid rgba(16,185,129,0.26);line-height:1.65;color:#d1fae5;">
          <div style="font-weight:700;color:#86efac;margin-bottom:8px;">💼 Commercial intelligence</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>Shipment:</div>
            <div style="text-align:right;font-weight:bold;">${commercial.settings.projectName}</div>

            <div>Customer:</div>
            <div style="text-align:right;font-weight:bold;">${commercial.settings.customerName}</div>

            <div>Service level:</div>
            <div style="text-align:right;font-weight:bold;">${commercial.serviceLabel}</div>

            <div>Readiness score:</div>
            <div style="text-align:right;font-weight:bold;">${commercial.score.toFixed(0)}/100 • ${commercial.grade}</div>

            <div>SLA status:</div>
            <div style="text-align:right;font-weight:bold;">${commercial.slaStatus}</div>

            <div>Value at risk:</div>
            <div style="text-align:right;font-weight:bold;">${formatCurrencyUsd(commercial.finance.cargoValueAtRisk)}</div>

            <div>Unused freight:</div>
            <div style="text-align:right;font-weight:bold;">${formatCurrencyUsd(commercial.finance.unusedFreightCost)}</div>

            <div>Cost / packed unit:</div>
            <div style="text-align:right;font-weight:bold;">${formatCurrencyUsd(commercial.finance.costPerPackedUnit)}</div>
          </div>

          <div style="margin-top:10px;color:#e2e8f0;">
            <b>${commercial.headline}</b><br/>
            ${commercial.recommendations.map((item) => `• ${item}`).join('<br/>')}
          </div>
        </div>
      `;

      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ${title}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>📦 Tổng yêu cầu:</div>
          <div style="text-align:right;font-weight:bold;">${result.totalRequested}</div>

          <div>📦 Đã xếp thực tế:</div>
          <div style="text-align:right;font-weight:bold;color:#10b981;">${result.packedCount}</div>

          <div>❌ Không được xếp:</div>
          <div style="text-align:right;font-weight:bold;color:#f59e0b;">${result.remaining}</div>

          <div>📦 Loại do không gian:</div>
          <div style="text-align:right;font-weight:bold;">${result.rejectedBySpaceCount}</div>

          <div>⚖️ Loại do khối lượng:</div>
          <div style="text-align:right;font-weight:bold;">${result.rejectedByWeightCount}</div>

          <div>🧱 Loại do ràng buộc:</div>
          <div style="text-align:right;font-weight:bold;">${result.rejectedByConstraintCount}</div>

          <div>📊 Hiệu suất thể tích:</div>
          <div style="text-align:right;font-weight:bold;">${result.efficiency.toFixed(2)}%</div>

          <div>⚖️ Khối lượng đã xếp:</div>
          <div style="text-align:right;font-weight:bold;">${result.totalPlacedWeight.toFixed(2)} kg</div>

          <div>🚚 Tải trọng container:</div>
          <div style="text-align:right;font-weight:bold;">${
            Number.isFinite(result.maxWeight) ? result.maxWeight.toFixed(2) : 'Không giới hạn'
          } kg</div>

          <div>🪵 Giới hạn tải sàn:</div>
          <div style="text-align:right;font-weight:bold;">${floorLoadText}</div>

          <div>📉 Áp suất sàn lớn nhất:</div>
          <div style="text-align:right;font-weight:bold;">${result.maxFloorPressure.toFixed(2)} kg/m²</div>

          <div>🏗️ Số tầng cao nhất:</div>
          <div style="text-align:right;font-weight:bold;">${result.maxStackLevel}</div>

          <div>🏋️ Tải đè lớn nhất:</div>
          <div style="text-align:right;font-weight:bold;">${result.maxLoadAboveKg.toFixed(2)} kg</div>

          <div>↔️ Cân bằng trái / phải:</div>
          <div style="text-align:right;font-weight:bold;">${result.loadBalance.sideImbalancePercent.toFixed(2)}%</div>

          <div>↕️ Cân bằng đầu / cửa:</div>
          <div style="text-align:right;font-weight:bold;">${result.loadBalance.lengthImbalancePercent.toFixed(2)}%</div>
        </div>

        <div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.35);color:#bfdbfe;line-height:1.6;">
          ℹ️ Thuật toán đang dùng: <b>${result.algorithm}</b>. Hệ thống bung quantity thành box units,
          thử nhiều heuristic Extreme Points, rồi chọn nghiệm tốt nhất theo <b>số box đặt được</b>,
          <b>hiệu suất thể tích</b> và <b>độ cân bằng tải</b>.
        </div>

        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(15,23,42,0.72);border:1px solid rgba(96,165,250,0.22);line-height:1.65;color:#dbeafe;">
          <div><b>Phân bố tải theo chiều rộng:</b> Trái ${result.loadBalance.leftWeight.toFixed(2)} kg | Phải ${result.loadBalance.rightWeight.toFixed(2)} kg</div>
          <div><b>Phân bố tải theo chiều dài:</b> Đầu ${result.loadBalance.headWeight.toFixed(2)} kg | Cửa ${result.loadBalance.doorWeight.toFixed(2)} kg</div>
          <div><b>Độ lệch trọng tâm:</b> X ${result.loadBalance.cogX.toFixed(2)} cm | Z ${result.loadBalance.cogZ.toFixed(2)} cm</div>
          ${
            result.balanceWarnings.length > 0
              ? `<div style="margin-top:8px;color:#fcd34d;">${result.balanceWarnings.map((warning) => `• ${warning}`).join('<br/>')}</div>`
              : '<div style="margin-top:8px;color:#86efac;">Tải trọng đang được giữ khá cân bằng theo cả hai trục chính.</div>'
          }
        </div>

        ${strategiesHtml}
        ${optimizerIntelligenceHtml}
        ${commercialHtml}
        ${warningHtml}
        ${rejectedSpaceHtml}
        ${rejectedWeightHtml}
        ${rejectedConstraintHtml}

        <div style="margin-top:10px;font-size:0.84rem;color:#cbd5e1;line-height:1.5;">
          Quy ước: <b>priority group cao hơn</b> sẽ được engine xét sớm hơn. Sau khi tối ưu, mô hình 3D
          chỉ nén theo <b>sàn</b> và <b>vách trái</b> để giữ bố cục placement ổn định theo chiều dài container.
        </div>
      `;
      reportEl.style.display = 'block';
      refreshOperationsSummary({
        mode: 'optimized',
        action: title,
        result,
      });
    }

    async function runAsyncOptimizationFlow({ validTypes, title, emptyMessage }) {
      if (optimizerIsRunning) {
        showStatusMessage({
          title: '⏳ Engine đang bận',
          lines: ['Hãy đợi job tối ưu hiện tại hoàn tất rồi chạy tiếp.'],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });
        return;
      }

      if (validTypes.length === 0) {
        showStatusMessage({
          title: '⚠️ Chưa có item để tối ưu',
          lines: [emptyMessage],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });
        return;
      }

      const containerMaxWeight = getCurrentContainerMaxLoad();
      const containerSize = {
        w: +cw.value,
        h: +ch.value,
        d: +cd.value,
      };
      const floorLoadLimit = getPackingFloorLoadLimit();
      const payload = {
        container: containerSize,
        boxTypes: validTypes,
        maxWeight: containerMaxWeight,
        floorLoadLimit,
      };
      const contextSignature = buildOptimizationContextSignature(payload);

      setOptimizerRunningState(true, title);
      refreshOperationsSummary({
        mode: 'processing',
        action: `${title} đang chạy trong background worker.`,
        result: null,
      });

      try {
        const result = await computeOptimizedPacking(payload);
        const nextSignature = buildOptimizationContextSignature({
          container: getCurrentContainerSize(),
          boxTypes: getValidCargoItems().map((item) => toPackingItem(item)),
          maxWeight: getCurrentContainerMaxLoad(),
          floorLoadLimit: getPackingFloorLoadLimit(),
        });

        if (contextSignature !== nextSignature) {
          showStatusMessage({
            title: 'ℹ️ Kết quả cũ đã bị bỏ qua',
            lines: [
              'Manifest hoặc cấu hình container đã thay đổi trong lúc engine chạy.',
              'Hãy chạy lại tối ưu để lấy nghiệm mới theo dữ liệu hiện tại.',
            ],
            color: '#38bdf8',
            background: 'rgba(59,130,246,0.12)',
            border: 'rgba(96,165,250,0.4)',
          });
          refreshOperationsSummary({
            mode: 'attention',
            action: 'Dữ liệu đã đổi trong lúc engine chạy, nên kết quả cũ không được áp dụng.',
            result: null,
          });
          return;
        }

        clearShockVisuals(containerSys.shockGroup);
        clearBoxes();
        updateContainer();
        renderOptimizedResultBoxes(result);
        renderOptimizationReport(result, title);
        pushHistorySnapshot();
      } catch (error) {
        showStatusMessage({
          title: '❌ Không thể chạy optimizer',
          lines: [error instanceof Error ? error.message : 'Lỗi không xác định từ optimizer.'],
          color: '#fb7185',
          background: 'rgba(244,63,94,0.12)',
          border: 'rgba(251,113,133,0.45)',
        });
        refreshOperationsSummary({
          mode: 'attention',
          action: 'Optimizer bị lỗi và chưa trả về layout hợp lệ.',
          result: null,
        });
      } finally {
        setOptimizerRunningState(false);
      }
    }

    async function optimizeMultiTypeBoxes() {
      const validTypes = getValidCargoItems().map((item) => toPackingItem(item));

      await runAsyncOptimizationFlow({
        validTypes,
        title: '✅ ENGINE ĐÃ XẾP TỐI ƯU DANH SÁCH ITEM',
        emptyMessage:
          'Vui lòng thêm ít nhất 1 loại thùng có số lượng, kích thước và khối lượng lớn hơn 0.',
      });
    }

    async function optimizeCurrentBoxesAdvanced() {
      const currentTypes = getValidCargoItems().map((item) => toPackingItem(item));

      await runAsyncOptimizationFlow({
        validTypes: currentTypes,
        title: '🚀 AI PRO ĐÃ TÍNH PLACEMENT CHO DANH SÁCH ITEM',
        emptyMessage:
          'Hãy Add item trước rồi chạy AI Pro để engine tính toán placement trong cargo space.',
      });
    }

    function removeSelectedBox() {
      if (!selected) {
        showStatusMessage({
          title: '⚠️ Chưa chọn thùng',
          lines: ['Click vào một thùng trong mô hình 3D rồi nhấn Delete để xóa.'],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });
        return;
      }

      const removedId = selected.userData.id;
      const removedLabel = selected.userData.label || 'Thùng';
      const boxToRemove = selected;

      boxes = boxes.filter((box) => box !== boxToRemove);
      disposeBox(scene, boxToRemove);
      setSelectedBox(boxes[boxes.length - 1] || null);
      updateStats();
      pushHistorySnapshot();

      showStatusMessage({
        title: '🗑️ Đã xóa thùng đang chọn',
        lines: [
          `ID: <b>${removedId}</b>`,
          `Loại: <b>${removedLabel}</b>`,
          `Số thùng còn lại: <b>${boxes.length}</b>`,
        ],
        color: '#fb7185',
        background: 'rgba(244,63,94,0.12)',
        border: 'rgba(251,113,133,0.45)',
      });
      refreshOperationsSummary({
        mode: 'editing',
        action: `Đã xoá box "${removedLabel}" khỏi layout hiện tại.`,
        result: null,
      });
    }

    function undoScene() {
      if (historyPast.length < 2) {
        showStatusMessage({
          title: '↩️ Không còn thao tác để undo',
          lines: ['Lịch sử hiện tại đã ở trạng thái đầu tiên.'],
        });
        return;
      }

      const currentSnapshot = historyPast.pop();
      historyFuture.push(currentSnapshot);
      applySceneState(historyPast[historyPast.length - 1]);

      showStatusMessage({
        title: '↩️ Đã undo',
        lines: [`Số thùng hiện tại: <b>${boxes.length}</b>`],
        color: '#38bdf8',
      });
      refreshOperationsSummary({
        mode: 'editing',
        action: 'Đã undo về trạng thái trước đó.',
        result: null,
      });
    }

    function redoScene() {
      if (historyFuture.length === 0) {
        showStatusMessage({
          title: '↪️ Không còn thao tác để redo',
          lines: ['Chưa có trạng thái nào trong hàng đợi redo.'],
        });
        return;
      }

      const nextSnapshot = historyFuture.pop();
      applySceneState(nextSnapshot);
      historyPast.push(nextSnapshot);

      showStatusMessage({
        title: '↪️ Đã redo',
        lines: [`Số thùng hiện tại: <b>${boxes.length}</b>`],
        color: '#38bdf8',
      });
      refreshOperationsSummary({
        mode: 'editing',
        action: 'Đã redo sang trạng thái tiếp theo.',
        result: null,
      });
    }

    function persistScene() {
      saveSceneState(captureSceneState());

      showStatusMessage({
        title: '💾 Đã lưu trạng thái',
        lines: [
          `Container: <b>${cd.value} × ${cw.value} × ${ch.value}</b> cm`,
          `Số thùng đã lưu: <b>${boxes.length}</b>`,
          `Danh sách loại thùng: <b>${multiBoxTypes.length}</b>`,
        ],
        color: '#22c55e',
        background: 'rgba(34,197,94,0.12)',
        border: 'rgba(74,222,128,0.45)',
      });
      refreshOperationsSummary({
        mode: 'saved',
        action: 'Đã lưu scene hiện tại vào local storage của trình duyệt.',
      });
    }

    function restoreSavedScene() {
      const savedState = loadSceneState();

      if (!savedState) {
        showStatusMessage({
          title: '⚠️ Chưa có trạng thái đã lưu',
          lines: ['Nhấn nút lưu trước để ghi lại bố cục container hiện tại.'],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });
        return;
      }

      applySceneState(savedState);
      pushHistorySnapshot();

      showStatusMessage({
        title: '📂 Đã tải trạng thái đã lưu',
        lines: [
          `Container: <b>${cd.value} × ${cw.value} × ${ch.value}</b> cm`,
          `Số thùng khôi phục: <b>${boxes.length}</b>`,
          `Loại thùng đang có: <b>${multiBoxTypes.length}</b>`,
        ],
        color: '#22c55e',
        background: 'rgba(34,197,94,0.12)',
        border: 'rgba(74,222,128,0.45)',
      });
      refreshOperationsSummary({
        mode: 'loaded',
        action: 'Đã khôi phục scene đã lưu trước đó từ local storage.',
        result: null,
      });
    }

    function clearScene() {
      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      multiBoxTypes = [];
      renderMultiBoxTypes();
      updateContainer();
      reportEl.style.display = 'none';
      pushHistorySnapshot();
      refreshOperationsSummary({
        mode: 'editing',
        action: 'Đã xoá toàn bộ layout và danh sách item hiện tại.',
        result: null,
      });
    }

    function resetView() {
      sceneSys.fitCameraToBox(+cw.value, +ch.value, +cd.value);
      updateViewerStatus();
    }

    function populateRandomBoxes() {
      const containerMaxWeight = getCurrentContainerMaxLoad();
      let currentTotalWeight = boxes.reduce((sum, b) => sum + Number(b.userData.weight || 0), 0);
      let created = 0;
      let skipped = 0;
      let lastCreatedBox = null;

      for (let i = 0; i < 20; i++) {
        const w = 30 + Math.floor(Math.random() * 70);
        const h = 30 + Math.floor(Math.random() * 70);
        const d = 30 + Math.floor(Math.random() * 70);
        const weight = 10 + Math.floor(Math.random() * 50);

        if (currentTotalWeight + weight > containerMaxWeight) {
          skipped++;
          continue;
        }

        const spawnPosition = findManualSpawnPosition({ w, h, d });

        lastCreatedBox = addBox({
          w,
          h,
          d,
          x: spawnPosition.x,
          y: spawnPosition.y,
          z: spawnPosition.z,
          weight,
          label: 'Ngẫu nhiên',
          originalSize: { w, h, d },
        });

        currentTotalWeight += weight;
        created++;
      }

      if (lastCreatedBox) {
        setSelectedBox(lastCreatedBox);
      }
      if (created > 0) {
        pushHistorySnapshot();
      }

      if (skipped > 0) {
        reportEl.innerHTML = `
          <div style="color:#f59e0b;font-size:1.05rem;font-weight:bold;margin-bottom:8px;">
            ⚠️ RANDOM THÙNG ĐÃ ĐƯỢC GIẢM
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>Đã tạo:</div>
            <div style="text-align:right;font-weight:bold;">${created}</div>

            <div>Bị loại do vượt tải:</div>
            <div style="text-align:right;font-weight:bold;">${skipped}</div>
          </div>
        `;
        reportEl.style.display = 'block';
      }

      refreshOperationsSummary({
        mode: 'editing',
        action:
          created > 0
            ? `Đã sinh ngẫu nhiên ${created} box để thử layout nhanh.`
            : 'Random fill không tạo được box nào hợp lệ trong container hiện tại.',
        result: null,
      });
    }

    function downloadScreenshot() {
      renderer.render(scene, camera);
      const link = document.createElement('a');
      link.download = `packing-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = renderer.domElement.toDataURL('image/png');
      link.click();
    }

    function applySelectedOrientation(index) {
      if (!selected) {
        showStatusMessage({
          title: '⚠️ Chưa chọn thùng',
          lines: ['Hãy click vào một thùng trước khi chuyển sang lật.'],
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.45)',
        });
        return;
      }

      setManualControlMode('rotate');
      const orientations = getSelectedOrientationOptions();
      const nextOrientation = orientations[index];
      if (!nextOrientation) return;

      const before = sceneStateSignature(captureSceneState());

      selected.rotation.set(0, 0, 0);
      updateCartonGeometry(selected, nextOrientation.size);

      const supported = resolveSupportedPosition(selected.position, nextOrientation.size, selected);
      selected.position.set(supported.x, supported.y, supported.z);
      refreshSelectedBoxDetails();

      const changed = sceneStateSignature(captureSceneState()) !== before;
      if (changed) {
        pushHistorySnapshot();
        showStatusMessage({
          title: '🔄 Đã lật thùng theo 6 mặt',
          lines: [
            `Hướng mới: <b>${nextOrientation.label}</b>`,
            `Kích thước đang hiển thị: <b>${nextOrientation.size.w} × ${nextOrientation.size.h} × ${nextOrientation.size.d} cm</b>`,
            'Preset này sẽ đưa thùng về tư thế chuẩn theo trục container.',
          ],
          color: '#8b5cf6',
          background: 'rgba(139,92,246,0.14)',
          border: 'rgba(167,139,250,0.45)',
        });
        refreshOperationsSummary({
          mode: 'editing',
          action: `Đã đổi orientation cho box "${selected.userData.label || 'Thùng'}".`,
        });
      }
    }

    function cycleSelectedOrientation() {
      if (!selected) return;

      const orientations = getSelectedOrientationOptions();
      if (orientations.length === 0) return;

      const currentSize = selected.userData.size;
      const currentIndex = orientations.findIndex(
        (option) =>
          Number(option.size.w) === Number(currentSize.w) &&
          Number(option.size.h) === Number(currentSize.h) &&
          Number(option.size.d) === Number(currentSize.d)
      );

      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % orientations.length : 0;
      applySelectedOrientation(nextIndex);
    }

    function keepBoxesInsideContainer() {
      let changed = false;

      boxes.forEach((box) => {
        const clamped = resolveSupportedPosition(box.position, box.userData.size, box);
        const hasMoved =
          box.position.x !== clamped.x ||
          box.position.y !== clamped.y ||
          box.position.z !== clamped.z;

        if (hasMoved) {
          box.position.set(clamped.x, clamped.y, clamped.z);
          changed = true;
        }
      });

      if (changed) {
        refreshSelectedBoxDetails();
      }

      return changed;
    }

    function handleTransformObjectChange() {
      refreshSelectedBoxDetails();
    }

    function handleTransformMouseDown() {
      transformSnapshotBeforeDrag = sceneStateSignature(captureSceneState());
    }

    function handleTransformMouseUp() {
      if (selected) {
        const clamped = resolveSupportedPosition(selected.position, selected.userData.size, selected);
        selected.position.set(clamped.x, clamped.y, clamped.z);
        refreshSelectedBoxDetails();
      }

      if (!transformSnapshotBeforeDrag) return;

      const nextSignature = sceneStateSignature(captureSceneState());
      if (nextSignature !== transformSnapshotBeforeDrag) {
        pushHistorySnapshot();
        refreshOperationsSummary({
          mode: 'editing',
          action: 'Đã chỉnh tay vị trí box trong layout hiện tại.',
        });
      }

      transformSnapshotBeforeDrag = null;
    }

    function handleKeyDown(event) {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;

      if (hasModifier && key === 'z') {
        event.preventDefault();
        undoScene();
        return;
      }

      if (hasModifier && key === 'y') {
        event.preventDefault();
        redoScene();
        return;
      }

      if (hasModifier && key === 's') {
        event.preventDefault();
        persistScene();
        return;
      }

      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isTypingTarget) return;

      if (key === 't') {
        event.preventDefault();
        setManualControlMode('translate');
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        setManualControlMode('rotate');
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        removeSelectedBox();
      }
    }

    function handleAutoHideWallsChange() {
      updateContainerViewOcclusion({
        wallMeshes: containerSys.wallMeshes,
        camera,
        height: +ch.value,
        enabled: autoHideWalls?.checked !== false,
        mode: getWallOcclusionMode(),
      });
      updateViewerStatus();
      pushHistorySnapshot();
    }

    function handleCutawayModeChange() {
      syncViewerClippingTargets();
      updateViewerStatus();
      pushHistorySnapshot();
    }

    function handleCommercialSettingsInput() {
      syncCloudPlanNameFromCommercial();
      refreshOperationsSummary({});
    }

    function handleCommercialSettingsChange() {
      syncCloudPlanNameFromCommercial();
      refreshOperationsSummary({
        action: 'Đã cập nhật hồ sơ shipment và mục tiêu commercial hiện tại.',
      });
      pushHistorySnapshot();
    }

    function handleCloudPlanSelectionChange() {
      activeCloudPlanId = cloudPlanList?.value || null;
      const selectedPlan = getSelectedCloudPlan();

      if (selectedPlan && cloudPlanName && document.activeElement !== cloudPlanName) {
        cloudPlanName.value = selectedPlan.name || '';
      }

      renderCloudPlanStatus(selectedPlan);
    }

    function handleLeadEmailInput() {
      const email = leadEmail?.value?.trim();
      if (!email) return;

      if (reportRecipientEmail && !reportRecipientEmail.value.trim()) {
        reportRecipientEmail.value = email;
      }
      if (authEmail && !authEmail.value.trim()) {
        authEmail.value = email;
      }
    }

    if (localStorage.getItem('contType')) {
      contType.value = localStorage.getItem('contType');
      cw.value = localStorage.getItem('cw') || 235;
      ch.value = localStorage.getItem('ch') || 239;
      cd.value = localStorage.getItem('cd') || 590;
    }

    applyCommercialSettings();
    void refreshPlatformStatus({ silent: false });
    updatePlatformCommandAvailability();
    renderCloudPlanList([]);
    updateCloudCommandAvailability();
    if (hasPendingCloudAuthRedirect()) {
      void activateCloudWorkspace({ syncSession: true, silent: true });
    }
    syncProjectPresetHint();
    updateContainer({ fitCamera: true });
    syncCapacityInputs();
    renderMultiBoxTypes();
    renderPreviewItemsScene();
    applySidebarCollapsedState(sidebarCollapsedPreference, { persist: false });
    sceneSys.resize();
    syncManualArrangePanel();
    updateViewerStatus();
    pushHistorySnapshot();

    contType.onchange = (e) => {
      if (e.target.value !== 'custom' && CONTAINER_TYPES[e.target.value]) {
        const d = CONTAINER_TYPES[e.target.value];
        cw.value = d.w;
        ch.value = d.h;
        cd.value = d.d;
      }

      updateContainer({ fitCamera: true });
      syncCapacityInputs();
      localStorage.setItem('contType', e.target.value);
      localStorage.setItem('cw', cw.value);
      localStorage.setItem('ch', ch.value);
      localStorage.setItem('cd', cd.value);
      refreshOperationsSummary({
        mode: 'editing',
        action: `Đã đổi container sang ${CONTAINER_TYPES[e.target.value]?.label || 'Custom'}.`,
        result: null,
      });
      pushHistorySnapshot();
    };

    [cw, ch, cd].forEach((el) => {
      el.onchange = () => {
        updateContainer({ fitCamera: true });
        syncCapacityInputs();
        keepBoxesInsideContainer();
        refreshOperationsSummary({
          mode: 'editing',
          action: 'Đã cập nhật kích thước container hiện tại.',
          result: null,
        });
        pushHistorySnapshot();
      };
    });

    opacitySlider?.addEventListener('input', updateContainer);
    opacitySlider?.addEventListener('change', pushHistorySnapshot);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown, true);
    renderer.domElement.addEventListener('pointermove', handlePointerMove, true);
    renderer.domElement.addEventListener('pointerup', handlePointerUp, true);
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel, true);
    renderer.domElement.addEventListener('dblclick', handleCanvasDoubleClick, true);
    window.addEventListener('keydown', handleKeyDown);
    orbit.addEventListener('change', updateViewerStatus);
    transformControl.addEventListener('objectChange', handleTransformObjectChange);
    transformControl.addEventListener('mouseDown', handleTransformMouseDown);
    transformControl.addEventListener('mouseUp', handleTransformMouseUp);
    autoHideWalls?.addEventListener('change', handleAutoHideWallsChange);
    wallOcclusionMode?.addEventListener('change', handleAutoHideWallsChange);
    cutawayMode?.addEventListener('change', handleCutawayModeChange);
    packingFloorLoadLimit?.addEventListener('change', pushHistorySnapshot);
    projectPreset?.addEventListener('change', syncProjectPresetHint);
    planImportInput?.addEventListener('change', handleProjectPlanImport);
    manifestImportInput?.addEventListener('change', handleManifestFileImport);
    commercialInputElements.forEach((input) => {
      input.addEventListener('input', handleCommercialSettingsInput);
      input.addEventListener('change', handleCommercialSettingsChange);
    });
    cloudPlanList?.addEventListener('change', handleCloudPlanSelectionChange);
    leadEmail?.addEventListener('input', handleLeadEmailInput);
    manualOrientationButtons.forEach((button) => {
      button.onclick = () => applySelectedOrientation(Number(button.dataset.orientationIndex));
    });
    const commandBindingCleanups = [
      bindCommandButtons('apply-preset', applyScenarioPreset),
      bindCommandButtons('export-plan', exportProjectPlan),
      bindCommandButtons('import-plan', triggerProjectPlanImport),
      bindCommandButtons('import-manifest-text', importManifestFromTextarea),
      bindCommandButtons('import-manifest-file', triggerManifestFileImport),
      bindCommandButtons('export-report', exportOperationalReport),
      bindCommandButtons('run-preflight', runCommercialPreflightReview),
      bindCommandButtons('auth-send-link', handleSendMagicLink),
      bindCommandButtons('auth-sign-out', handleSignOutCloud),
      bindCommandButtons('cloud-refresh-plans', handleRefreshCloudPlans),
      bindCommandButtons('cloud-save-plan', handleCloudSavePlan),
      bindCommandButtons('cloud-load-plan', handleCloudLoadPlan),
      bindCommandButtons('crm-submit-lead', handleSubmitLead),
      bindCommandButtons('crm-send-report', handleSendOperationalReport),
      bindCommandButtons('add-empty-item', addMultiBoxType),
      bindCommandButtons('add-item', addSingleBoxType),
      bindCommandButtons('add-and-optimize', addSingleBoxTypeAndOptimize),
      bindCommandButtons('pack-basic', basicPacking),
      bindCommandButtons('pack-pro', optimizeCurrentBoxesAdvanced),
      bindCommandButtons('pack-optimize', optimizeMultiTypeBoxes),
      bindCommandButtons('capacity-calc', handleCapacity),
      bindCommandButtons('capacity-calc-arrange', calculateAndArrangeCapacity),
      bindCommandButtons('capacity-arrange', autoArrangeFromCapacity),
      bindCommandButtons('shock-visual', applyShockVisual),
      bindCommandButtons('undo', undoScene),
      bindCommandButtons('redo', redoScene),
      bindCommandButtons('save-scene', persistScene),
      bindCommandButtons('load-scene', restoreSavedScene),
      bindCommandButtons('clear-scene', clearScene),
      bindCommandButtons('random-fill', populateRandomBoxes),
      bindCommandButtons('reset-view', resetView),
      bindCommandButtons('view-head', () => setViewPreset('head')),
      bindCommandButtons('view-door', () => setViewPreset('door')),
      bindCommandButtons('view-left', () => setViewPreset('left')),
      bindCommandButtons('view-right', () => setViewPreset('right')),
      bindCommandButtons('view-top', () => setViewPreset('top')),
      bindCommandButtons('manual-translate', () => setManualControlMode('translate', true)),
      bindCommandButtons('manual-rotate', () => setManualControlMode('rotate', true)),
      bindCommandButtons('select-focus', focusSelectedBoxFromCommand),
      bindCommandButtons('select-cycle-orientation', cycleSelectedOrientationFromCommand),
      bindCommandButtons('select-remove', removeSelectedBox),
      bindCommandButtons('screenshot', downloadScreenshot),
      bindCommandButtons('toggle-sidebar', toggleSidebarPanel),
    ];

    const handleViewportResize = () => {
      sceneSys.resize();
      applySidebarCollapsedState(sidebarCollapsedPreference, { persist: false });
    };

    resizeObserver = new ResizeObserver(() => sceneSys.resize());
    resizeObserver.observe(canvasDiv);
    window.addEventListener('resize', handleViewportResize);

    function animate() {
      animationId = requestAnimationFrame(animate);
      if (stars) stars.rotation.y += 0.00015;
      if (cogMarker?.visible) {
        cogMarker.children[1].rotation.y += 0.01;
        cogMarker.children[2].rotation.y -= 0.01;
      }
      if (getCutawayMode() !== 'off') {
        updateCutawayPlane();
      }
      updateContainerViewOcclusion({
        wallMeshes: containerSys.wallMeshes,
        camera,
        height: +ch.value,
        enabled: autoHideWalls?.checked !== false,
        mode: getWallOcclusionMode(),
      });
      sceneSys.render();
    }

    animate();
    emitReady();

    return () => {
      activeOptimizerWorker?.terminate();
      activeOptimizerWorker = null;
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('keydown', handleKeyDown);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown, true);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove, true);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp, true);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel, true);
      renderer.domElement.removeEventListener('dblclick', handleCanvasDoubleClick, true);
      opacitySlider?.removeEventListener('input', updateContainer);
      opacitySlider?.removeEventListener('change', pushHistorySnapshot);
      autoHideWalls?.removeEventListener('change', handleAutoHideWallsChange);
      wallOcclusionMode?.removeEventListener('change', handleAutoHideWallsChange);
      cutawayMode?.removeEventListener('change', handleCutawayModeChange);
      packingFloorLoadLimit?.removeEventListener('change', pushHistorySnapshot);
      projectPreset?.removeEventListener('change', syncProjectPresetHint);
      planImportInput?.removeEventListener('change', handleProjectPlanImport);
      manifestImportInput?.removeEventListener('change', handleManifestFileImport);
      commercialInputElements.forEach((input) => {
        input.removeEventListener('input', handleCommercialSettingsInput);
        input.removeEventListener('change', handleCommercialSettingsChange);
      });
      cloudPlanList?.removeEventListener('change', handleCloudPlanSelectionChange);
      leadEmail?.removeEventListener('input', handleLeadEmailInput);
      orbit.removeEventListener('change', updateViewerStatus);
      transformControl.removeEventListener('objectChange', handleTransformObjectChange);
      transformControl.removeEventListener('mouseDown', handleTransformMouseDown);
      transformControl.removeEventListener('mouseUp', handleTransformMouseUp);
      commandBindingCleanups.forEach((cleanup) => cleanup());
      removeAuthSubscription?.();
      manualOrientationButtons.forEach((button) => {
        button.onclick = null;
      });
      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);

      renderer?.dispose?.();

      if (renderer?.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      if (sceneSys.labelRenderer?.domElement?.parentNode) {
        sceneSys.labelRenderer.domElement.parentNode.removeChild(sceneSys.labelRenderer.domElement);
      }
    };
    } catch (error) {
      console.error('Packet Opt bootstrap failed.', error);
      emitError(
        error instanceof Error ? error : new Error('Không thể khởi tạo Packet Opt workspace.')
      );
      return undefined;
    }
  }, []);

  return null;
}
