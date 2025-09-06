import * as THREE from "three";
import Stats from "stats.js";
import { Earth } from "./objects/Earth";
import { Sun } from "./objects/Sun";
import { Moon } from "./objects/Moon";
import { createScene } from "./visualization/scene";
import { createControls } from "./visualization/controls";
import { createSkybox } from "./visualization/skybox";
import { TimeController } from "./physics/TimeController";
import { GuiManager } from "./ui/GuiManager";
import { GravityEngine } from "./physics/GravityEngine";
import { G } from "./physics/constants";
import { Barycenter } from "./physics/Barycenter";
import { createBloomPipeline } from "./visualization/bloom";
import { Spacecraft } from "./objects/Spacecraft";
import { SpacecraftPropagatorRK4 } from "./physics/SpacecraftPropagatorRK4";
import { SpacecraftGUI } from "./ui/SpacecraftGUI";
import { HohmannTransfer } from "./physics/HohmannTransfer";

const { scene, camera, renderer } = createScene();
const controls = createControls(camera, renderer);

//-------------------------------------------------------------------------------------------------------------
const stats = new Stats();
stats.dom.style.position = "absolute";
stats.dom.style.top = "690px";
document.body.appendChild(stats.dom);

const bloomRenderer = createBloomPipeline(renderer, scene, camera, {
  strength: 2.0,
  radius: 0.5,
  threshold: 0.0
});

//-------------------------------------------------------------------------------------------------------------
const overlay = document.getElementById("loader-overlay") as HTMLElement | null;
const progressBar = document.getElementById("loader-progress-bar") as HTMLElement | null;
const loaderText = document.getElementById("loader-text") as HTMLElement | null;

let started = false;

function setLoaderProgress(percent: number, text?: string) {
  const clamped = Math.max(0, Math.min(100, percent));
  if (progressBar) progressBar.style.width = `${clamped}%`;
  if (loaderText && text) loaderText.textContent = text;
  // update aria if present
  const progressWrap = document.getElementById("loader-progress");
  if (progressWrap) {
    progressWrap.setAttribute("aria-valuenow", `${Math.round(clamped)}`);
    if (text) progressWrap.setAttribute("aria-label", text);
  }
}

function hideLoaderOverlay() {
  if (!overlay) return;
  overlay.classList.add("hidden");
  // remove from DOM after fade
  setTimeout(() => {
    overlay.remove();
  }, 700);
}

//-------------------------------------------------------------------------------------------------------------
function createLoadingManager(): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();

  manager.onStart = (_url?: string, _itemsLoaded?: number, _itemsTotal?: number) => {
    setLoaderProgress(1, "Starting load…");
  };

  // signature: (url, itemsLoaded, itemsTotal)
  manager.onProgress = (_url: string, itemsLoaded: number, itemsTotal: number) => {
    console.log(itemsLoaded);
    const percent = itemsTotal > 0 ? (itemsLoaded / itemsTotal) * 100 : 100;
    setLoaderProgress(percent, `Loading assets ${Math.round(percent)}%`);
  };

  manager.onError = (url: string) => {
    console.warn("LoadingManager error:", url);
    // show an error but continue
    setLoaderProgress(100, "Error loading some assets — continuing.");
  };

  manager.onLoad = async () => {
    try {
      setLoaderProgress(100, "Finalizing…");
      // nice pause so the 100% bar reaches visually
      await new Promise((r) => setTimeout(r, 150));

      // render a few frames to precompile shaders
      await warmupShaders(renderer, scene, camera, 3);

      // if sim hasn't been started by Skip, start now
      if (!started) {
        hideLoaderOverlay();
        started = true;
        animate();
      } else {
        // user already pressed skip; simply hide overlay
        hideLoaderOverlay();
      }
    } catch (err) {
      console.error("Manager onLoad error:", err);
      hideLoaderOverlay();
      if (!started) { started = true; animate(); }
    }
  };

  return manager;
}

async function warmupShaders(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frames = 2) {
  try {
    for (let i = 0; i < frames; i++) {
      renderer.render(scene, camera);
      // small yield for mobile GPUs
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 40));
    }
  } catch (err) {
    // don't fail startup if warmup has issues
    console.warn("warmupShaders error:", err);
  }
}

const manager = createLoadingManager();


//-------------------------------------------------------------------------------------------------------------
const earth = new Earth();
scene.add(earth.group);

const moon = new Moon();
scene.add(moon.group);
scene.add(moon.trail.object3d);

const mEarth = earth.mass;
const mMoon = moon.mass;
const r = 384_400_000;

const earthPos = new THREE.Vector3(- (mMoon / (mEarth + mMoon)) * r, 0, 0);
const moonPos = new THREE.Vector3( (mEarth / (mEarth + mMoon)) * r, 0, 0);

const vMoon = Math.sqrt(G * mEarth / r);
const earthVel = new THREE.Vector3(0, 0, -vMoon * (mMoon / mEarth));
const moonVel = new THREE.Vector3(0, 0, vMoon);

earth.setInitialState(earthPos, earthVel);
moon.setInitialState(moonPos, moonVel);

const gravityEngine = new GravityEngine([earth, moon], 1e3);

const sun = new Sun();
scene.add(sun.group);

const spacecraft = new Spacecraft({}, manager); 
scene.add(spacecraft.group);
scene.add(spacecraft.trail.object3d);

const r0 = earth.radius + 300_000;
const muEarth = G * earth.mass;
const vCirc = Math.sqrt(muEarth / r0);

const rVec = earth.r_m.clone().add(new THREE.Vector3(r0, 0, 0));
const vVec = earth.v_mps.clone().add(new THREE.Vector3(0, 0, vCirc));
spacecraft.setInitialState(rVec, vVec);

const scProp = new SpacecraftPropagatorRK4({ craft: spacecraft, primaries: [earth, moon], eps: 0, atmosphere: earth.atmosphere });

const skyboxTexture = createSkybox(`${import.meta.env.BASE_URL}textures/skybox/`, manager);
scene.background = skyboxTexture;

const time = new TimeController(10);
let last = performance.now();

const bary = new Barycenter(earth, moon);
scene.add(bary.marker);

const hohmannTransfer = new HohmannTransfer(earth, moon, spacecraft);

const gui = new GuiManager(earth, moon, sun, time, bary, controls, camera, spacecraft);
const spacecraftUI = new SpacecraftGUI(spacecraft, earth.atmosphere, earth, hohmannTransfer);

//-------------------------------------------------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  stats.begin();

  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;

  dt = time.apply(dt);

  gravityEngine.stepWithSubsteps(dt, 60);

  earth.update(dt);
  moon.update(dt);

  bary.update();

  scProp.stepWithSubsteps(dt, 30);
  spacecraft.update(dt);
  hohmannTransfer.update(dt);

  gui.updateAll();
  spacecraftUI.update();

  bloomRenderer.render();

  controls.update();
  stats.end();
}

//-------------------------------------------------------------------------------------------------------------
function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", handleWindowResize, false);
