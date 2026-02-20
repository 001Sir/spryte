'use client';

import { useState, useEffect, useCallback } from 'react';

const DISMISSED_KEY = 'spryte-pwa-dismissed';
const VISIT_COUNT_KEY = 'spryte-visit-count';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already dismissed or already installed
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
      if (window.matchMedia('(display-mode: standalone)').matches) return;

      // Increment visit count
      const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(count));

      // Only show after 3+ visits
      if (count < 3) return;
    } catch {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch {}
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 max-w-[320px] animate-slide-up">
      <div className="frosted-glass border border-white/[0.08] rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Install Spryte Games</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">Add to your home screen for instant access — no app store needed.</p>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 text-dim hover:text-foreground transition-colors p-1"
            aria-label="Dismiss install prompt"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 text-xs font-semibold px-4 py-2.5 rounded-xl bg-accent text-white hover:shadow-[0_4px_16px_rgba(233,69,96,0.3)] transition-all duration-200"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs px-4 py-2.5 rounded-xl border border-white/[0.06] text-muted hover:text-foreground hover:bg-white/[0.04] transition-all duration-200"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
