/**
 * CyberCurl API & WebSocket Client
 * Connects frontend with backend for real-time rep synchronization & storage.
 * Seamlessly supports static deployment (Netlify) with localStorage vault fallback!
 */
class ApiClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.currentSessionId = null;
    this.statusListeners = [];
    this.messageListeners = [];
    this.reconnectTimer = null;
    this.storageKey = 'cybercurl_workouts_vault';
  }

  init() {
    // Only attempt WebSocket connection if running on http/https and not on static file protocol
    if (window.location.protocol.startsWith('http')) {
      this.connectWebSocket();
    } else {
      this.notifyStatus('disconnected', 'Offline (Local Mode)');
    }
  }

  onStatusChange(fn) {
    this.statusListeners.push(fn);
  }

  onMessage(fn) {
    this.messageListeners.push(fn);
  }

  notifyStatus(status, text) {
    this.statusListeners.forEach((fn) => fn(status, text));
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    this.notifyStatus('connecting', 'Syncing...');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus('connected', 'Live Sync Active');
        console.log('✅ Connected to CyberCurl Backend WebSocket');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.messageListeners.forEach((fn) => fn(msg));
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus('disconnected', 'Static / Local Mode');
        // Only reconnect if on localhost (not a static CDN like Netlify)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notifyStatus('disconnected', 'Static / Local Mode');
      };
    } catch (e) {
      this.isConnected = false;
      this.notifyStatus('disconnected', 'Static / Local Mode');
    }
  }

  scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connectWebSocket();
      }, 4000);
    }
  }

  sendWs(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }

  // LocalStorage helper for Netlify / offline support
  getLocalVault() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : { sessions: [], totalReps: 0, totalWorkouts: 0, bestSet: 0 };
    } catch (e) {
      return { sessions: [], totalReps: 0, totalWorkouts: 0, bestSet: 0 };
    }
  }

  saveLocalSession(record) {
    try {
      const vault = this.getLocalVault();
      vault.sessions = vault.sessions || [];
      vault.sessions.push(record);
      vault.totalWorkouts = (vault.totalWorkouts || 0) + 1;
      vault.totalReps = (vault.totalReps || 0) + (record.completedReps || 0);
      if ((record.completedReps || 0) > (vault.bestSet || 0)) {
        vault.bestSet = record.completedReps;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(vault));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  async startSession(targetReps, armUsed = 'Auto') {
    this.currentSessionId = 'curl_' + Date.now();
    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetReps, armUsed })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.currentSessionId = data.sessionId;
          this.sendWs('SESSION_START', { targetReps, armUsed });
          return data;
        }
      }
    } catch (err) {
      // Netlify / offline fallback
    }

    return {
      success: true,
      sessionId: this.currentSessionId,
      session: { targetReps, completedReps: 0, armUsed }
    };
  }

  async logRep(repNumber, angle, formScore = 95, armUsed = 'Auto') {
    if (!this.currentSessionId) return;

    this.sendWs('REP_LOGGED', {
      sessionId: this.currentSessionId,
      repNumber,
      angle,
      formScore
    });

    try {
      await fetch(`/api/sessions/${this.currentSessionId}/rep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repNumber, angle, formScore, armUsed })
      });
    } catch (err) {
      // Netlify static fallback
    }
  }

  async completeSession(summary) {
    if (!this.currentSessionId) return;

    this.sendWs('SESSION_FINISH', {
      sessionId: this.currentSessionId,
      ...summary
    });

    // Save to localStorage so it works on Netlify
    const record = {
      id: this.currentSessionId,
      createdAt: new Date().toISOString(),
      ...summary
    };
    this.saveLocalSession(record);

    try {
      const res = await fetch(`/api/sessions/${this.currentSessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      // Netlify static fallback
    }

    return { success: true, summary: record };
  }

  async getStats() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) return data;
      }
    } catch (e) {
      // Netlify static fallback
    }

    // Return stats from LocalStorage
    const vault = this.getLocalVault();
    return {
      success: true,
      stats: {
        totalWorkouts: vault.totalWorkouts || 0,
        totalReps: vault.totalReps || 0,
        bestSet: vault.bestSet || 0,
        totalCalories: Math.round((vault.totalReps || 0) * 0.45 * 10) / 10,
        recentSessions: (vault.sessions || []).slice(-5).reverse()
      }
    };
  }

  async getWorkouts() {
    try {
      const res = await fetch('/api/workouts');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.sessions) return data;
      }
    } catch (e) {
      // Netlify static fallback
    }

    const vault = this.getLocalVault();
    return {
      success: true,
      sessions: vault.sessions || []
    };
  }
}

window.apiClient = new ApiClient();
