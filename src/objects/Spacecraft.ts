import * as THREE from "three";
import { OrbitTrail } from "../visualization/OrbitTrail";
import { g0 } from "../physics/constants";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BurnEffect } from "../visualization/BurnEffect";


export interface SpacecraftProps {
  scalePerUnit?: number;
  dryMass?: number;
  fuelMass?: number;
  radius?: number;
  color?: number | string;
}

export type ThrustMode = "prograde" | "retrograde" | "radial_out" | "radial_in" | "normal_plus" | "normal_minus" | "custom";

export class Spacecraft {
  public group: THREE.Group;
  // public mesh: THREE.Mesh;
  public trail: OrbitTrail;
  

  public dryMass: number;    // kg (structure + payload)
  public fuelMass: number;   // kg (remaining propellant)
  public radius: number;     // meters (visual/scalar reference)
  public baseRadius: number;
  public scalePerUnit: number;

  // Physics state (SI)
  public r_m = new THREE.Vector3();    // position (m)
  public v_mps = new THREE.Vector3();  // velocity (m/s)
  public a_mps2 = new THREE.Vector3(); // acceleration (m/s^2) – for display


  //engine:
  public isp_s: number;       // specific impulse (s)
  public T_max_N: number;      // maximum engine thrust (N)
  public throttle: number;     // 0..1
  public engineOn: boolean;
  public thrustDirection_world: THREE.Vector3 | null; // unit vector; null = use velocity direction (prograde)
  public thrustMode: ThrustMode = "prograde";

  // Burn visual effect state
  public burnTimeRemaining: number = 0; // seconds
  public burnActive: boolean = false;
  private burnTotalDuration: number = 0;
  private burnTimeAccumulator: number = 0;

  private burn: BurnEffect;

  constructor(props: SpacecraftProps, loaderManager?: THREE.LoadingManager) {
    this.scalePerUnit = 1_000_000;
    this.dryMass = props.dryMass ?? 13_000; // kg
    this.fuelMass = props.fuelMass ?? 120_000; // kg
    this.radius = props.radius ?? 10000; // meters (visual)
    this.baseRadius = this.radius;
    // const scaledRadius = this.radius / this.scalePerUnit;

    this.group = new THREE.Group();

    const loader = new GLTFLoader(loaderManager);

    loader.load(
      `${import.meta.env.BASE_URL}models/saturn-v-3rd-stage.glb`, // path to your model
      (craft) => {
        this.group.add(craft.scene);
        craft.scene.position.set(0, 0, 0);
        craft.scene.rotateX(-30);
        craft.scene.scale.set(0.001, 0.001, 0.001); // adjust scale if too big/small
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.error("Error loading model:", error);
      }
    );

    this.trail = new OrbitTrail(0x00ffcc, 50, 5000, 0.01);

    this.isp_s = 320;         // e.g., ~320 s (placeholder)
    this.T_max_N = 1_000_000; // default 0 (engines off). Set to a real value when you add engines.
    this.throttle = 0;
    this.engineOn = false;
    this.thrustDirection_world = null; // if null use prograde (v) as default when engineOn

    // this.createBurnMesh();

    const coneHeight = this.radius * 0.03 || 100; // fallback size
    const coneRadius = 0.000000000001;
    this.burn = new BurnEffect({ coneLengthKm: coneHeight, coneRadiusKm: coneRadius, particleCount: 0.02 });
    this.group.add(this.burn.group);

  }

  setRadius(newRadius: number) {
    // const scaleFactor = newRadius / this.baseRadius;
    this.radius = newRadius;
    // this.group.scale.setScalar(scaleFactor);
  }

  /** wet mass: dry + fuel */
  public get mass(): number {
    return this.dryMass + this.fuelMass;
  }

  setInitialState(positionMeters: THREE.Vector3, velocityMps: THREE.Vector3) {
    this.r_m.copy(positionMeters);
    this.v_mps.copy(velocityMps);
    this.syncVisualFromPhysics();
  }

  syncVisualFromPhysics() {
    const inv = 1 / this.scalePerUnit;
    this.group.position.set(this.r_m.x * inv, this.r_m.y * inv, this.r_m.z * inv);

    // Simple “point in velocity direction” visual
    if (this.v_mps.lengthSq() > 1e-6) {
      const fwd = this.v_mps.clone().normalize();
      this.group.lookAt(this.group.position.clone().add(fwd));
    }
  }

  update(dt: number) {
    const inv = 1 / 1_000_000;
    this.trail.addPoint(
      new THREE.Vector3(
        this.r_m.x * inv,
        this.r_m.y * inv,
        this.r_m.z * inv
      )
    ); 

    // dt = physics dt in seconds
    const throttle = this.throttle; // 0..1
    const engineOn = this.engineOn;
    this.burn.update(throttle, engineOn, (km) => { return (km*1000)/this.scalePerUnit}); // provide conversion
    this.updateBurnEffect(dt);
  }
  
