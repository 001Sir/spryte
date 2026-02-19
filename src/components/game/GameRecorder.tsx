'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export default function GameRecorder({ slug }: { slug: string }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only show in development
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return null;

  const findCanvas = useCallback((): HTMLCanvasElement | null => {
    const container = document.getElementById('game-container');
    if (!container) return null;
    return container.querySelector('canvas');
  }, []);

  const startRecording = useCallback(() => {
    const canvas = findCanvas();
    if (!canvas) {
      alert('No game canvas found — start the game first.');
      return;
    }

    chunksRef.current = [];
    setSaved(false);
    setElapsed(0);

    const stream = canvas.captureStream(30); // 30 fps
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

    recorder.start(100); // collect data every 100ms
    recorderRef.current = recorder;
    setRecording(true);

    // Timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
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
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      {recording ? (
        <button
          onClick={stopRecording}
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording {formatTime(elapsed)} — Click to stop & save
        </button>
      ) : (
        <button
          onClick={startRecording}
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-dim hover:text-foreground hover:bg-white/[0.06] transition-colors font-medium"
          title="Record gameplay for hero preview"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
          Record Preview
        </button>
      )}
      {saved && (
        <span className="text-xs text-green-400">
          Saved! Move to public/previews/{slug}.webm
        </span>
      )}
    </div>
  );
}
