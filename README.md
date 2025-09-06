# Apollo 11 Simulation

A physics-based **3D orbital mechanics simulator** built with **Three.js** and **TypeScript**, simulating the Apollo 11 spacecraft’s **Trans-Lunar Injection (TLI)** and subsequent maneuvers to reach **Low Lunar Orbit (LLO)**.

This project blends **astrodynamics**, **numerical integration methods**, and **visualization** into a single simulation of one of humanity’s most iconic journeys: *from Earth to the Moon*.

Live at https://zaid-al-habbal.github.io/apollo-11-simulation/

---

## Features

- **Realistic orbital mechanics** using Newtonian gravitation.
- **Numerical integration algorithms**:
  - 4th-order **Runge–Kutta (RK4)** for spacecraft dynamics.
  - **Velocity Verlet** for long-term Earth–Moon orbital stability.
- **Hohmann-like transfer phases**:
  - Trans-Lunar Injection (TLI).
  - Lunar Orbit Insertion (LOI-1 and LOI-2).
  - Circularization to Low Lunar Orbit (LLO).
- **Δv calculations** at each burn step.
- Interactive **3D visualization** (Earth, Moon, spacecraft, orbital trails).
- Cinematic effects:
  - Chase camera views.
  - Engine burn effects with shader-based flames.
  - Velocity-lock mode, camera shakes during burns.

---
## 🔧 Instructions for Running the Project Locally

### 1. Clone the repository
```bash
git clone https://github.com/Zaid-Al-Habbal/apollo-11-simulation
cd apollo-11-simulation
```

### 2. Install Node.js on your system

### 3. Install dependencies
```bash
npm install
```
### 4. Run development Server
```bash
npm run dev
```
Open browser at http://localhost:5173

---

## 📖 Background

### 🌑 Apollo 11 & TLI
In July 1969, Apollo 11 executed a **Trans-Lunar Injection (TLI)** — a single long-duration burn of the S-IVB third stage — to escape Earth orbit and head toward the Moon. After coasting through cislunar space, the spacecraft performed lunar orbit insertion burns to be captured into **Low Lunar Orbit (LLO)**.

Our simulation mirrors this mission, using simplified but physically faithful models.

---

## ⚙️ Physics & Algorithms

### 🧮 Governing Equations

The spacecraft motion is governed by **Newton’s 2-body problem with perturbations**:

$$
\dot{r} = v
$$
$$
\dot{v} = a(r, v, t)
$$

Where:
- **r** = position vector.
- **v** = velocity vector.
- **a** = acceleration due to gravity, thrust, and drag (if applicable).

---

### 🔹 Runge–Kutta 4 (RK4) – Spacecraft

RK4 provides **high-accuracy integration** for the spacecraft state (position, velocity, mass).  
At each step, we compute:

$$
k_1 = f(t, y)
$$
$$
k_2 = f(t + h/2, y + h/2 \cdot k_1)
$$
$$
k_3 = f(t + h/2, y + h/2 \cdot k_2)
$$
$$
k_4 = f(t + h, y + h \cdot k_3)
$$

Then update:

$$
y_{n+1} = y_n + \frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)
$$

Where **y = (r, v, m)** includes position, velocity, and mass.  
This captures **engine thrust** and **fuel depletion** dynamics accurately during burns.

---

### 🔹 Velocity Verlet – Earth & Moon

For long-term integration of **Earth–Moon orbital dynamics**, we use **Velocity Verlet**:

$$
r(t+h) = r(t) + v(t)h + \frac{1}{2}a(t)h^2
$$

$$
v(t+h) = v(t) + \frac{1}{2}[a(t) + a(t+h)]h
$$

This method is **symplectic**, ensuring **energy stability** over long periods — ideal for planetary motion.

---

## 🚀 Phases of the Journey

1. **Launch & Parking Orbit**  
   - Start in Low Earth Orbit (LEO).

2. **Phase 1 – Trans-Lunar Injection (TLI)**  
   - Burn **prograde** to raise apogee to lunar distance.  
   - Δv₁ ≈ 3.2 km/s.

3. **Phase 2 – Lunar Approach**  
   - Coast along transfer ellipse.  
   - Align with the Moon’s motion.

4. **Phase 3 – Lunar Orbit Insertion (LOI-1)**  
   - Retrograde burn at perilune.  
   - Capture into **elliptical lunar orbit**.

5. **Phase 4 – Apolune Adjustment (LOI-2)**  
   - Burn at apolune to lower perilune altitude.  
   - Shape orbit toward desired LLO.

6. **Phase 5 – Circularization**  
   - Final retrograde burn at perilune.  
   - Achieve **Low Lunar Orbit (~100 km altitude)**.

7. **Mission Complete!**

---

## 🎨 Visualization

- **3D Earth & Moon** with textures.
- **Spacecraft model (Saturn V 3rd stage)** with orbit trail.
- **Shader-based flame effects** for burns.
- **Bloom & glow effects** for cinematic realism.
- **Multiple camera modes**:
  - Top-down orbital view.
  - Moon-centric view.
  - Chase camera (follows spacecraft).

---

## 🛠️ Tech Stack

- [Three.js](https://threejs.org/) – 3D rendering.
- [TypeScript](https://www.typescriptlang.org/) – Strong typing.
- [Vite](https://vitejs.dev/) – Fast bundler.
- [Lil-GUI](https://lil-gui.georgealways.com/) – Parameter controls.
- [Stats.js](https://github.com/mrdoob/stats.js) - Performance Monitor.

---

## 👨‍💻 Contributors

- **Zaid Al Habbal** – ([GitHub](https://github.com/Zaid-Al-Habbal))  
- **Ahmad Selo** - ([GitHub](https://github.com/C0ncatS))

---



## 🙏 Credits
- **Rami Sabbagh** - Project Supervisor ([GitHub](https://github.com/Rami-Sabbagh/))
- Saturn V 3D model(I removed the first and second stages) from: https://sketchfab.com/3d-models/saturn-v-nasa-7a2c9709ff8144c8b3b18ec84b5e112e
- Textures from this great website: https://www.solarsystemscope.com/textures/
- Thanks to Bobby Roe for helping me with the visualizations:  https://github.com/bobbyroe

---

## 📜 License

MIT License – Free for learning, teaching, and exploration.

---
