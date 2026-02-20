'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const PRESETS = [
  { label: '5s', ms: 5000 },
  { label: '10s', ms: 10000 },
  { label: '15s', ms: 15000 },
];

export default function GameRecorder({ slug }: { slug: string }) {
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activate via Ctrl+Shift+R or URL param ?record=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('record') === '1') setActive(true);
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setActive((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Also show in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') setActive(true);
  }, []);

  const findCanvas = useCallback((): HTMLCanvasElement | null => {
    const container = document.getElementById('game-container');
    if (!container) return null;
    return container.querySelector('canvas');
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const startRecording = useCallback((durationMs?: number) => {
    const canvas = findCanvas();
    if (!canvas) {
      alert('No game canvas found — start the game first.');
      return;
    }

    chunksRef.current = [];
    setSaved(false);
    setFileSize(null);
    setElapsed(0);

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
      videoBitsPerSecond: 2_500_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setFileSize(formatSize(blob.size));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaved(true);
    };

    recorder.start(100);
    recorderRef.current = recorder;
    setRecording(true);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Auto-stop after preset duration
    if (durationMs) {
      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, durationMs);
    }
  }, [findCanvas, slug]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!active) return null;

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <button
          onClick={stopRecording}
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording {formatTime(elapsed)} — Click to stop & save
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => startRecording()}
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-dim hover:text-foreground hover:bg-white/[0.06] transition-colors font-medium"
            title="Record gameplay preview (unlimited)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
            Record
          </button>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => startRecording(preset.ms)}
              className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-dim hover:text-foreground hover:bg-white/[0.06] transition-colors font-medium"
              title={`Record ${preset.label} preview`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      {saved && (
        <span className="text-xs text-green-400">
          Saved{fileSize ? ` (${fileSize})` : ''}! Move to public/previews/{slug}.webm
        </span>
      )}
    </div>
  );
}
