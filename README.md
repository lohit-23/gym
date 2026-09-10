# 🏋️ CYBERCURL AI — Precision Bicep Curl Vision System

[![Netlify Status](https://api.netlify.com/api/v1/badges/your-badge-id/deploy-status)](https://app.netlify.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](#license)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-00f2fe.svg)](https://mediapipe.dev)

> A futuristic, cyberpunk-styled AI web application that detects and counts single-arm dumbbell bicep curls in real-time through your webcam. It features a side-profile alignment guide box, interactive target goal prompt, dynamic angle tracking, sound effects, and backend persistence.

---

## 🚀 Deploy Online (Netlify Drop)

Click the link below to deploy your website directly by uploading the folder:

### 🔗 **[https://app.netlify.com/drop](https://app.netlify.com/drop)**

### How to deploy:
1. Click **[https://app.netlify.com/drop](https://app.netlify.com/drop)** to open the Netlify upload page.
2. Drag and drop the **`frontend`** folder (`c:\Users\lohit\Videos\gym\frontend`) into the upload box on that page.
3. That's it! Your website will be live in seconds with its own URL.

---

## ✨ Features

- 🎯 **Target Goal Prompt**: On launch, asks *"How many dumbbell bicep curls are you going to do today?"* with quick selection chips (`5`, `8`, `10`, `12`, `15`, `20`) or custom stepper input.
- 📐 **Profile Stance Guide Rectangle**:
  - Glowing HUD box drawn over the webcam feed.
  - Detects if you are standing in profile view (facing leftward or rightward).
  - Automatically identifies whether you are facing **Left** or **Right** and tracks the active foreground arm.
  - Changes from amber warning (*"Turn sideways inside box"*) to neon green (*"✔ Profile Locked"*) when your stance is aligned.
- 📊 **Dedicated Stats Display Directly Below Webcam**:
  - **Target Goal**: Prominently shows your selected goal (e.g. `12 REPS`).
  - **Reps Completed**: Giant glowing neon counter with rep pulse animations (`0 / 12`).
  - **Reps Remaining**: Live countdown (`12 LEFT`).
  - **Elbow Flexion & Form Quality**: Live joint angle readout ($168^\circ \to 42^\circ$) and form badges (`FULL EXTENSION`, `CURLING UP`, `PEAK CONTRACTION`, `LOWERING`).
  - **Time & Calories**: Session stopwatch and active calorie burn counter.
- 🔊 **Audio Synthesizer Engine**: Web Audio API sound effects for ascending rep chimes, peak holds, and victory fanfares without external audio dependencies.
- 🏆 **Celebration Fanfare**: Confetti explosion and summary modal upon reaching your set target.
- 🎮 **Test / Demo Simulation Mode**: Test the complete curl counting, angle physics, and audio chimes even without a physical webcam connected!
- ⚡ **Dual Sync Engine**:
  - **Local Mode**: Node.js Express server + WebSocket live sync + JSON file database.
  - **Netlify / Cloud Mode**: Seamless static CDN execution with automatic browser `localStorage` workout vault.

---

## 📁 Project Architecture

```
gym/
├── frontend/                       # Client-side web application
│   ├── index.html                  # Main UI layout, viewport, HUD & modals
│   ├── style.css                   # Cyberpunk dark theme, glassmorphism & neon glows
│   ├── app.js                      # Main application & timer controller
│   ├── pose-tracker.js             # MediaPipe pose detection, profile math & state machine
│   ├── audio.js                    # Web Audio API synthesizer
│   └── api-client.js               # Dual WebSocket/REST & Netlify LocalStorage sync
├── backend/                        # Node.js server
│   ├── server.js                   # Express REST API & WebSocket server
│   ├── storage.js                  # Persistent workout session storage
│   └── data/
│       └── workouts.json           # Persisted workout sessions & lifetime stats
├── netlify.toml                    # Netlify deployment configuration
├── package.json                    # Project metadata & dependencies
└── README.md                       # Documentation & Netlify link
```

---

## 🌐 Deploying to Netlify (Step-by-Step)

### Option 1: Drag & Drop Deploy (Fastest — 1 Minute)
1. Log in to [Netlify](https://app.netlify.com).
2. Go to the **Sites** tab and navigate to **[Netlify Drop](https://app.netlify.com/drop)**.
3. Drag and drop the **`frontend`** folder directly into the browser upload box.
4. Netlify will publish your site instantly and provide you with a live URL (e.g., `https://radiant-curl-12345.netlify.app`)!
5. In your Netlify site settings (**Site configuration** > **Change site name**), you can rename it to `cybercurl-ai` or your chosen name.

### Option 2: Deploy with Git (Recommended for Continuous Deployment)
1. Push your repository to GitHub or GitLab:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of CyberCurl AI"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In Netlify, click **Add new site** > **Import an existing project**.
3. Select your repository.
4. The included `netlify.toml` file will automatically configure:
   - **Publish directory**: `frontend`
5. Click **Deploy Site**.

### Option 3: Deploy via Netlify CLI
```bash
npx netlify-cli deploy --prod --dir=frontend
```

---

## 💻 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local server**:
   ```bash
   npm start
   ```

3. **Open in your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🔬 How the Curl Detection Works

1. **Profile Stance Angle Geometry**:
   - Detects the coordinates of Shoulder $(A)$, Elbow $(B)$, and Wrist $(C)$.
   - Calculates the 2D joint angle:
     $$\theta = \arccos\left(\frac{\vec{BA} \cdot \vec{BC}}{|\vec{BA}||\vec{BC}|}\right)$$
2. **Rep State Machine**:
   - **Arm Extended (Bottom)**: Angle $> 150^\circ$ (State: `DOWN`)
   - **Curling**: Angle decreases below $140^\circ$ (State: `CURLING`)
   - **Peak Contraction**: Angle reaches $\le 50^\circ$ (State: `PEAK`, peak flag activated)
   - **Lowering**: Angle returns smoothly (State: `LOWERING`)
   - **Rep Registered (+1)**: Angle extends back past $148^\circ$ with verified peak flag. Triggers audio chime and increments counter.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
