import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function createSceneSystem(canvasDiv) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07111f);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 20000);
  camera.position.set(900, 600, 1200);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
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

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(800, 1800, 1000);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  const fillLight = new THREE.PointLight(0x88aaff, 1.0);
  fillLight.position.set(-1200, 800, -800);
  scene.add(fillLight);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20000, 20000),
    new THREE.MeshStandardMaterial({
      color: 0x0f1d35,
      roughness: 0.85,
      metalness: 0.05,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.GridHelper(4000, 80, 0x2dd4bf, 0x243b53));

  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = 800;
  const starsPositions = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i += 3) {
    starsPositions[i] = (Math.random() - 0.5) * 4000;
    starsPositions[i + 1] = (Math.random() - 0.5) * 2000 + 400;
    starsPositions[i + 2] = (Math.random() - 0.5) * 4000 - 1200;
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));

  const stars = new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({
      color: 0x9cc2ff,
      size: 2,
      transparent: true,
      opacity: 0.8,
    })
  );
  scene.add(stars);

  const cogMarker = new THREE.Group();
  const cogSphere = new THREE.Mesh(
    new THREE.SphereGeometry(15, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x442200 })
  );
  cogMarker.add(cogSphere);

  const ringGeo = new THREE.TorusGeometry(25, 1, 16, 64);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x221100 });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
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
    THREE,
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