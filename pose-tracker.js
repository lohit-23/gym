/**
 * CyberCurl Real-Time Pose Tracker
 * Integrates MediaPipe Pose, side-profile detection, guide rectangle, and bicep curl state machine.
 */
class PoseTracker {
  constructor(videoElement, canvasElement, options = {}) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.options = Object.assign({
      armMode: 'Auto', // 'Auto', 'Right', 'Left'
      mirror: true,
      onRep: null,
      onAngleUpdate: null,
      onStanceChange: null,
      onTargetReached: null
    }, options);

    // Rep Counting State Machine
    this.repCount = 0;
    this.targetReps = 10;
    this.state = 'DOWN'; // 'DOWN', 'CURLING', 'PEAK', 'LOWERING'
    this.peakAchieved = false;
    this.currentAngle = 170;
    this.smoothedAngle = 170;
    this.lastRepTime = 0;
    this.repProgressPercent = 0;

    // Posture & Profile Orientation
    this.stance = {
      isInsideBox: false,
      isProfile: false,
      facingDirection: 'unknown', // 'left', 'right', 'front'
      activeArm: 'Right',
      statusText: 'Position yourself inside the guide box'
    };

    // MediaPipe components
    this.pose = null;
    this.camera = null;
    this.isRunning = false;
    this.isModelLoaded = false;
    this.isDemoMode = false;
    this.demoAngle = 170;
    this.demoDirection = -1;
    this.demoAnimId = null;

    // Guide Rectangle Coordinates (Normalized 0..1 relative to canvas)
    this.guideBox = {
      xMin: 0.22,
      xMax: 0.78,
      yMin: 0.08,
      yMax: 0.94
    };

