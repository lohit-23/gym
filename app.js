/**
 * CyberCurl Main Application Controller
 * Orchestrates UI, Pose Tracker, Audio Engine, and Backend WebSocket Sync
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Header & Status
  const backendStatusDot = document.getElementById('backendStatusDot');
  const backendStatusText = document.getElementById('backendStatusText');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const historyBtn = document.getElementById('historyBtn');
  const changeGoalBtn = document.getElementById('changeGoalBtn');

  // DOM Elements - Viewport & Camera
  const videoEl = document.getElementById('webcamVideo');
  const canvasEl = document.getElementById('webcamCanvas');
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');
  const enableCameraBtn = document.getElementById('enableCameraBtn');
  const runDemoBtn = document.getElementById('runDemoBtn');
  const hudActiveArmText = document.getElementById('hudActiveArmText');
  const hudStateText = document.getElementById('hudStateText');
  const stanceAlertBar = document.getElementById('stanceAlertBar');
  const stanceAlertIcon = document.getElementById('stanceAlertIcon');
  const stanceAlertText = document.getElementById('stanceAlertText');

  // DOM Elements - Primary Stats (Directly Below Webcam)
  const statTargetGoal = document.getElementById('statTargetGoal');
  const statTargetSubtext = document.getElementById('statTargetSubtext');
  const statCurrentCount = document.getElementById('statCurrentCount');
  const statCountRatio = document.getElementById('statCountRatio');
  const goalProgressBar = document.getElementById('goalProgressBar');
  const statRepsRemaining = document.getElementById('statRepsRemaining');
  const statRemainingSubtext = document.getElementById('statRemainingSubtext');
  const statLiveAngle = document.getElementById('statLiveAngle');
  const statRepPercent = document.getElementById('statRepPercent');
  const statFormBadge = document.getElementById('statFormBadge');
  const statSessionTimer = document.getElementById('statSessionTimer');
  const statCalories = document.getElementById('statCalories');

  // DOM Elements - Controls Bar
  const armBtns = document.querySelectorAll('.arm-btn');
  const flipMirrorBtn = document.getElementById('flipMirrorBtn');
  const resetCountBtn = document.getElementById('resetCountBtn');
  const finishWorkoutBtn = document.getElementById('finishWorkoutBtn');

  // DOM Elements - Goal Setup Modal
  const goalModal = document.getElementById('goalModal');
  const goalInput = document.getElementById('goalInput');
  const stepperMinusBtn = document.getElementById('stepperMinusBtn');
  const stepperPlusBtn = document.getElementById('stepperPlusBtn');
  const chipBtns = document.querySelectorAll('.chip-btn');
  const confirmGoalBtn = document.getElementById('confirmGoalBtn');

  // DOM Elements - Victory Modal
  const victoryModal = document.getElementById('victoryModal');
  const victorySubtitle = document.getElementById('victorySubtitle');
  const victoryReps = document.getElementById('victoryReps');
  const victoryDuration = document.getElementById('victoryDuration');
  const victoryCalories = document.getElementById('victoryCalories');
  const victoryForm = document.getElementById('victoryForm');
  const saveCloseVictoryBtn = document.getElementById('saveCloseVictoryBtn');
  const startNextSetBtn = document.getElementById('startNextSetBtn');

  // DOM Elements - History Modal
  const historyModal = document.getElementById('historyModal');
  const vaultTotalSets = document.getElementById('vaultTotalSets');
  const vaultTotalReps = document.getElementById('vaultTotalReps');
  const vaultBestSet = document.getElementById('vaultBestSet');
  const vaultSessionsList = document.getElementById('vaultSessionsList');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');

  // App State
  let targetReps = 10;
  let currentReps = 0;
  let selectedArm = 'Auto';
  let mirrorEnabled = true;
  let soundEnabled = true;
  let timerInterval = null;
  let sessionSeconds = 0;
  let isWorkoutActive = false;
  let averageFormScores = [];

  // Initialize Pose Tracker
  const tracker = new PoseTracker(videoEl, canvasEl, {
    armMode: selectedArm,
    mirror: mirrorEnabled,
    onRep: handleRepCounted,
    onAngleUpdate: handleAngleUpdate,
    onStanceChange: handleStanceChange,
    onTargetReached: handleTargetReached
  });

  // Initialize Backend Connection
  apiClient.init();
  apiClient.onStatusChange((status, text) => {
    backendStatusText.textContent = text;
    if (status === 'connected') {
      backendStatusDot.className = 'status-dot connected';
    } else {
      backendStatusDot.className = 'status-dot';
    }
  });

  apiClient.onMessage((msg) => {
    if (msg.type === 'REP_ACKNOWLEDGED' && msg.milestoneMessage) {
      showTemporaryToast(msg.milestoneMessage);
    }
  });

  // Load Initial Storage Stats
  refreshHistoryStats();

  /* ================= EVENT HANDLERS: GOAL MODAL ================= */
  stepperMinusBtn.addEventListener('click', () => {
    let val = parseInt(goalInput.value, 10) || 10;
    if (val > 1) {
      goalInput.value = val - 1;
      updateActiveChip(val - 1);
    }
  });

  stepperPlusBtn.addEventListener('click', () => {
    let val = parseInt(goalInput.value, 10) || 10;
    if (val < 100) {
      goalInput.value = val + 1;
      updateActiveChip(val + 1);
    }
  });

  chipBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      chipBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      goalInput.value = btn.getAttribute('data-val');
    });
  });

  function updateActiveChip(val) {
    chipBtns.forEach((btn) => {
      if (parseInt(btn.getAttribute('data-val'), 10) === val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  confirmGoalBtn.addEventListener('click', () => {
    const val = parseInt(goalInput.value, 10);
    if (val && val > 0) {
      targetReps = val;
      tracker.setTargetReps(targetReps);
      updateTargetDisplay();
      closeModal(goalModal);

      // Start session on backend
      apiClient.startSession(targetReps, selectedArm);

      // Start timer if not already running
      startSessionTimer();

      // If camera is still off, prompt user to enable camera
      if (!tracker.isRunning) {
        enableWebcamFlow();
      }
    }
  });

  changeGoalBtn.addEventListener('click', () => {
    goalInput.value = targetReps;
    updateActiveChip(targetReps);
    openModal(goalModal);
  });

  /* ================= CAMERA & DEMO CONTROLS ================= */
  enableCameraBtn.addEventListener('click', enableWebcamFlow);

  async function enableWebcamFlow() {
    enableCameraBtn.disabled = true;
    enableCameraBtn.textContent = '⌛ Starting Camera...';

    const result = await tracker.startCamera();
    enableCameraBtn.disabled = false;
    enableCameraBtn.textContent = '⚡ Enable Webcam';

    if (result.success) {
      cameraPlaceholder.style.display = 'none';
      startSessionTimer();
    } else {
      alert(`Webcam Notice: ${result.message || 'Could not start webcam.'}\n\nYou can click "Test / Demo Simulation" to test the counter!`);
    }
  }

  runDemoBtn.addEventListener('click', () => {
    cameraPlaceholder.style.display = 'none';
    tracker.startDemoSimulation();
    startSessionTimer();
  });

  /* ================= PRIMARY STATS UPDATES ================= */
  function updateTargetDisplay() {
    statTargetGoal.textContent = targetReps;
    statCountRatio.textContent = `/ ${targetReps}`;
    updateProgressUI();
  }

  function handleRepCounted(count, angle, formScore, arm) {
    currentReps = count;
    averageFormScores.push(formScore);

    // Visual pulse animation on huge counter
    statCurrentCount.textContent = currentReps;
    statCurrentCount.classList.add('glow-pulse');
    setTimeout(() => {
      statCurrentCount.classList.remove('glow-pulse');
    }, 300);

    updateProgressUI();

    // Log rep to backend
    apiClient.logRep(currentReps, angle, formScore, arm);
  }

  function updateProgressUI() {
    const remaining = Math.max(0, targetReps - currentReps);
    statRepsRemaining.textContent = remaining;

    const percent = Math.min(100, Math.round((currentReps / targetReps) * 100));
    goalProgressBar.style.width = `${percent}%`;

    if (currentReps >= targetReps) {
      statRemainingSubtext.innerHTML = '<span style="color: var(--neon-lime);">★ Target Reached! Outstanding!</span>';
    } else if (currentReps >= Math.floor(targetReps / 2)) {
      statRemainingSubtext.textContent = 'Over halfway there! Keep pushing!';
    } else {
      statRemainingSubtext.textContent = 'Push to complete your set!';
    }

    // Calories: approx 0.45 kcal per dumbbell curl
    const calories = (currentReps * 0.45).toFixed(1);
    statCalories.textContent = `${calories} kcal burned`;
  }

  function handleAngleUpdate(angle, percent, state) {
    statLiveAngle.textContent = `${angle}°`;
    statRepPercent.textContent = `${percent}%`;

    hudStateText.textContent = state;

    // Form feedback badge
    if (state === 'DOWN') {
      statFormBadge.textContent = 'FULL EXTENSION';
      statFormBadge.style.color = 'var(--neon-cyan)';
      statFormBadge.style.borderColor = 'rgba(0, 242, 254, 0.3)';
    } else if (state === 'PEAK') {
      statFormBadge.textContent = 'PEAK CONTRACTION';
      statFormBadge.style.color = 'var(--neon-lime)';
      statFormBadge.style.borderColor = 'rgba(0, 245, 155, 0.3)';
    } else if (state === 'CURLING') {
      statFormBadge.textContent = 'CURLING UP';
      statFormBadge.style.color = '#d8b4fe';
      statFormBadge.style.borderColor = 'rgba(157, 78, 221, 0.3)';
    } else if (state === 'LOWERING') {
      statFormBadge.textContent = 'LOWERING SMOOTH';
      statFormBadge.style.color = '#93c5fd';
      statFormBadge.style.borderColor = 'rgba(147, 197, 253, 0.3)';
    }
  }

  function handleStanceChange(stance) {
    hudActiveArmText.textContent = `${stance.activeArm.toUpperCase()} (${stance.facingDirection.toUpperCase()})`;

    if (stance.isInsideBox && stance.isProfile) {
      stanceAlertBar.className = 'stance-alert-bar stance-perfect';
      stanceAlertIcon.textContent = '✔';
      stanceAlertText.textContent = `Profile locked (${stance.facingDirection.toUpperCase()}) • Tracking ${stance.activeArm} Arm`;
    } else if (stance.isInsideBox && !stance.isProfile) {
      stanceAlertBar.className = 'stance-alert-bar stance-warn';
      stanceAlertIcon.textContent = '⚠';
      stanceAlertText.textContent = 'Please turn sideways (face left or right) for accurate curl tracking';
    } else {
      stanceAlertBar.className = 'stance-alert-bar';
      stanceAlertIcon.textContent = '⌖';
      stanceAlertText.textContent = stance.statusText;
    }
  }

  function handleTargetReached(count, target) {
    // Confetti burst
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 300);
    }

    // Populate Victory Modal
    victoryReps.textContent = count;
    victoryDuration.textContent = formatTimer(sessionSeconds);
    victoryCalories.textContent = `${(count * 0.45).toFixed(1)} kcal`;
    
    const avgScore = averageFormScores.length > 0
      ? Math.round(averageFormScores.reduce((a, b) => a + b, 0) / averageFormScores.length)
      : 95;
    victoryForm.textContent = `${avgScore}%`;

    victorySubtitle.textContent = `Awesome! You completed your target goal of ${target} bicep curls!`;
    openModal(victoryModal);

    // Finalize session on backend
    apiClient.completeSession({
      completedReps: count,
      targetReps: target,
      durationSeconds: sessionSeconds,
      averageFormScore: avgScore,
      armUsed: selectedArm
    });

    refreshHistoryStats();
  }

  /* ================= WORKOUT CONTROLS ================= */
  // Arm Selector
  armBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      armBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedArm = btn.getAttribute('data-arm');
      tracker.setArmMode(selectedArm);
      hudActiveArmText.textContent = selectedArm.toUpperCase();
    });
  });

  // Mirror toggle
  flipMirrorBtn.addEventListener('click', () => {
    mirrorEnabled = !mirrorEnabled;
    tracker.options.mirror = mirrorEnabled;
    flipMirrorBtn.style.color = mirrorEnabled ? 'var(--neon-cyan)' : 'var(--text-secondary)';
  });

  // Reset count
  resetCountBtn.addEventListener('click', () => {
    if (confirm('Reset current rep count to 0?')) {
      currentReps = 0;
      tracker.resetCount();
      statCurrentCount.textContent = '0';
      updateProgressUI();
    }
  });

  // Finish Workout
  finishWorkoutBtn.addEventListener('click', () => {
    if (currentReps === 0) {
      alert('Complete at least 1 rep before finishing your set.');
      return;
    }
    handleTargetReached(currentReps, targetReps);
  });

  // Sound toggle
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = window.soundEngine.toggle();
    soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggleBtn.style.color = soundEnabled ? 'var(--neon-cyan)' : 'var(--text-muted)';
  });

  // Victory Modal Actions
  saveCloseVictoryBtn.addEventListener('click', () => {
    closeModal(victoryModal);
  });

  startNextSetBtn.addEventListener('click', () => {
    closeModal(victoryModal);
    currentReps = 0;
    sessionSeconds = 0;
    averageFormScores = [];
    tracker.resetCount();
    statCurrentCount.textContent = '0';
    updateProgressUI();
    apiClient.startSession(targetReps, selectedArm);
  });

  // History Vault Modal
  historyBtn.addEventListener('click', async () => {
    await refreshHistoryStats();
    openModal(historyModal);
  });

  closeHistoryBtn.addEventListener('click', () => {
    closeModal(historyModal);
  });

  async function refreshHistoryStats() {
    const statsRes = await apiClient.getStats();
    if (statsRes.success && statsRes.stats) {
      vaultTotalSets.textContent = statsRes.stats.totalWorkouts;
      vaultTotalReps.textContent = statsRes.stats.totalReps;
      vaultBestSet.textContent = statsRes.stats.bestSet;
    }

    const workoutsRes = await apiClient.getWorkouts();
    if (workoutsRes.success && workoutsRes.sessions && workoutsRes.sessions.length > 0) {
      vaultSessionsList.innerHTML = workoutsRes.sessions
        .slice(-8)
        .reverse()
        .map((s) => {
          const dateStr = new Date(s.createdAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          return `
            <div class="history-item">
              <div class="history-item-left">
                <div class="history-title">Target: ${s.targetReps} Curls (${s.armUsed || 'Auto'})</div>
                <div class="history-meta">${dateStr} • ${s.durationSeconds || 0}s • ${s.caloriesBurned || 0} kcal</div>
              </div>
              <div class="history-reps">
                ${s.completedReps} <span style="font-size: 0.8rem; color: var(--text-muted);">reps</span>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  /* ================= STOPWATCH TIMER ================= */
  function startSessionTimer() {
    if (timerInterval) clearInterval(timerInterval);
    sessionSeconds = 0;
    statSessionTimer.textContent = '00:00';
    timerInterval = setInterval(() => {
      sessionSeconds++;
      statSessionTimer.textContent = formatTimer(sessionSeconds);
    }, 1000);
  }

  function formatTimer(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  /* ================= MODAL HELPERS ================= */
  function openModal(el) {
    el.classList.add('active');
  }

  function closeModal(el) {
    el.classList.remove('active');
  }

  // Quick toast banner
  function showTemporaryToast(message) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '84px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(15, 23, 42, 0.95)';
    toast.style.border = '1px solid var(--neon-cyan)';
    toast.style.color = 'var(--neon-cyan)';
    toast.style.padding = '10px 24px';
    toast.style.borderRadius = '9999px';
    toast.style.fontFamily = 'var(--font-mono)';
    toast.style.fontSize = '0.85rem';
    toast.style.fontWeight = '700';
    toast.style.boxShadow = '0 10px 30px rgba(0, 242, 254, 0.25)';
    toast.style.zIndex = '9999';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }
});
