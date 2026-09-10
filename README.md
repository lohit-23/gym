<div align="center">

# 💪 CYBERCURL AI
### Real-Time Vision Dumbbell Bicep Curl Tracker & Form Analyzer

[![Live Demo](https://img.shields.io/badge/Live%20Demo-lohitgym.netlify.app-00f59b?style=for-the-badge&logo=netlify&logoColor=black)](https://lohitgym.netlify.app/)
[![MediaPipe Pose](https://img.shields.io/badge/MediaPipe-Pose%20Estimation-00f2fe?style=for-the-badge&logo=google&logoColor=black)](https://developers.google.com/mediapipe)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-9d4edd?style=for-the-badge)](LICENSE)

<br />

### 🌐 **[👉 Click Here to Open Live Website: https://lohitgym.netlify.app/](https://lohitgym.netlify.app/)**

<br />

<p align="center">
  <b>An AI-powered computer vision fitness coach that runs directly in your browser.</b><br />
  Accurately counts single-arm dumbbell bicep curls via webcam with profile-view posture alignment, interactive goal tracking, real-time joint angle mathematics, audio feedback, and dual-mode cloud/local storage.
</p>

</div>

---

## 🌟 Key Highlights

- 🌐 **Instant Live Deployment**: Available online at [https://lohitgym.netlify.app/](https://lohitgym.netlify.app/).
- ⚡ **Zero-Latency In-Browser Vision**: Powered by Google MediaPipe Pose via WebGL/WASM—no video is transmitted across the network, guaranteeing 100% privacy and smooth 60 FPS tracking.
- 📐 **Smart Profile-View Alignment Box**: Visual cyberpunk guide rectangle detects if you are standing in profile view (facing left or right). Alerts you if you face forward to ensure peak joint angle accuracy.
- 🎯 **Personalized Goal Setting**: Prompts you for your workout rep goal at startup (`5`, `8`, `10`, `12`, `15`, `20`, or custom) and dynamically syncs your progress below the camera.
- 📊 **Dynamic Gym HUD Directly Below Webcam**: Displays Target Goal, Live Rep Count, Reps Remaining, Real-time Flexion Angle ($168^\circ \to 42^\circ$), Form Rating, Stopwatch Timer, and Estimated Calories Burned.
- 🔊 **Web Audio Synthesizer**: Custom retro-futuristic sound engine for rep ticks, peak holds, and victory fanfare without requiring external audio files.
- 🎮 **Offline Simulator / Demo Mode**: Built-in 2D kinematic mannequin simulator allows full testing even without physical camera hardware.
- 🔄 **Dual Telemetry Architecture**: Connects seamlessly with the included Node.js + WebSocket backend locally, and automatically falls back to an offline `localStorage` vault when hosted on static platforms like Netlify.

---

## 📸 How It Works

```
                     ┌───────────────────────────────┐
                     │         User Webcam           │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │     MediaPipe Pose Engine     │
                     │ (Shoulder, Elbow, Wrist, Ear) │
                     └───────────────┬───────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌─────────────────────────┐                         ┌─────────────────────┐
│ Stance Orientation      │                         │ Joint Angle Compute │
│ Left Profile / Right    │                         │ θ = ∠(Shoulder,     │
│ Profile / Front Warning │                         │       Elbow, Wrist) │
└──────────┬──────────────┘                         └──────────┬──────────┘
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │    Rep State Machine Flow     │
                     │  DOWN (>150°) ──► CURLING     │
                     │         ▲              │      │
                     │         │              ▼      │
                     │     +1 REP ◄── LOWERING ◄── PEAK (<50°)
                     └───────────────┬───────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌─────────────────────────┐                         ┌─────────────────────┐
│ Visual HUD & Confetti   │                         │ Audio Chimes &      │
│ Real-time stats update  │                         │ Backend/Local Sync  │
└─────────────────────────┘                         └─────────────────────┘
```

### Biomechanical Angle Calculation
The application tracks the 2D spatial coordinates of the active arm:
- **Shoulder Joint ($A$)**: Landmark `11` (Left) or `12` (Right)
- **Elbow Joint ($B$)**: Landmark `13` (Left) or `14` (Right)
- **Wrist Joint ($C$)**: Landmark `15` (Left) or `16` (Right)

The interior flexion angle $\theta$ is derived using vector trigonometry:

$$\vec{u} = \vec{A} - \vec{B}, \quad \vec{v} = \vec{C} - \vec{B}$$

$$\theta = \arccos\left(\frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}\right) \times \frac{180^\circ}{\pi}$$

- **Full Extension (`DOWN`)**: $\theta \ge 150^\circ$
- **Peak Contraction (`PEAK`)**: $\theta \le 50^\circ$
- **Rep Completion**: Full transition from `DOWN` $\to$ `CURLING` $\to$ `PEAK` $\to$ `DOWN` counts as 1 valid repetition with form validation.

---

## 📂 Project Structure

```
gym/
├── frontend/                       # Client web application (Netlify deploy target)
│   ├── index.html                  # Cyberpunk HUD UI layout, modals & canvas viewport
│   ├── style.css                   # Glassmorphism, neon glow aesthetics & responsive styles
│   ├── app.js                      # Core UI coordinator, stopwatch timer & state sync
│   ├── pose-tracker.js             # MediaPipe pose pipeline, profile classifier & state machine
│   ├── audio.js                    # Web Audio API sound synthesizer
│   └── api-client.js               # WebSocket, REST & Netlify localStorage sync client
├── backend/                        # Local Node.js server
│   ├── server.js                   # Express server & WebSocket telemetry engine
│   ├── storage.js                  # Persistent JSON storage manager
│   └── data/
│       └── workouts.json           # Historical workout database & personal records
├── index.html                      # Root deployment redirect helper
├── netlify.toml                    # Netlify build configuration
├── package.json                    # Project configuration and dependencies
└── README.md                       # Repository documentation
```

---

## 🚀 Quick Start (Run Locally)

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- A modern web browser (Google Chrome, Microsoft Edge, Brave, or Safari)
- A webcam (or use the built-in **Test / Demo Simulation** mode)

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/gym.git
cd gym
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the application
```bash
npm start
```

### 4. Open in browser
Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🎯 How to Use

1. **Set Your Target Goal**: When you launch the app, choose your rep goal (e.g., 10 or 12) in the startup modal and click **Lock In Goal & Start**.
2. **Enable Webcam**: Click **⚡ Enable Webcam** and allow camera permissions in your browser.
3. **Align Inside the Guide Box**: Stand sideways inside the glowing boundary box (**face leftward or rightward**).
   - If you face forward, the box turns amber with an alert: *"Please turn sideways (face left or right)"*.
   - Once turned sideways, the box turns neon green: *"✔ PROFILE LOCKED"*.
4. **Perform Curls**: Curl the dumbbell upward toward your shoulder ($\le 50^\circ$) and lower all the way back down ($\ge 150^\circ$).
5. **Track Your Stats**: Watch your live reps, progress bar, joint angle gauge, and calories update directly below the webcam in real-time.
6. **Celebrate**: Hit your goal to trigger a victory fanfare, confetti explosion, and session performance breakdown!

---

## 🛠️ Built With

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Modern Vanilla CSS (Glassmorphism & Cyberpunk Design System)
- **Computer Vision**: [Google MediaPipe Pose](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker)
- **Audio**: HTML5 Web Audio API (Synthesized Oscillators)
- **Visual FX**: [canvas-confetti](https://www.npmjs.com/package/canvas-confetti)
- **Backend**: Node.js, [Express](https://expressjs.com/), [ws (WebSockets)](https://github.com/websockets/ws)
- **Hosting & Deployment**: [Netlify](https://www.netlify.com/)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <b>Built with ❤️ by Lohit • Powered by CyberCurl AI</b><br />
  <sub>Star ⭐ this repository if you found it useful!</sub>
</div>