    // Landmark indexes
    this.LMS = {
      NOSE: 0,
      LEFT_EYE: 2,
      RIGHT_EYE: 5,
      LEFT_EAR: 7,
      RIGHT_EAR: 8,
      LEFT_SHOULDER: 11,
      RIGHT_SHOULDER: 12,
      LEFT_ELBOW: 13,
      RIGHT_ELBOW: 14,
      LEFT_WRIST: 15,
      RIGHT_WRIST: 16,
      LEFT_HIP: 23,
      RIGHT_HIP: 24
    };
  }

  setTargetReps(target) {
    this.targetReps = parseInt(target, 10) || 10;
  }

  setArmMode(mode) {
    this.options.armMode = mode;
  }

  resetCount() {
    this.repCount = 0;
    this.state = 'DOWN';
    this.peakAchieved = false;
    this.currentAngle = 170;
    this.smoothedAngle = 170;
  }

  async initMediaPipe() {
    if (this.isModelLoaded) return true;

    // Check if MediaPipe Pose is loaded globally
    if (typeof window.Pose === 'undefined') {
      console.warn('MediaPipe Pose script not loaded yet. Waiting...');
      await new Promise((res) => setTimeout(res, 800));
    }

    try {
      this.pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.pose.onResults((results) => this.handlePoseResults(results));
      this.isModelLoaded = true;
      console.log('✅ MediaPipe Pose Model Loaded');
      return true;
    } catch (err) {
      console.error('Failed to initialize MediaPipe Pose:', err);
      return false;
    }
  }

  async startCamera() {
    await this.initMediaPipe();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      this.video.srcObject = stream;
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      this.isRunning = true;
      this.isDemoMode = false;
      this.startProcessingLoop();
      return { success: true };
    } catch (err) {
      console.warn('Webcam access error:', err);
      return {
        success: false,
        error: err.name || 'CameraError',
        message: 'Could not access webcam. Check permissions.'
      };
    }
  }

  stopCamera() {
    this.isRunning = false;
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach((t) => t.stop());
      this.video.srcObject = null;
    }
    if (this.demoAnimId) {
      cancelAnimationFrame(this.demoAnimId);
      this.demoAnimId = null;
    }
  }

  startProcessingLoop() {
    const processFrame = async () => {
      if (!this.isRunning) return;

      if (this.video.readyState >= 2 && this.pose) {
        try {
          await this.pose.send({ image: this.video });
        } catch (e) {
          console.warn('Pose send frame error:', e);
        }
      }
      requestAnimationFrame(processFrame);
    };
    requestAnimationFrame(processFrame);
  }

  // Calculate 2D angle (in degrees) at joint B formed by points A-B-C
  calculateAngle(a, b, c) {
    const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((rad * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  }

  handlePoseResults(results) {
    // Ensure canvas dimensions match video
    if (this.video.videoWidth && this.canvas.width !== this.video.videoWidth) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Clear and draw video frame
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (this.options.mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(results.image, 0, 0, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(results.image, 0, 0, width, height);
      ctx.restore();
    }

    // Process landmarks if detected
    if (results.poseLandmarks) {
      this.analyzePose(results.poseLandmarks, width, height);
    } else {
      this.stance.isInsideBox = false;
      this.stance.statusText = 'Step inside the guide box';
      if (this.options.onStanceChange) {
        this.options.onStanceChange(this.stance);
      }
    }

    // Draw Cyberpunk Visual Guide Overlays
    this.drawGuideOverlay(width, height);

    // Draw active skeleton and angle arc
    if (results.poseLandmarks) {
      this.drawTrackedArm(results.poseLandmarks, width, height);
    }
  }

  /**
   * Evaluates Profile Stance (Facing Left/Right vs Facing Forward)
   * and drives the Bicep Curl State Machine
   */
  analyzePose(landmarks, width, height) {
    const LMS = this.LMS;
    const nose = landmarks[LMS.NOSE];
    const leftShoulder = landmarks[LMS.LEFT_SHOULDER];
    const rightShoulder = landmarks[LMS.RIGHT_SHOULDER];
    const leftEar = landmarks[LMS.LEFT_EAR];
    const rightEar = landmarks[LMS.RIGHT_EAR];

    // 1. Check if user is inside Guide Box
    const centerShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    const centerShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const isInside =
      centerShoulderX >= this.guideBox.xMin &&
      centerShoulderX <= this.guideBox.xMax &&
      centerShoulderY >= this.guideBox.yMin &&
      centerShoulderY <= this.guideBox.yMax;

    this.stance.isInsideBox = isInside;

    // 2. Profile Orientation Analysis
    // Distance between shoulders in X
    const shoulderWidthX = Math.abs(leftShoulder.x - rightShoulder.x);
    // In profile view, shoulder width projection is noticeably narrower than frontal view
    // Also compare nose position relative to shoulders
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const noseOffset = nose.x - shoulderMidX;

    // Ear visibility contrast
    const earVisDiff = Math.abs((leftEar.visibility || 0) - (rightEar.visibility || 0));

    let isProfile = false;
    let facingDirection = 'front';

    // When standing sideways, one side of the face/body is foreground
    if (shoulderWidthX < 0.18 || earVisDiff > 0.35 || Math.abs(noseOffset) > 0.04) {
      isProfile = true;
      if (noseOffset > 0.015) {
        facingDirection = 'right';
      } else if (noseOffset < -0.015) {
        facingDirection = 'left';
      } else {
        // Fallback to ear visibility
        facingDirection = (rightEar.visibility || 0) > (leftEar.visibility || 0) ? 'right' : 'left';
      }
    } else {
      isProfile = false;
      facingDirection = 'front';
    }

    this.stance.isProfile = isProfile;
    this.stance.facingDirection = facingDirection;

    // 3. Determine Active Arm to track
    let activeArm = this.options.armMode;
    if (activeArm === 'Auto') {
      if (facingDirection === 'right') {
        // Facing right: Right arm is the primary visible profile arm
        activeArm = 'Right';
      } else if (facingDirection === 'left') {
        // Facing left: Left arm is primary
        activeArm = 'Left';
      } else {
        // Choose arm with higher overall confidence
        const leftConf = (leftShoulder.visibility || 0) + (landmarks[LMS.LEFT_ELBOW].visibility || 0);
        const rightConf = (rightShoulder.visibility || 0) + (landmarks[LMS.RIGHT_ELBOW].visibility || 0);
        activeArm = rightConf >= leftConf ? 'Right' : 'Left';
      }
    }
    this.stance.activeArm = activeArm;

    // Stance status text
    if (!isInside) {
      this.stance.statusText = 'Step inside the guide box';
    } else if (!isProfile) {
      this.stance.statusText = 'Turn sideways (face Left or Right) for accurate counting';
    } else {
      this.stance.statusText = `Profile locked (${facingDirection.toUpperCase()}) • Tracking ${activeArm} Arm`;
    }

    if (this.options.onStanceChange) {
      this.options.onStanceChange(this.stance);
    }

    // 4. Calculate Arm Angle for Curl Tracking
    let shoulder, elbow, wrist;
    if (activeArm === 'Left') {
      shoulder = landmarks[LMS.LEFT_SHOULDER];
      elbow = landmarks[LMS.LEFT_ELBOW];
      wrist = landmarks[LMS.LEFT_WRIST];
    } else {
      shoulder = landmarks[LMS.RIGHT_SHOULDER];
      elbow = landmarks[LMS.RIGHT_ELBOW];
      wrist = landmarks[LMS.RIGHT_WRIST];
    }

    if (shoulder && elbow && wrist && (elbow.visibility || 0) > 0.4) {
      const rawAngle = this.calculateAngle(shoulder, elbow, wrist);
      // Smoothing with EMA
      this.smoothedAngle = this.smoothedAngle * 0.4 + rawAngle * 0.6;
      this.currentAngle = Math.round(this.smoothedAngle);

      // Map angle to completion percentage (160 deg = 0%, 45 deg = 100%)
      const maxExt = 160;
      const minExt = 45;
      const clamped = Math.max(minExt, Math.min(maxExt, this.currentAngle));
      this.repProgressPercent = Math.round(((maxExt - clamped) / (maxExt - minExt)) * 100);

      // Execute State Machine
      this.updateRepStateMachine(this.currentAngle);

      if (this.options.onAngleUpdate) {
        this.options.onAngleUpdate(this.currentAngle, this.repProgressPercent, this.state);
      }
    }
  }

  /**
   * Bicep Curl State Machine:
   * DOWN (> 150 deg) -> CURLING UP -> PEAK (< 50 deg) -> LOWERING -> DOWN (> 145 deg) = +1 REP!
   */
  updateRepStateMachine(angle) {
    const now = Date.now();

    if (this.state === 'DOWN') {
      if (angle < 140) {
        this.state = 'CURLING';
      }
    } else if (this.state === 'CURLING') {
      if (angle <= 52) {
        this.state = 'PEAK';
        this.peakAchieved = true;
        if (window.soundEngine) {
          window.soundEngine.playPeakSound();
        }
      } else if (angle > 150) {
        // Dropped back down without reaching peak (incomplete rep)
        this.state = 'DOWN';
        this.peakAchieved = false;
      }
    } else if (this.state === 'PEAK') {
      if (angle > 65) {
        this.state = 'LOWERING';
      }
    } else if (this.state === 'LOWERING') {
      if (angle >= 148 && this.peakAchieved) {
        // Full rep completed! Debounce at least 400ms between reps
        if (now - this.lastRepTime > 400) {
          this.repCount++;
          this.lastRepTime = now;
          this.state = 'DOWN';
          this.peakAchieved = false;

          // Play audio
          if (window.soundEngine) {
            window.soundEngine.playRepSound(this.repCount);
          }

          // Callback
          if (this.options.onRep) {
            this.options.onRep(this.repCount, angle, 95, this.stance.activeArm);
          }

          // Check target
          if (this.repCount === this.targetReps) {
            if (window.soundEngine) {
              window.soundEngine.playVictorySound();
            }
            if (this.options.onTargetReached) {
              this.options.onTargetReached(this.repCount, this.targetReps);
            }
          }
        }
      } else if (angle < 60) {
        // Curled back up before full extension
        this.state = 'PEAK';
      }
    }
  }

  /**
   * Draws the Cyberpunk HUD Guide Overlay & Profile Rectangle
   */
  drawGuideOverlay(width, height) {
    const ctx = this.ctx;
    const gb = this.guideBox;

    const x = gb.xMin * width;
    const y = gb.yMin * height;
    const w = (gb.xMax - gb.xMin) * width;
    const h = (gb.yMax - gb.yMin) * height;

    // Determine color based on posture state
    let primaryColor = '#00f2fe'; // Cyan default
    let badgeText = '⌖ ALIGN PROFILE IN BOX';
    let glowColor = 'rgba(0, 242, 254, 0.4)';

    if (this.stance.isInsideBox) {
      if (this.stance.isProfile) {
        primaryColor = '#00f59b'; // Neon Green: Excellent
        glowColor = 'rgba(0, 245, 155, 0.5)';
        badgeText = `✔ PROFILE LOCKED (${this.stance.facingDirection.toUpperCase()})`;
      } else {
        primaryColor = '#ff9f43'; // Amber: Facing camera, needs turn
        glowColor = 'rgba(255, 159, 67, 0.5)';
        badgeText = '⚠ TURN SIDEWAYS (FACE LEFT OR RIGHT)';
      }
    }

    ctx.save();

    // 1. Semi-transparent backdrop outside the guide rectangle for high-focus HUD
    ctx.fillStyle = 'rgba(10, 15, 25, 0.28)';
    ctx.fillRect(0, 0, width, y); // top
    ctx.fillRect(0, y + h, width, height - (y + h)); // bottom
    ctx.fillRect(0, y, x, h); // left
    ctx.fillRect(x + w, y, width - (x + w), h); // right

    // 2. Guide Rectangle Box
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 14;

    // Dashed border
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // 3. High-tech Corner Brackets
    const cornerLen = 32;
    ctx.lineWidth = 4;
    ctx.strokeStyle = primaryColor;
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(x, y + cornerLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen, y);
    // Top-Right
    ctx.moveTo(x + w - cornerLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cornerLen);
    // Bottom-Left
    ctx.moveTo(x, y + h - cornerLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cornerLen, y + h);
    // Bottom-Right
    ctx.moveTo(x + w - cornerLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cornerLen);
    ctx.stroke();

    // 4. Center Profile Silhouette Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◄ STAND FACING LEFT OR RIGHT ►', x + w / 2, y + h / 2);

    // 5. Top Guidance Banner Badge
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    const badgeW = Math.min(380, w - 20);
    const badgeH = 34;
    const badgeX = x + (w - badgeW) / 2;
    const badgeY = y + 14;

    this.roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = primaryColor;
    ctx.stroke();

    ctx.fillStyle = primaryColor;
    ctx.font = '700 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 22);

    ctx.restore();
  }

  /**
   * Draws tracked Arm skeleton lines, joint markers, and elbow angle arc
   */
  drawTrackedArm(landmarks, width, height) {
    const LMS = this.LMS;
    const ctx = this.ctx;
    const active = this.stance.activeArm;

    const sIdx = active === 'Left' ? LMS.LEFT_SHOULDER : LMS.RIGHT_SHOULDER;
    const eIdx = active === 'Left' ? LMS.LEFT_ELBOW : LMS.RIGHT_ELBOW;
    const wIdx = active === 'Left' ? LMS.LEFT_WRIST : LMS.RIGHT_WRIST;

    const s = landmarks[sIdx];
    const e = landmarks[eIdx];
    const w = landmarks[wIdx];

    if (!s || !e || !w || (e.visibility || 0) < 0.35) return;

    // Convert to canvas coordinates (accounting for mirror)
    const getCoords = (pt) => {
      const px = this.options.mirror ? (1 - pt.x) * width : pt.x * width;
      const py = pt.y * height;
      return { x: px, y: py };
    };

    const sCoord = getCoords(s);
    const eCoord = getCoords(e);
    const wCoord = getCoords(w);

    ctx.save();

    // 1. Arm Bone Segments (Neon Cyan to Violet)
    const grad = ctx.createLinearGradient(sCoord.x, sCoord.y, wCoord.x, wCoord.y);
    grad.addColorStop(0, '#00f2fe');
    grad.addColorStop(0.5, '#7928ca');
    grad.addColorStop(1, '#ff2d55');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;

    // Shoulder -> Elbow
    ctx.beginPath();
    ctx.moveTo(sCoord.x, sCoord.y);
    ctx.lineTo(eCoord.x, eCoord.y);
    ctx.stroke();

    // Elbow -> Wrist
    ctx.beginPath();
    ctx.moveTo(eCoord.x, eCoord.y);
    ctx.lineTo(wCoord.x, wCoord.y);
    ctx.stroke();

    // 2. Joint Nodes
    [sCoord, wCoord].forEach((node) => {
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 3. Elbow Joint Dynamic Angle Arc & Pill
    const angle = this.currentAngle;
    ctx.strokeStyle = angle < 60 ? '#00f59b' : '#00f2fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(eCoord.x, eCoord.y, 28, 0, Math.PI * (angle / 180), false);
    ctx.stroke();

    // Glowing Elbow Hub
    ctx.fillStyle = angle < 60 ? '#00f59b' : '#00f2fe';
    ctx.beginPath();
    ctx.arc(eCoord.x, eCoord.y, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Angle Value Tag
    const tagX = eCoord.x + 36;
    const tagY = eCoord.y - 10;
    ctx.fillStyle = 'rgba(12, 17, 29, 0.9)';
    ctx.strokeStyle = angle < 60 ? '#00f59b' : '#00f2fe';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, tagX - 6, tagY - 18, 54, 26, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = angle < 60 ? '#00f59b' : '#ffffff';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${angle}°`, tagX + 21, tagY);

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Interactive Simulator / Demo Mode:
   * Enables complete testing even without webcam hardware!
   */
  startDemoSimulation() {
    this.stopCamera();
    this.isDemoMode = true;
    this.isRunning = true;
    this.demoAngle = 170;
    this.demoDirection = -1;

    this.canvas.width = 1280;
    this.canvas.height = 720;
    const width = 1280;
    const height = 720;

    const loop = () => {
      if (!this.isDemoMode) return;

      // Animate simulated curl angle: 170 down -> 42 up -> 170 down
      if (this.demoDirection === -1) {
        this.demoAngle -= 2.2;
        if (this.demoAngle <= 40) {
          this.demoDirection = 1;
        }
      } else {
        this.demoAngle += 2.2;
        if (this.demoAngle >= 170) {
          this.demoDirection = -1;
        }
      }

      this.currentAngle = Math.round(this.demoAngle);
      this.smoothedAngle = this.currentAngle;

      const maxExt = 160;
      const minExt = 45;
      const clamped = Math.max(minExt, Math.min(maxExt, this.currentAngle));
      this.repProgressPercent = Math.round(((maxExt - clamped) / (maxExt - minExt)) * 100);

      this.updateRepStateMachine(this.currentAngle);

      this.stance.isInsideBox = true;
      this.stance.isProfile = true;
      this.stance.facingDirection = 'right';
      this.stance.activeArm = 'Right';
      this.stance.statusText = 'DEMO SIMULATION ACTIVE • Right Arm (Profile)';

      if (this.options.onStanceChange) {
        this.options.onStanceChange(this.stance);
      }
      if (this.options.onAngleUpdate) {
        this.options.onAngleUpdate(this.currentAngle, this.repProgressPercent, this.state);
      }

      // Draw simulated backdrop
      const ctx = this.ctx;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw simulated side-profile mannequin
      this.drawDemoMannequin(width, height, this.currentAngle);

      // Draw guide overlays
      this.drawGuideOverlay(width, height);

      this.demoAnimId = requestAnimationFrame(loop);
    };

    loop();
  }

  drawDemoMannequin(width, height, angle) {
    const ctx = this.ctx;
    const cx = width * 0.5;
    const cy = height * 0.35;

    ctx.save();
    // Head in profile (facing right)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(cx + 20, cy - 80, 42, 0, 2 * Math.PI);
    ctx.fill();

    // Torso
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 10, cy + 180);
    ctx.stroke();

    // Shoulder
    const sX = cx + 15;
    const sY = cy + 20;

    // Elbow fixed down near torso
    const eX = sX - 5;
    const eY = sY + 110;

    // Wrist rotates by angle
    const armLen = 110;
    // Radian 0 = pointing down (angle 180), radian pi/2 = pointing forward (angle 90), radian ~2.4 = curled up (angle 40)
    const rad = ((180 - angle) * Math.PI) / 180;
    const wX = eX + armLen * Math.sin(rad);
    const wY = eY + armLen * Math.cos(rad);

    // Bicep / Upper Arm
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(sX, sY);
    ctx.lineTo(eX, eY);
    ctx.stroke();

    // Forearm / Wrist
    ctx.strokeStyle = angle < 60 ? '#00f59b' : '#7928ca';
    ctx.beginPath();
    ctx.moveTo(eX, eY);
    ctx.lineTo(wX, wY);
    ctx.stroke();

    // Dumbbell in hand!
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(wX - 8, wY - 26, 16, 52);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(wX - 16, wY - 32, 32, 12);
    ctx.fillRect(wX - 16, wY + 20, 32, 12);

    // Angle text and arc at elbow
    ctx.strokeStyle = angle < 60 ? '#00f59b' : '#00f2fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(eX, eY, 30, Math.PI / 2, Math.PI / 2 + rad);
    ctx.stroke();

    ctx.fillStyle = '#00f2fe';
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(`${angle}°`, eX + 38, eY + 8);

    ctx.restore();
  }
}

window.PoseTracker = PoseTracker;
