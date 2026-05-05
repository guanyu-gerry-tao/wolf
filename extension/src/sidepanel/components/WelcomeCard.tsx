import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const STORAGE_KEY = 'wolf.firstRunSeen';

// Tiny first-run card that explains what wolf is in 30 words. Persists a
// flag in localStorage so the card never shows again after the user
// dismisses it. Uses localStorage (not chrome.storage) on purpose so the
// dismissal survives even the demo HTML mode.

export function useFirstRunSeen(): { seen: boolean; markSeen: () => void } {
  const [seen, setSeen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return true;
    }
  });

  const markSeen = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore: extension/local-storage is best-effort
    }
    setSeen(true);
  };

  // If another tab/window flips the flag (e.g., user clicks dismiss in
  // another open instance), pick it up here.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue === 'true') setSeen(true);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { seen, markSeen };
}

interface WelcomeCardProps {
  onDismiss: () => void;
}

export function WelcomeCard({ onDismiss }: WelcomeCardProps) {
  return (
    <motion.div
      className="welcome-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      aria-hidden
    >
    <motion.section
      className="welcome-card"
      role="dialog"
      aria-label="welcome to wolf"
      aria-modal="true"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
    >
      <p className="eyebrow">Welcome</p>
      <h2 className="welcome-title">wolf is your job hunt copilot</h2>
      <p className="welcome-body">
        Find roles, tailor resumes, and fill applications without copy-paste. wolf runs locally and uses a separate Chrome window so it never touches your main browser cookies or extensions.
      </p>
      <ul className="welcome-steps">
        <li>1. Connect to <code>wolf serve</code> from the pill above.</li>
        <li>2. Open a job posting in the wolf browser.</li>
        <li>3. Import → Process → Tailor.</li>
      </ul>
      <button type="button" className="hero-primary" onClick={onDismiss}>Got it</button>
    </motion.section>
    </motion.div>
  );
}
