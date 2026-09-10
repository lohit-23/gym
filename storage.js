const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const WORKOUTS_FILE = path.join(DATA_DIR, 'workouts.json');

class Storage {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WORKOUTS_FILE)) {
      const initialData = {
        sessions: [],
        totalReps: 0,
        totalWorkouts: 0,
        bestSet: 0,
        totalCalories: 0
      };
      fs.writeFileSync(WORKOUTS_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  }

  read() {
    try {
      this.init();
      const raw = fs.readFileSync(WORKOUTS_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading workouts storage:', err);
      return { sessions: [], totalReps: 0, totalWorkouts: 0, bestSet: 0, totalCalories: 0 };
    }
  }

  write(data) {
    try {
      fs.writeFileSync(WORKOUTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Error writing workouts storage:', err);
      return false;
    }
  }

  getSessions() {
    const data = this.read();
    return data.sessions || [];
  }

  getStats() {
    const data = this.read();
    return {
      totalWorkouts: data.totalWorkouts || 0,
      totalReps: data.totalReps || 0,
      bestSet: data.bestSet || 0,
      totalCalories: Math.round((data.totalCalories || 0) * 10) / 10,
      recentSessions: (data.sessions || []).slice(-5).reverse()
    };
  }

  saveSession(session) {
    const data = this.read();
    data.sessions = data.sessions || [];
    
    // Enrich session record
    const record = {
      id: session.id || 'sess_' + Date.now(),
      targetReps: session.targetReps || 0,
      completedReps: session.completedReps || 0,
      targetReached: (session.completedReps || 0) >= (session.targetReps || 0),
      durationSeconds: session.durationSeconds || 0,
      caloriesBurned: session.caloriesBurned || Math.round((session.completedReps || 0) * 0.45 * 10) / 10,
      averageFormScore: session.averageFormScore || 90,
      armUsed: session.armUsed || 'Auto',
      repsDetail: session.repsDetail || [],
      createdAt: session.createdAt || new Date().toISOString()
    };

    data.sessions.push(record);
    data.totalWorkouts += 1;
    data.totalReps += record.completedReps;
    if (record.completedReps > (data.bestSet || 0)) {
      data.bestSet = record.completedReps;
    }
    data.totalCalories += record.caloriesBurned;

    this.write(data);
    return record;
  }
}

module.exports = new Storage();