  // --- Impulsive Δv helper (world-frame) ---
  /**
   * Apply an instantaneous delta-v in WORLD coordinates.
   * Reduces fuel using the rocket equation. If fuel is limited,
   * it applies the largest dv the remaining propellant affords.
   */
  public applyDeltaV(dvWorld: THREE.Vector3, IspOverride?: number) {
    const dv = dvWorld.length();
    if (dv <= 0) return;

    const Isp = IspOverride ?? this.isp_s;
    const m0 = this.mass;
    if (m0 <= 0 || this.fuelMass <= 0) return;

    // Fuel needed for the requested dv
    // dm = m0 - m1, where dv = Isp*g0*ln(m0/m1)
    const dmNeeded = m0 - m0 / Math.exp(dv / (Isp * g0));

    // Cap by available fuel
    const dm = Math.min(this.fuelMass, dmNeeded);
    if (dm <= 0) return;

    // Effective dv if fuel limited
    const dvEff = Isp * g0 * Math.log(m0 / (m0 - dm));

    const dir = dvWorld.clone().normalize();
    this.v_mps.addScaledVector(dir, dvEff);
    this.fuelMass -= dm; // burn the propellant

    this.engineOn = true;
    this.startBurnEffect(1000); // 1000 s as requested
  }

  // --- Impulse Burn Helpers ---

  /** Burn prograde by Δv (m/s) */
  public burnPrograde(dv: number) {
    if (this.v_mps.lengthSq() < 1e-9) return; // avoid NaN if stationary
    const dir = this.v_mps.clone().normalize();
    this.applyDeltaV(dir.multiplyScalar(dv));
  }

  /** Burn retrograde by Δv (m/s) */
  public burnRetrograde(dv: number) {
    if (this.v_mps.lengthSq() < 1e-9) return;
    const dir = this.v_mps.clone().normalize().negate();
    this.applyDeltaV(dir.multiplyScalar(dv));
  }

  /** Burn radial-out (away from Earth center) */
  public burnRadialOut(dv: number, earthPos: THREE.Vector3) {
    const dir = this.r_m.clone().sub(earthPos).normalize();
    this.applyDeltaV(dir.multiplyScalar(dv));
  }

  /** Burn radial-in (toward Earth center) */
  public burnRadialIn(dv: number, earthPos: THREE.Vector3) {
    const dir = earthPos.clone().sub(this.r_m).normalize();
    this.applyDeltaV(dir.multiplyScalar(dv));
  }

  /** Burn normal (out of orbital plane) */
  public burnNormal(dv: number) {
    // normal = r × v (angular momentum direction)
    const h = new THREE.Vector3().crossVectors(this.r_m, this.v_mps).normalize();
    this.applyDeltaV(h.multiplyScalar(dv));
  }

  /** Burn anti-normal (opposite orbital plane) */
  public burnAntiNormal(dv: number) {
    const h = new THREE.Vector3().crossVectors(this.r_m, this.v_mps).normalize().negate();
    this.applyDeltaV(h.multiplyScalar(dv));
  }


  // call to compute thrust vector in world frame
  public getThrustVectorWorld(): THREE.Vector3 {
    if (!this.engineOn || this.throttle <= 0 || this.T_max_N <= 0) return new THREE.Vector3();
    const T = this.T_max_N * this.throttle;

    let dir = new THREE.Vector3();

    switch (this.thrustMode) {
      case "prograde":
        dir.copy(this.v_mps).normalize();
        break;
      case "retrograde":
        dir.copy(this.v_mps).normalize().multiplyScalar(-1);
        break;
      case "radial_out":
        dir.copy(this.r_m).normalize();
        break;
      case "radial_in":
        dir.copy(this.r_m).normalize().multiplyScalar(-1);
        break;
      case "normal_plus":
        dir.crossVectors(this.r_m, this.v_mps).normalize(); // orbital plane normal
        break;
      case "normal_minus":
        dir.crossVectors(this.r_m, this.v_mps).normalize().multiplyScalar(-1); // orbital plane normal
        break;
      case "custom":
        if (this.thrustDirection_world) dir.copy(this.thrustDirection_world).normalize();
        else dir.copy(this.v_mps).normalize(); // fallback
        break;
    }

    return dir.multiplyScalar(T);
  }


  // helper: mass flow rate given current throttle
  public massFlowRate(): number {
    if (!this.engineOn || this.throttle <= 0 || this.isp_s <= 0) return 0;
    const T = this.T_max_N * this.throttle;
    return -T / (this.isp_s * g0); // dm/dt (negative)
  }

  // ------------------- Burn visual effect -------------------

  /** Start burn visual for duration seconds (will restart if already active) */
  public startBurnEffect(duration: number) {
    if (!this.burn) return;
    this.burnTotalDuration = Math.max(0.001, duration);
    this.burnTimeRemaining = this.burnTotalDuration;
    this.burnTimeAccumulator = 0;
    this.burnActive = true;
    this.burn.group.visible = true;
  }

  /** Stop burn effect immediately (hide) */
  public stopBurnEffect() {
    if (!this.burn) return;
    this.burnActive = false;
    this.burnTimeRemaining = 0;
    this.burn.group.visible = false;
    this.burnTimeAccumulator = 0;
    this.engineOn = false;
  }

  /** Called every frame to update shader uniforms and countdown timers */
  private updateBurnEffect(dt: number) {
    if (!this.burn.group.visible) return;

    this.burnTimeAccumulator += dt;
    this.burnTimeRemaining = Math.max(0, this.burnTotalDuration - this.burnTimeAccumulator);

    // when effect finished -> hide & clear
    if (this.burnTimeRemaining <= 0) {
      this.stopBurnEffect();
    }
  }


}
