const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const storage = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'frontend' directory
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// In-memory active sessions tracking
const activeSessions = new Map();

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Bicep Curl Backend',
    timestamp: new Date().toISOString(),
    activeSessionsCount: activeSessions.size
  });
});

app.get('/api/stats', (req, res) => {
  try {
    const stats = storage.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/workouts', (req, res) => {
  try {
    const sessions = storage.getSessions();
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/start', (req, res) => {
  try {
    const { targetReps = 10, armUsed = 'Auto' } = req.body;
    const sessionId = 'curl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const session = {
      id: sessionId,
      targetReps: parseInt(targetReps, 10) || 10,
      completedReps: 0,
      armUsed,
      startedAt: new Date().toISOString(),
      repsDetail: []
    };

    activeSessions.set(sessionId, session);
    res.json({
      success: true,
      sessionId,
      session,
      message: `Session initialized. Target: ${session.targetReps} reps.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:id/rep', (req, res) => {
  try {
    const { id } = req.params;
    const { repNumber, angle = 0, formScore = 100, armUsed } = req.body;
    
    let session = activeSessions.get(id);
    if (!session) {
      session = {
        id,
        targetReps: 10,
        completedReps: 0,
        armUsed: armUsed || 'Auto',
        startedAt: new Date().toISOString(),
        repsDetail: []
      };
      activeSessions.set(id, session);
    }

    session.completedReps = repNumber;
    const repData = {
      repNumber,
      angle: Math.round(angle),
      formScore,
      timestamp: new Date().toISOString()
    };
    session.repsDetail.push(repData);

    const remaining = Math.max(0, session.targetReps - repNumber);
    const progressPercent = Math.min(100, Math.round((repNumber / session.targetReps) * 100));

    res.json({
      success: true,
      sessionId: id,
      completedReps: repNumber,
      targetReps: session.targetReps,
      remaining,
      progressPercent,
      targetReached: repNumber >= session.targetReps
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const {
      completedReps = 0,
      targetReps,
      durationSeconds = 0,
      averageFormScore = 92,
      armUsed
    } = req.body;

    const existing = activeSessions.get(id) || {};
    const finalRecord = {
      id,
      targetReps: targetReps || existing.targetReps || 10,
      completedReps: completedReps || existing.completedReps || 0,
      durationSeconds,
      averageFormScore,
      armUsed: armUsed || existing.armUsed || 'Auto',
      repsDetail: existing.repsDetail || [],
      createdAt: new Date().toISOString()
    };

    const saved = storage.saveSession(finalRecord);
    activeSessions.delete(id);

    res.json({
      success: true,
      message: 'Workout session saved successfully!',
      summary: saved
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket Server for live bidirectional telemetry
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  console.log('⚡ Client connected via WebSocket');

  // Send greeting and current stats
  const initialStats = storage.getStats();
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    message: 'Connected to AI Bicep Curl Telemetry Engine',
    stats: initialStats
  }));

  ws.on('message', (message) => {
    try {
      const payload = JSON.parse(message.toString());
      const { type, data } = payload;

      switch (type) {
        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;

        case 'SESSION_START': {
          const { targetReps, armUsed } = data || {};
          const sessionId = 'curl_' + Date.now();
          const session = {
            id: sessionId,
            targetReps: parseInt(targetReps, 10) || 10,
            completedReps: 0,
            armUsed: armUsed || 'Auto',
            startedAt: new Date().toISOString(),
            repsDetail: []
          };
          activeSessions.set(sessionId, session);

          ws.send(JSON.stringify({
            type: 'SESSION_STARTED',
            sessionId,
            targetReps: session.targetReps,
            message: `Target set to ${session.targetReps} reps! Get in position.`
          }));
          break;
        }

        case 'REP_LOGGED': {
          const { sessionId, repNumber, angle, formScore } = data || {};
          let session = activeSessions.get(sessionId);
          if (session) {
            session.completedReps = repNumber;
            session.repsDetail.push({
              repNumber,
              angle: Math.round(angle || 0),
              formScore: formScore || 95,
              time: Date.now()
            });
          }

          let milestoneMessage = null;
          const target = session ? session.targetReps : 10;
          if (repNumber === Math.floor(target / 2)) {
            milestoneMessage = '🔥 Halfway there! Keep your form solid!';
          } else if (repNumber === target) {
            milestoneMessage = '🏆 TARGET REACHED! Fantastic job!';
          } else if (repNumber > target) {
            milestoneMessage = '⚡ Bonus reps unlocked! Unstoppable!';
          }

          ws.send(JSON.stringify({
            type: 'REP_ACKNOWLEDGED',
            repNumber,
            targetReps: target,
            milestoneMessage
          }));
          break;
        }

        case 'SESSION_FINISH': {
          const { sessionId, completedReps, targetReps, durationSeconds, averageFormScore, armUsed } = data || {};
          const existing = activeSessions.get(sessionId) || {};
          const record = {
            id: sessionId || 'curl_' + Date.now(),
            targetReps: targetReps || existing.targetReps || 10,
            completedReps: completedReps || existing.completedReps || 0,
            durationSeconds: durationSeconds || 0,
            averageFormScore: averageFormScore || 90,
            armUsed: armUsed || existing.armUsed || 'Auto',
            repsDetail: existing.repsDetail || []
          };
          const saved = storage.saveSession(record);
          activeSessions.delete(sessionId);

          ws.send(JSON.stringify({
            type: 'SESSION_SAVED',
            summary: saved,
            message: 'Session saved to workout vault.'
          }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Fallback for SPA routing to frontend/index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🏋️  AI Dumbbell Curl Counter Server Running`);
  console.log(`🌐  Local URL:  http://localhost:${PORT}`);
  console.log(`📡  WebSocket:  ws://localhost:${PORT}/ws`);
  console.log(`📂  Frontend:   ${frontendPath}`);
  console.log(`=======================================================`);
});
