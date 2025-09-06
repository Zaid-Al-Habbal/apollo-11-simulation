import GUI from "lil-gui";
import * as THREE from "three";
import { Earth } from "../objects/Earth";
import { Moon } from "../objects/Moon";
import { Sun } from "../objects/Sun";
import { TimeController } from "../physics/TimeController";
import { EarthControls } from "./EarthControls";
import { MoonControls } from "./MoonControls";
import { SunControls } from "./SunControls";
import { TimeControls } from "./TimeControls";
import { EarthMoonControls } from "./EarthMoonControls";
import type { Barycenter } from "../physics/Barycenter";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CameraControls } from "./CameraControlts";
import type { Spacecraft } from "../objects/Spacecraft";


export class GuiManager {
  public gui: GUI;
  public timeUI: TimeControls;
  public earthUI: EarthControls;
  public moonUI: MoonControls;
  public sunUI: SunControls;
  public earthMoonUI: EarthMoonControls;
  public cameraUI: CameraControls;

  constructor(earth: Earth, moon: Moon, sun: Sun, time: TimeController, bary: Barycenter, controls: OrbitControls, camera: THREE.PerspectiveCamera, spacecraft: Spacecraft) {
    this.gui = new GUI({
      width: 400,
      title: "Simulation Controls",
    });
    const dom = this.gui.domElement;
    dom.style.position = "absolute";
    dom.style.left = "1025px";
    dom.style.top = "10px";
    Object.assign(this.gui.domElement.style, {
      backgroundColor: "rgba(10, 20, 30, 0.95)", // deep dark blue
      border: "1px solid #00ffcc",
      borderRadius: "8px",
      fontFamily: "monospace",
      fontSize: "13px",
      boxShadow: "0 0 15px rgba(0, 255, 204, 0.4)",
    });

    this.timeUI = new TimeControls(this.gui, time);
    this.timeUI.folder.close()

    const targets = {
      Earth: earth.group,
      Moon: moon.group,
      Spacecraft: spacecraft.group
    };
    
    this.cameraUI = new CameraControls({
      camera: camera,
      gui: this.gui,
      controls: controls,
      targets: targets,
      getVelocity: spacecraft.v_mps.clone()
    })
    this.cameraUI.folder.close()

    this.earthUI = new EarthControls(this.gui, earth);
    this.earthUI.folder.close()

    this.moonUI = new MoonControls(this.gui, moon);
    this.moonUI.folder.close()

    this.earthMoonUI = new EarthMoonControls(this.gui, earth, moon, bary);
    this.earthMoonUI.folder.close()

    this.sunUI = new SunControls(this.gui, sun);
    this.sunUI.folder.close()

    this.gui.add({ resetAll: () => this.resetAll() }, "resetAll").name("Reset All");

    this.gui.close();
  }

  public resetAll() {
    this.timeUI.reset();
    this.earthUI.reset();
    this.moonUI.reset();
    this.sunUI.reset();
  }

  public updateAll() {
    this.earthUI.update();
    this.moonUI.update();
    this.earthMoonUI.update();
    this.cameraUI.update();
  }
}
