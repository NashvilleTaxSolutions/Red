import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './knight-preview.css';

const canvas = document.querySelector<HTMLCanvasElement>('#knight-canvas');
const status = document.querySelector<HTMLElement>('#model-status');
const stats = document.querySelector<HTMLElement>('#model-stats');
const caption = document.querySelector<HTMLElement>('#view-caption');
if (!canvas || !status || !stats || !caption) throw new Error('Knight studio page is missing required elements.');
const modelStats = stats;
const viewCaption = caption;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101619);
scene.fog = new THREE.Fog(0x101619, 12, 24);

const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
camera.position.set(0, 1.25, 5.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 1.4;
controls.maxDistance = 8;
controls.target.set(0, 1.02, 0);

scene.add(new THREE.HemisphereLight(0xb8c9d1, 0x221b18, 1.55));
const key = new THREE.DirectionalLight(0xffe6c8, 3.2);
key.position.set(-3.8, 5.5, 4.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -3.4;
key.shadow.camera.right = 3.4;
key.shadow.camera.top = 4.2;
key.shadow.camera.bottom = -0.5;
key.shadow.bias = -0.00015;
key.shadow.normalBias = 0.025;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9eb7c6, 1.15);
fill.position.set(4.5, 3.2, 1.5);
scene.add(fill);
const rim = new THREE.DirectionalLight(0x8097a4, 2.6);
rim.position.set(-1.5, 3.8, -4.5);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5, 96),
  new THREE.MeshStandardMaterial({ color: 0x252a29, roughness: 0.91, metalness: 0.08 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.025;
floor.receiveShadow = true;
scene.add(floor);

const modelRoot = new THREE.Group();
scene.add(modelRoot);
let model: THREE.Object3D | null = null;
let cameraDestination = new THREE.Vector3(0, 1.25, 5.2);
let targetDestination = new THREE.Vector3(0, 1.02, 0);

const views = {
  front: { label: 'FRONT ELEVATION', position: new THREE.Vector3(0, 1.2, 5.2), target: new THREE.Vector3(0, 1.02, 0) },
  side: { label: 'RIGHT PROFILE', position: new THREE.Vector3(5.2, 1.2, 0), target: new THREE.Vector3(0, 1.02, 0) },
  rear: { label: 'REAR ARMOR', position: new THREE.Vector3(0, 1.2, -5.2), target: new THREE.Vector3(0, 1.02, 0) },
  detail: { label: 'HELMET & CUIRASS DETAIL', position: new THREE.Vector3(1.45, 1.68, 3.25), target: new THREE.Vector3(0, 1.48, 0.02) },
} as const;

function showView(name: keyof typeof views): void {
  const view = views[name];
  cameraDestination = view.position.clone();
  targetDestination = view.target.clone();
  viewCaption.textContent = view.label;
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view as keyof typeof views | undefined;
    if (view && view in views) showView(view);
  });
});

function addStat(label: string, value: string): void {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  modelStats.append(term, description);
}

const loader = new GLTFLoader();
const modelUrl = new URL('./assets/characters/preview/nordic-knight.glb', document.baseURI).href;
loader.load(modelUrl, (gltf) => {
  model = gltf.scene;
  modelRoot.add(model);
  let meshCount = 0;
  let skinnedCount = 0;
  let triangles = 0;
  const bones = new Set<THREE.Bone>();
  const materials = new Set<THREE.Material>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshCount++;
    if (object instanceof THREE.SkinnedMesh) {
      skinnedCount++;
      object.skeleton.bones.forEach((bone) => bones.add(bone));
    }
    const geometry = object.geometry;
    triangles += Math.floor((geometry.index?.count ?? geometry.getAttribute('position').count) / 3);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      material.needsUpdate = true;
    }
    object.castShadow = true;
    object.receiveShadow = true;
  });
  model.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const textureCount = new Set<THREE.Texture>();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textureCount.add(value);
    }
  }
  addStat('HEIGHT', `${size.y.toFixed(2)} m`);
  addStat('GEOMETRY', `${triangles.toLocaleString()} triangles · ${meshCount} parts`);
  addStat('RIG', `${bones.size} bones · rigidly weighted armor`);
  addStat('MATERIALS', `${materials.size} PBR surfaces`);
  addStat('TEXTURES', `${textureCount.size} embedded maps`);
  addStat('ANIMATION', gltf.animations.length ? `${gltf.animations.length} clips` : 'Static bind pose');
  status.dataset.state = 'ready';
  status.textContent = 'EXPORTED GLB LOADED';
}, undefined, (error) => {
  console.error('Nordic knight GLB failed to load.', error);
  status.dataset.state = 'error';
  status.textContent = 'MODEL LOAD FAILED · CHECK CONSOLE';
});

function resize(): void {
  const width = Math.max(1, canvas!.clientWidth);
  const height = Math.max(1, canvas!.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  camera.position.lerp(cameraDestination, 1 - Math.exp(-5 * delta));
  controls.target.lerp(targetDestination, 1 - Math.exp(-5 * delta));
  controls.update();
  renderer.render(scene, camera);
});
window.addEventListener('resize', resize);
resize();