import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  FogExp2,
  GridHelper,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  SpotLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

function createSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

  gradient.addColorStop(0, '#0b1f3a');
  gradient.addColorStop(0.42, '#07111f');
  gradient.addColorStop(1, '#020617');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createSceneSystem(canvasDiv) {
  const scene = new Scene();
  scene.background = createSkyTexture();
  scene.fog = new FogExp2(0x07111f, 0.00042);

  const camera = new PerspectiveCamera(55, 1, 0.1, 20000);
  camera.position.set(900, 600, 1200);

  const renderer = new WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasDiv.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  canvasDiv.appendChild(labelRenderer.domElement);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.enablePan = true;
  orbit.enableZoom = true;
  orbit.maxPolarAngle = Math.PI / 2 - 0.02;
  orbit.minDistance = 250;
  orbit.maxDistance = 5000;

  const transformControl = new TransformControls(camera, renderer.domElement);
  transformControl.setMode('translate');
  transformControl.setSize(0.8);
  transformControl.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value;
  });
  scene.add(transformControl);

  scene.add(new AmbientLight(0xdbeafe, 0.48));
  scene.add(new HemisphereLight(0xbdefff, 0x06111f, 1.08));

  const dirLight = new DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(800, 1800, 1000);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 100;
  dirLight.shadow.camera.far = 5000;
  dirLight.shadow.camera.left = -1600;
  dirLight.shadow.camera.right = 1600;
  dirLight.shadow.camera.top = 1600;
  dirLight.shadow.camera.bottom = -1600;
  scene.add(dirLight);

  const fillLight = new PointLight(0x88aaff, 1.0);
  fillLight.position.set(-1200, 800, -800);
  scene.add(fillLight);

  const rimLight = new SpotLight(0x38bdf8, 1.7, 3800, Math.PI / 5, 0.45, 1.4);
  rimLight.position.set(-1100, 1200, 1500);
  rimLight.target.position.set(0, 120, 0);
  scene.add(rimLight);
  scene.add(rimLight.target);

  const floor = new Mesh(
    new PlaneGeometry(20000, 20000),
    new MeshStandardMaterial({
      color: 0x0f1d35,
      roughness: 0.85,
      metalness: 0.05,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  const farGrid = new GridHelper(5200, 104, 0x1d4ed8, 0x172554);
  farGrid.material.transparent = true;
  farGrid.material.opacity = 0.22;
  scene.add(farGrid);

  const workGrid = new GridHelper(2200, 44, 0x2dd4bf, 0x24445e);
  workGrid.position.y = 0.9;
  workGrid.material.transparent = true;
  workGrid.material.opacity = 0.58;
  scene.add(workGrid);

  const runwayMat = new MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x082f49,
    transparent: true,
    opacity: 0.14,
    roughness: 0.9,
    metalness: 0.02,
  });

  [-460, 0, 460].forEach((x) => {
    const lane = new Mesh(new PlaneGeometry(24, 2200), runwayMat.clone());
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(x, 1.4, 0);
    scene.add(lane);
  });

  const starsGeometry = new BufferGeometry();
  const starsCount = 800;
  const starsPositions = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i += 3) {
    starsPositions[i] = (Math.random() - 0.5) * 4000;
    starsPositions[i + 1] = (Math.random() - 0.5) * 2000 + 400;
    starsPositions[i + 2] = (Math.random() - 0.5) * 4000 - 1200;
  }
  starsGeometry.setAttribute('position', new BufferAttribute(starsPositions, 3));

  const stars = new Points(
    starsGeometry,
    new PointsMaterial({
      color: 0x9cc2ff,
      size: 2,
      transparent: true,
      opacity: 0.72,
    })
  );
  scene.add(stars);

  const cogMarker = new Group();
  const cogSphere = new Mesh(
    new SphereGeometry(15, 32, 16),
    new MeshStandardMaterial({ color: 0xffaa00, emissive: 0x442200 })
  );
  cogMarker.add(cogSphere);

  const ringGeo = new TorusGeometry(25, 1, 16, 64);
  const ringMat = new MeshStandardMaterial({ color: 0xffaa00, emissive: 0x221100 });
  const ring1 = new Mesh(ringGeo, ringMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.rotation.z = 0.3;
  cogMarker.add(ring1);

  const ring2 = ring1.clone();
  ring2.rotation.z = -0.3;
  cogMarker.add(ring2);

  const cogLabelDiv = document.createElement('div');
  cogLabelDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
  cogLabelDiv.style.color = '#ffaa00';
  cogLabelDiv.style.padding = '4px 8px';
  cogLabelDiv.style.borderRadius = '4px';
  cogLabelDiv.style.fontSize = '14px';
  cogLabelDiv.style.fontWeight = 'bold';
  cogLabelDiv.style.border = '1px solid #ffaa00';
  cogLabelDiv.textContent = 'CoG';

  const cogLabel = new CSS2DObject(cogLabelDiv);
  cogLabel.position.set(0, 30, 0);
  cogMarker.add(cogLabel);
  cogMarker.visible = false;
  scene.add(cogMarker);

  function resize() {
    const width = Math.max(1, canvasDiv.clientWidth);
    const height = Math.max(1, canvasDiv.clientHeight);
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render() {
    orbit.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function fitCameraToBox(width, height, depth) {
    const maxDim = Math.max(width, height, depth);
    orbit.target.set(0, height * 0.35, 0);
    camera.position.set(maxDim * 1.15, height * 1.15, maxDim * 1.45);
    camera.lookAt(0, height * 0.35, 0);
    orbit.update();
  }

  return {
    THREE: { MathUtils, Plane, Raycaster, Vector2, Vector3 },
    scene,
    camera,
    renderer,
    labelRenderer,
    orbit,
    transformControl,
    stars,
    cogMarker,
    resize,
    render,
    fitCameraToBox,
  };
} // khởi tạo hệ thống scene 3d, bao gồm camera, renderer, controls, ánh sáng, mặt đất và hiệu ứng sao nền, cũng như một số hàm tiện ích để điều chỉnh kích thước và vị trí camera phù hợp với kích thước container sau này
