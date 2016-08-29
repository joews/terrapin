const THREE = require("three");
const TrackballControls = require('three-trackballcontrols')
// const { Noise } = require("noisejs");
const SimplexNoise = require("simplex-noise");

//
// TODO
// * debug elevation: why no really high mountains?
// * refactor & modularise
// * UI for picking render options (e.g seed, elevation wireframe, biomes, turn components on/off)
// * FPS meter
// * 3d render slices of very large map
// * more variables - wind, erosion?
// * Pin sea to 0!
// * Island
// * Quantize to hex

const width = 512;
const height = width;

let Noise1;
let Noise2;

let scene;
let camera;
let renderer;
let controls;

const wireframeMaterial = new THREE.MeshPhongMaterial({
  // color: 0xdddddd,
  color: 0x333333,
  wireframe: true
});

function randomSeed() {
  // Noise1 = new Noise(Math.random());
  // Noise2 = new Noise(Math.random());

  Noise1 = new SimplexNoise();
  Noise2 = new SimplexNoise();
}

function noise1 (nx, ny) {
  return Noise1.noise2D(nx, ny) / 2 + 0.5;
}

function noise2 (nx, ny) {
  return Noise2.noise2D(nx, ny) / 2 + 0.5;
}

function getElevation(nx, ny) {
  // combine several frequencies for different types of hill
  let e =
      (1.00 * noise1( 1 * nx,  1 * ny)
     + 0.50 * noise1( 2 * nx,  2 * ny)
     + 0.25 * noise1( 4 * nx,  4 * ny)
     + 0.13 * noise1( 8 * nx,  8 * ny)
     + 0.06 * noise1(16 * nx, 16 * ny)
     + 0.03 * noise1(32 * nx, 32 * ny));

  e /= (1.00+0.50+0.25+0.13+0.06+0.03);

  // push small/mid values down to create valleys
  // TODO this is pushing peaks too far down; maybe apply
  //  only below a threshold?
  return Math.pow(e, 2.3);
}

function getMoisture(nx, ny) {
  let m =
    (1.00 * noise2( 1 * nx,  1 * ny)
   + 0.75 * noise2( 2 * nx,  2 * ny)
   + 0.33 * noise2( 4 * nx,  4 * ny)
   + 0.33 * noise2( 8 * nx,  8 * ny)
   + 0.33 * noise2(16 * nx, 16 * ny)
   + 0.50 * noise2(32 * nx, 32 * ny));
  m /= (1.00+0.75+0.33+0.33+0.33+0.50);

  return m
}

function generate() {
  const elevationCanvas = document.getElementById("elevation-canvas");
  const moistureCanvas = document.getElementById("moisture-canvas");
  const biomeCanvas = document.getElementById("biome-canvas");
  const elevation3dCanvas = document.getElementById("elevation-3d-canvas");

  const elevationCtx = elevationCanvas.getContext("2d");
  const moistureCtx = moistureCanvas.getContext("2d");
  const biomeCtx = biomeCanvas.getContext("2d");

  biomeCtx.clearRect(0, 0, width, height);

  const elevationImageData = elevationCtx.createImageData(width, height);
  const moistureImageData = moistureCtx.createImageData(width, height);
  const imageData = biomeCtx.createImageData(width, height);

  const elevationBuffer32 = new Uint32Array(elevationImageData.data.buffer);
  const moistureBuffer32 = new Uint32Array(moistureImageData.data.buffer);
  const buffer32 = new Uint32Array(imageData.data.buffer);

  // 3d elevation
  const geometry = new THREE.PlaneGeometry(width * 4, width * 4, width - 1, height -1);

  let eMin = Infinity;
  let eMax = -Infinity;

  for(let y = 0; y < height; y ++) {
    for (let x = 0; x < width; x ++) {
      const i = y * height + x;

      const nx = x / width - 0.5;
      const ny = y / height - 0.5;

      const elevation = getElevation(nx, ny);
      const moisture = getMoisture(nx, ny);

      if (elevation < eMin) eMin = elevation;
      if (elevation > eMax) eMax = elevation;

      elevationBuffer32[i] = (255 * elevation|0) << 24;
      moistureBuffer32[i] = hex(0x44447a, (255 * moisture | 0));
      buffer32[i] = biome(elevation, moisture);

      geometry.vertices[i].z = elevation * 800;
    }
  }

  console.log("Min/Max elevation", eMin, eMax);

  elevationCtx.putImageData(elevationImageData, 0, 0);
  moistureCtx.putImageData(moistureImageData, 0, 0);
  biomeCtx.putImageData(imageData, 0, 0);

  const biomeTexture = new THREE.Texture(biomeCanvas);
  biomeTexture.needsUpdate = true;
  const biomeMaterial = new THREE.MeshLambertMaterial({
    map: biomeTexture,
    side: THREE.DoubleSide
  });

  // const material = wireframeMaterial;
  const material = biomeMaterial;

  const plane = new THREE.Mesh(geometry, material);

  // Y up!
  plane.rotation.x = Math.PI * 1.5;

  scene.add(plane);
  render3d();
}

