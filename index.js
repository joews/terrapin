const THREE = require("three");
const TrackballControls = require('three-trackballcontrols')
const { Noise } = require("noisejs");

const width = 400;
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
  Noise1 = new Noise(Math.random());
  Noise2 = new Noise(Math.random());
}

function noise1 (nx, ny) {
  return Noise1.simplex2(nx, ny) / 2 + 0.5;
}

function noise2 (nx, ny) {
  return Noise2.simplex2(nx, ny) / 2 + 0.5;
}

function getElevation(nx, ny) {
   // combine several frequencies for different types of hill
  e = 1 * noise1(1 * nx, 1 * ny)
   + 0.5 * noise1(2 * nx, 2 * ny)
   + 0.25 * noise1(4 * nx, 4 * ny);

   e /= (1 + 0.5 + 0.25);

   // push small/mid values down to create valleys
   return Math.pow(e, 2.5);
}

function getMoisture(nx, ny) {
   // combine several frequencies
   m = 1 * noise2(1 * nx, 1 * ny)
   + 0.5 * noise2(2 * nx, 2 * ny)
   + 0.25 * noise2(4 * nx, 4 * ny);

   m /= (1 + 0.5 + 0.25);

   // push small/mid values down to create valleys
   return Math.pow(m, 2.5);
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

  for(let y = 0; y < height; y ++) {
    for (let x = 0; x < width; x ++) {
      const i = y * height + x;

      const nx = x / width - 0.5;
      const ny = y / height - 0.5;

      const elevation = getElevation(nx, ny);
      const moisture = getMoisture(nx, ny);

      elevationBuffer32[i] = (255 * elevation|0) << 24;
      moistureBuffer32[i] = (255 * moisture|0) << 24;
      buffer32[i] = biome(elevation, moisture);

      geometry.vertices[i].z = elevation * 800;
    }
  }

  elevationCtx.putImageData(elevationImageData, 0, 0);
  moistureCtx.putImageData(moistureImageData, 0, 0);
  biomeCtx.putImageData(imageData, 0, 0);

  const biomeTexture = new THREE.Texture(biomeCanvas);
  biomeTexture.needsUpdate = true;
  const biomeMaterial = new THREE.MeshLambertMaterial({
    map: biomeTexture
  });

  // const material = wireframeMaterial;
  const material = biomeMaterial;

  const plane = new THREE.Mesh(geometry, material);

  // Y up!
  plane.rotation.x = Math.PI * 1.5;

  scene.add(plane);
  render3d();
}

// TODO more biomes, use moisture
function biome(e, m) {
  if (e < 0.05) return WATER;
  else return LAND;
}

function color(r, g, b, a = 0xFF) {
  return ((a & 0xFF) << 24)
    | ((b & 0xFF) << 16)
    | ((g & 0xFF) << 8)
    | (r & 0xFF);
}

// Biomes as 32bit rgba integers
const WATER = color(75, 75, 127);
const LAND = color(100, 150, 85);

function initThree() {
  scene = new THREE.Scene();

  const axes = new THREE.AxisHelper(100);
  scene.add(axes);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
  camera.position.set(0, width * 4, width * 4);

  controls = new TrackballControls(camera);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("elevation-3d-canvas")
  });

  renderer.setSize(width, height);
  renderer.setClearColor( 0xeeeeee );

  const ambientLight = new THREE.AmbientLight(0xE4D2AF, 0.3);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xFFFFFF);
  pointLight.position.set(width * 4, width * 4, width * 4);
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
