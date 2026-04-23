import assert from 'node:assert/strict';

import { SCENARIO_PRESETS } from '../src/constants/scenarioPresets.js';
import { optimizeMixedPacking } from '../src/utils/multiBoxPacking.js';
import { runCommercialPreflight, analyzeCommercialPlan } from '../src/utils/commercialHub.js';
import {
  buildOperationalReportHtml,
  buildPresetSceneState,
  buildSceneBundle,
  parseManifestText,
  unwrapImportedSceneState,
} from '../src/utils/projectWorkflow.js';
import { serializeSceneState } from '../src/utils/sceneState.js';

const preset = SCENARIO_PRESETS[0];
const manifest = parseManifestText(`label,w,h,d,weight,qty,allowRotate,noStack,noTilt,priorityGroup,deliveryZone,stackLimit,maxLoadAbove
TV 43 inch,68,14,108,15,12,true,true,true,3,door,1,0
Soundbar,18,16,105,8,10,true,false,true,2,middle,2,24
Loa mini,32,28,42,6,18,true,false,false,1,head,4,50`);

assert.equal(manifest.length, 3, 'Manifest parser phải đọc đủ số SKU.');

const container = {
  w: 235,
  h: 269,
  d: 590,
};
const maxWeight = 26000;
const floorLoadLimit = 1650;

const packingResult = optimizeMixedPacking({
  container,
  boxTypes: manifest,
  maxWeight,
  floorLoadLimit,
});

assert.ok(packingResult.packedCount > 0, 'Optimizer phải xếp được ít nhất một box trong smoke test.');
assert.ok(
  Array.isArray(packingResult.evaluatedStrategies) && packingResult.evaluatedStrategies.length > 0,
  'Smoke test yêu cầu optimizer trả về bảng so sánh chiến lược.'
);
assert.ok(
  packingResult.optimizerIntelligence?.selectedStrategyId,
  'Smoke test yêu cầu optimizer trả về optimizer intelligence cho manifest.'
);
assert.ok(
  packingResult.evaluatedStrategies.some((strategy) => strategy.id === 'pct-online-policy'),
  'Smoke test yêu cầu optimizer chạy chiến lược PCT Online AI.'
);

const preflight = runCommercialPreflight({
  items: manifest,
  container,
  maxWeight,
  floorLoadLimit,
  settings: preset.commercialSettings,
});

assert.ok(preflight.score >= 0 && preflight.score <= 100, 'Preflight score phải nằm trong 0-100.');

const commercial = analyzeCommercialPlan({
  items: manifest,
  result: packingResult,
  container,
  maxWeight,
  floorLoadLimit,
  settings: preset.commercialSettings,
});

assert.ok(commercial.grade, 'Commercial analysis phải trả về readiness grade.');

const sceneState = buildPresetSceneState(preset.id, {
  opacity: 0.22,
  commercialSettings: preset.commercialSettings,
});

const serialized = serializeSceneState({
  boxes: [],
  selected: null,
  contType: sceneState.contType,
  container: sceneState.container,
  opacity: sceneState.opacity,
  multiBoxTypes: sceneState.multiBoxTypes,
  capacityInputs: sceneState.capacityInputs,
  shockMode: sceneState.shockMode,
  shockNet: sceneState.shockNet,
  transformMode: sceneState.transformMode,
  viewerSettings: sceneState.viewerSettings,
  packingSettings: sceneState.packingSettings,
  commercialSettings: sceneState.commercialSettings,
  cameraState: {
    position: { x: 1, y: 2, z: 3 },
    target: { x: 4, y: 5, z: 6 },
  },
});

const reloadedScene = unwrapImportedSceneState(buildSceneBundle(serialized));
assert.equal(reloadedScene.version, 6, 'Scene bundle phải giữ đúng version hiện tại.');

const reportHtml = buildOperationalReportHtml({
  contType: sceneState.contType,
  container: sceneState.container,
  multiBoxTypes: manifest,
  boxes: [],
  result: packingResult,
  maxWeight,
  floorLoadLimit,
  lastAction: 'Smoke test pipeline',
  commercialSettings: preset.commercialSettings,
});

assert.ok(reportHtml.includes('<!doctype html>'), 'Executive report phải xuất ra HTML hoàn chỉnh.');
assert.ok(
  reportHtml.includes('Biên bản phương án xếp hàng thương mại'),
  'Executive report phải chứa tiêu đề bàn giao.'
);

console.log(
  JSON.stringify(
    {
      ok: true,
      manifestCount: manifest.length,
      packedCount: packingResult.packedCount,
      remaining: packingResult.remaining,
      strategy: packingResult.strategyLabel,
      planningMode: packingResult.optimizerIntelligence?.planningMode,
      readinessScore: Number(commercial.score.toFixed(1)),
      preflightScore: Number(preflight.score.toFixed(1)),
    },
    null,
    2
  )
);