// credit Amit Patel
// http://www.redblobgames.com/maps/terrain-from-noise/
function biome(e, m) {
  if (e < 0.1) return OCEAN;
  if (e < 0.12) return BEACH;

  if (e > 0.8) {
    if (m < 0.1) return SCORCHED;
    if (m < 0.2) return BARE;
    if (m < 0.5) return TUNDRA;
    return SNOW;
  }

  if (e > 0.6) {
    if (m < 0.33) return TEMPERATE_DESERT;
    if (m < 0.66) return SHRUBLAND;
    return TAIGA;
  }

  if (e > 0.3) {
    if (m < 0.16) return TEMPERATE_DESERT;
    if (m < 0.50) return GRASSLAND;
    if (m < 0.83) return TEMPERATE_DECIDUOUS_FOREST;
    return TEMPERATE_RAIN_FOREST;
  }

  if (m < 0.16) return SUBTROPICAL_DESERT;
  if (m < 0.33) return GRASSLAND;
  if (m < 0.66) return TROPICAL_SEASONAL_FOREST;
  return TROPICAL_RAIN_FOREST;
}

function rgba(r, g, b, a = 0xFF) {
  return ((a & 0xFF) << 24)
    | ((b & 0xFF) << 16)
    | ((g & 0xFF) << 8)
    | (r & 0xFF);
}

// hex: 24-bit hex color code
function hex(hex, alpha = 0xFF) {
  const r = hex >> 16 & 0xFF;
  const g = hex >> 8 & 0xFF;
  const b = hex & 0xFF;
  return rgba(r, g, b, alpha);
}

// From https://github.com/amitp/mapgen2/blob/master/mapgen2.as
// Credit Amit Patel
const OCEAN = hex(0x44447a);
const COAST = hex(0x33335a);
const LAKESHORE = hex(0x225588);
const LAKE = hex(0x336699);
const RIVER = hex(0x225588);
const MARSH = hex(0x2f6666);
const ICE = hex(0x99ffff);
const BEACH = hex(0xa09077);
const ROAD1 = hex(0x442211);
const ROAD2 = hex(0x553322);
const ROAD3 = hex(0x664433);
const BRIDGE = hex(0x686860);
const LAVA = hex(0xcc3333);
const SNOW = hex(0xffffff);
const TUNDRA = hex(0xbbbbaa);
const BARE = hex(0x888888);
const SCORCHED = hex(0x555555);
const TAIGA = hex(0x99aa77);
const SHRUBLAND = hex(0x889977);
const TEMPERATE_DESERT = hex(0xc9d29b);
const TEMPERATE_RAIN_FOREST = hex(0x448855);
const TEMPERATE_DECIDUOUS_FOREST = hex(0x679459);
const GRASSLAND = hex(0x88aa55);
const SUBTROPICAL_DESERT = hex(0xd2b98b);
const TROPICAL_RAIN_FOREST = hex(0x337755);
const TROPICAL_SEASONAL_FOREST = hex(0x559945);



function initThree() {
  scene = new THREE.Scene();

  const axes = new THREE.AxisHelper(100);
  scene.add(axes);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
  camera.position.set(0, width * 5, width * 5);

  controls = new TrackballControls(camera);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("elevation-3d-canvas")
  });

  renderer.setSize(width, height);
  renderer.setClearColor( 0x333333 );

  const ambientLight = new THREE.AmbientLight(0xE4D2AF, 0.2);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xFFFFFF);
  pointLight.position.set(width * 2, width * 2, width * 2);
  scene.add(pointLight);
}

function init() {
  const canvases = document.querySelectorAll("canvas");
  for (const c of canvases) {
    c.width = width;
    c.height = height;
  }

  initThree();

  randomSeed();
  generate();
}

function render3d() {
  controls.update();
  requestAnimationFrame(render3d);
  renderer.render(scene, camera);
}

init();
