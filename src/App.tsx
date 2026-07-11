import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Settings, BookOpen, Coffee,
  ChevronDown, ChevronUp, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { logSession, fetchSessions, StudySession } from './db';

type Phase = 'study' | 'break';
type TimerState = 'idle' | 'running' | 'paused' | 'done';

const DEFAULT_STUDY = 25;
const DEFAULT_BREAK = 5;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function playBeep(type: 'study' | 'break') {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const configs = type === 'study'
      ? [
          { freq: 880, start: 0,    dur: 0.18 },
          { freq: 880, start: 0.22, dur: 0.18 },
          { freq: 1046, start: 0.44, dur: 0.32 },
        ]
      : [
          { freq: 523, start: 0,    dur: 0.28 },
          { freq: 440, start: 0.32, dur: 0.28 },
        ];

    configs.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0, ctx.currentTime + start);
      g.gain.linearRampToValueAtTime(0.55, ctx.currentTime + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });

    setTimeout(() => ctx.close(), 2000);
  } catch {
    // AudioContext not available
  }
}

function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png' });
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export default function App() {
  const [studyMinutes, setStudyMinutes] = useState(DEFAULT_STUDY);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK);
  const [phase, setPhase] = useState<Phase>('study');
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_STUDY * 60);
  const [sessionCount, setSessionCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tempStudy, setTempStudy] = useState(DEFAULT_STUDY);
  const [tempBreak, setTempBreak] = useState(DEFAULT_BREAK);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSecondsRef = useRef(DEFAULT_STUDY * 60);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Update document title with countdown
  useEffect(() => {
    if (timerState === 'running') {
      document.title = `${formatTime(secondsLeft)} — ${phase === 'study' ? 'Study' : 'Break'}`;
    } else {
      document.title = 'Study Timer';
    }
    return () => { document.title = 'Study Timer'; };
  }, [secondsLeft, timerState, phase]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleSessionComplete = useCallback(async (completedPhase: Phase, minutes: number) => {
    clearTimer();
    setTimerState('done');
    playBeep(completedPhase);
    if (completedPhase === 'study') {
      setSessionCount(c => c + 1);
      notify('Study session complete!', `Great work! Time for a ${breakMinutes}-minute break.`);
      await logSession('study', minutes, true);
    } else {
      notify('Break over!', 'Ready to get back to studying?');
      await logSession('break', minutes, true);
    }
  }, [breakMinutes]);

  const startInterval = useCallback((seconds: number, currentPhase: Phase, currentMinutes: number) => {
    clearTimer();
    let remaining = seconds;
    intervalRef.current = setInterval(async () => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        await handleSessionComplete(currentPhase, currentMinutes);
      }
    }, 1000);
  }, [handleSessionComplete]);

  const handleStart = () => {
    if (timerState === 'idle' || timerState === 'done') {
      const mins = phase === 'study' ? studyMinutes : breakMinutes;
      const secs = mins * 60;
      startSecondsRef.current = secs;
      setSecondsLeft(secs);
      setTimerState('running');
      notify(
        phase === 'study' ? 'Study session started!' : 'Break started!',
        phase === 'study'
          ? `Focus for ${mins} minutes.`
          : `Relax for ${mins} minutes.`
      );
      startInterval(secs, phase, mins);
    } else if (timerState === 'paused') {
      setTimerState('running');
      startInterval(secondsLeft, phase, phase === 'study' ? studyMinutes : breakMinutes);
    }
  };

  const handlePause = useCallback(async () => {
    clearTimer();
    setTimerState('paused');
    const mins = phase === 'study' ? studyMinutes : breakMinutes;
    const elapsed = Math.round((startSecondsRef.current - secondsLeft) / 60);
    if (elapsed > 0) {
      await logSession(phase, elapsed, false);
    }
  }, [phase, studyMinutes, breakMinutes, secondsLeft]);

  const handleReset = () => {
    clearTimer();
    setTimerState('idle');
    setSecondsLeft((phase === 'study' ? studyMinutes : breakMinutes) * 60);
  };

  const switchPhase = (newPhase: Phase) => {
    clearTimer();
    setTimerState('idle');
    setPhase(newPhase);
    setSecondsLeft((newPhase === 'study' ? studyMinutes : breakMinutes) * 60);
  };

  const handleNextPhase = () => {
    const next: Phase = phase === 'study' ? 'break' : 'study';
    switchPhase(next);
  };

  const applySettings = () => {
    setStudyMinutes(tempStudy);
    setBreakMinutes(tempBreak);
    clearTimer();
    setTimerState('idle');
    setSecondsLeft((phase === 'study' ? tempStudy : tempBreak) * 60);
    setShowSettings(false);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    const data = await fetchSessions();
    setHistory(data);
    setLoadingHistory(false);
  };

  const toggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory();
  };

  const totalMinutes = history
    .filter(s => s.type === 'study' && s.completed)
    .reduce((acc, s) => acc + s.duration_minutes, 0);

  const progress = timerState === 'idle' || timerState === 'done'
    ? 0
    : 1 - secondsLeft / (phase === 'study' ? studyMinutes * 60 : breakMinutes * 60);

  const circumference = 2 * Math.PI * 110;

  const isStudy = phase === 'study';
  const bgGradient = isStudy
    ? 'from-slate-900 via-slate-800 to-slate-900'
    : 'from-teal-950 via-teal-900 to-slate-900';
  const ringColor = isStudy ? '#3b82f6' : '#14b8a6';
  const ringBg = isStudy ? 'rgba(59,130,246,0.12)' : 'rgba(20,184,166,0.12)';
  const accentText = isStudy ? 'text-blue-400' : 'text-teal-400';
  const accentBorder = isStudy ? 'border-blue-500/30' : 'border-teal-500/30';
  const accentBg = isStudy ? 'bg-blue-500/10 hover:bg-blue-500/20' : 'bg-teal-500/10 hover:bg-teal-500/20';
  const btnPrimary = isStudy
    ? 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/30'
    : 'bg-teal-500 hover:bg-teal-400 shadow-teal-500/30';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-start pt-10 pb-16 px-4 transition-all duration-700`}>

      {/* Header */}
      <header className="w-full max-w-md mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={22} className={accentText} />
          <span className="text-white font-semibold text-lg tracking-tight">Study Timer</span>
          <span className="text-slate-500 text-xs font-normal tracking-wide">Ver.9.0 Mag2026</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTempStudy(studyMinutes); setTempBreak(breakMinutes); setShowSettings(s => !s); }}
            className={`p-2 rounded-lg border ${accentBorder} ${accentBg} text-slate-300 hover:text-white transition-all`}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-full max-w-md mb-6 bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-2xl p-5 shadow-xl">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest">Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Study (min)</span>
              <input
                type="number"
                min={1} max={120}
                value={tempStudy}
                onChange={e => setTempStudy(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider">Break (min)</span>
              <input
                type="number"
                min={1} max={60}
                value={tempBreak}
                onChange={e => setTempBreak(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-teal-500 transition"
              />
            </label>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={applySettings}
              className="flex-1 bg-blue-500 hover:bg-blue-400 text-white rounded-lg py-2 text-sm font-medium transition-all"
            >
              Apply
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg py-2 text-sm font-medium transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phase Switcher */}
      <div className="flex gap-2 mb-8 bg-slate-800/60 backdrop-blur p-1 rounded-xl border border-slate-700/40">
        <button
          onClick={() => switchPhase('study')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            phase === 'study'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen size={15} />
          Study
        </button>
        <button
          onClick={() => switchPhase('break')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            phase === 'break'
              ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coffee size={15} />
          Break
        </button>
      </div>

      {/* Circular Timer */}
      <div className="relative flex items-center justify-center mb-8">
        <svg width="260" height="260" className="rotate-[-90deg]">
          <circle
            cx="130" cy="130" r="110"
            fill="none"
            stroke={ringBg}
            strokeWidth="8"
          />
          <circle
            cx="130" cy="130" r="110"
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.7s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-slate-400 text-xs uppercase tracking-widest font-medium">
            {timerState === 'done' ? 'Complete' : timerState === 'paused' ? 'Paused' : phase === 'study' ? 'Focus' : 'Relax'}
          </span>
          <span className="text-white text-6xl font-light tabular-nums tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(secondsLeft)}
          </span>
          {timerState !== 'idle' && (
            <span className="text-slate-500 text-xs mt-1">
              {phase === 'study' ? `${studyMinutes} min session` : `${breakMinutes} min break`}
            </span>
          )}
        </div>
      </div>

      {/* Session Counter */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: Math.max(4, sessionCount) }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i < sessionCount ? 'bg-blue-400 scale-110' : 'bg-slate-700'
            }`}
          />
        ))}
        <span className="text-slate-500 text-xs ml-1">{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleReset}
          className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/40 text-slate-400 hover:text-white transition-all"
          title="Reset"
        >
          <RotateCcw size={20} />
        </button>

        <button
          onClick={timerState === 'running' ? handlePause : handleStart}
          className={`flex items-center gap-2 px-8 py-4 rounded-2xl ${btnPrimary} text-white font-semibold text-base shadow-lg transition-all duration-200 active:scale-95`}
        >
          {timerState === 'running'
            ? <><Pause size={20} /> Pause</>
            : <><Play size={20} /> {timerState === 'paused' ? 'Resume' : timerState === 'done' ? 'Restart' : 'Start'}</>
          }
        </button>

        {timerState === 'done' && (
          <button
            onClick={handleNextPhase}
            className={`p-3 rounded-xl border ${accentBorder} ${accentBg} ${accentText} hover:text-white transition-all`}
            title={`Switch to ${phase === 'study' ? 'break' : 'study'}`}
          >
            {phase === 'study' ? <Coffee size={20} /> : <BookOpen size={20} />}
          </button>
        )}
      </div>

      {/* Done Banner */}
      {timerState === 'done' && (
        <div className={`w-full max-w-md mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border ${
          phase === 'study'
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
        }`}>
          <CheckCircle size={18} className="shrink-0" />
          <span className="text-sm font-medium">
            {phase === 'study' ? 'Study session complete! Take a break.' : 'Break over! Ready to study?'}
          </span>
        </div>
      )}

      {/* History Toggle */}
      <div className="w-full max-w-md mt-2">
        <button
          onClick={toggleHistory}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-800/80 border border-slate-700/40 rounded-xl text-slate-300 hover:text-white transition-all text-sm font-medium"
        >
          <div className="flex items-center gap-2">
            <Clock size={16} />
            Session History
            {history.length > 0 && (
              <span className="text-xs text-slate-500">({history.length} entries)</span>
            )}
          </div>
          {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showHistory && (
          <div className="mt-2 bg-slate-800/60 backdrop-blur border border-slate-700/40 rounded-xl overflow-hidden">
            {loadingHistory ? (
              <div className="py-8 text-center text-slate-500 text-sm">Loading...</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">No sessions logged yet.</div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Recent Sessions</span>
                  <span className="text-xs text-blue-400 font-medium">{totalMinutes} min studied</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-700/30">
                  {history.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`p-1.5 rounded-lg ${s.type === 'study' ? 'bg-blue-500/15' : 'bg-teal-500/15'}`}>
                        {s.type === 'study'
                          ? <BookOpen size={14} className="text-blue-400" />
                          : <Coffee size={14} className="text-teal-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium capitalize">{s.type}</span>
                          <span className="text-slate-500 text-xs">{s.duration_minutes} min</span>
                          {s.completed
                            ? <CheckCircle size={12} className="text-green-400" />
                            : <XCircle size={12} className="text-slate-600" />
                          }
                        </div>
                        <div className="text-slate-500 text-xs truncate">{formatDate(s.completed_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
