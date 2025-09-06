import * as THREE from "three";
import { Atmosphere } from "./Atmosphere";
import { CelestialBody } from "./CelestialBody";

export class Earth extends CelestialBody {

  public atmosphere: Atmosphere;

  constructor(loaderManager?: THREE.LoadingManager) {
    super({
      name: "Earth",
      mass: 5.972e24,                     // kg
      radius: 6_371_000,                  // m
      baseRadius: 6_371_000,              // m
      rotationPeriod: 23.93,       // s
      totalRotationPeriod: 23.93 * 3600,  // s
      orbitPeriod: 365.25 * 24 * 3600,    // s
      axialTilt: 23.4,                    // degrees
      scalePerUnit: 1_000_000,                   // 1 unit = 1000 km
      textureMap: `${import.meta.env.BASE_URL}textures/earth/8k_earth_daymap.jpg`,
      specularMap: `${import.meta.env.BASE_URL}textures/earth/8k_earth_specular_map.jpg`,
      cloudsMap: `${import.meta.env.BASE_URL}textures/earth/8k_earth_clouds.jpg`,
    }, loaderManager);
    this.atmosphere = new Atmosphere({geometry: this.geometry});
    this.group.add(this.atmosphere.mesh);
  }
  
  
}
