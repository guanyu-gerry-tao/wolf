import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useCompanionState } from '../state/StateContext';
import { useCompanionActions } from '../hooks/useCompanionActions';
import type { AppPhase } from '../state/phase';

interface HeroProps {
  phase: AppPhase;
}

// Threshold below which batch actions (Process Inbox, Batch Tailor) are
// hidden from the Hero so users can keep "taking in" individual items
// without being pushed into a paid AI batch run too early. The legacy
// per-step CurrentPanel still exposes Batch buttons for power users.
const BATCH_THRESHOLD = 5;

interface HeroContent {
  kicker: string;
  title: string;
  body: string;
  primary?: { label: string; onClick: () => void; disabled?: boolean };
  secondary?: { label: string; onClick: () => void };
}

// One-glance "do this next" card. Replaces the legacy WorkflowPanel's
// progress chip + dense steps list. Renders exactly one primary action
// based on the current AppPhase. When there is no actionable next step
// (e.g., all caught up), the body explains what is next on the roadmap.

export function Hero({ phase }: HeroProps) {
  const { state } = useCompanionState();
  const actions = useCompanionActions();

  const content = computeHero(phase, state, actions);
  return (
    <motion.section
      className="hero"
      aria-label="next step"
      // Re-key on phase so the card subtly re-enters when the user
      // advances (or rewinds) along the workflow. Cheap visual feedback
      // that "you just did something".
      key={phase}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <p className="eyebrow">{content.kicker}</p>
      <h2 className="hero-title">{content.title}</h2>
      <p className="hero-body">{content.body}</p>
      {(content.primary || content.secondary) && (
        <div className="hero-actions">
          {content.primary && (
            <motion.button
              type="button"
              className="hero-primary"
              disabled={content.primary.disabled}
              onClick={content.primary.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {content.primary.label}
            </motion.button>
          )}
          {content.secondary && (
            <button
              type="button"
              className="ghost-button hero-secondary"
              onClick={content.secondary.onClick}
            >
              {content.secondary.label}
            </button>
          )}
        </div>
      )}
    </motion.section>
  );
}

function computeHero(
  phase: AppPhase,
  state: ReturnType<typeof useCompanionState>['state'],
  actions: ReturnType<typeof useCompanionActions>,
): HeroContent {
  switch (phase) {
    case 'first-run':
    case 'disconnected':
      return {
        kicker: 'Step 1 of 4',
        title: 'Connect to wolf serve',
        body: 'Run `wolf serve` in your terminal, then click Reconnect on the pill above.',
      };
    case 'connecting':
      return {
        kicker: 'Step 1 of 4',
        title: 'Connecting…',
        body: 'Pinging wolf serve and validating the response.',
      };
    case 'runtime-not-ready':
      return {
        kicker: 'Step 1 of 4',
        title: 'Open wolf browser',
        body: 'wolf needs its own Chrome window to drive job pages safely. wolf launches a separate profile so it never touches your main browser cookies or extensions.',
        primary: {
          label: 'Open wolf browser',
          onClick: () => void actions.openWolfBrowser(),
        },
      };
    case 'missing-api-key': {
      // The daemon reported that its Anthropic key is unset. We block
      // entry to any paid phase here and tell the user exactly which
      // shell variable to export. The dev/stable name is read straight
      // from the daemon so the suggested command always matches the
      // running binary.
      const varName = state.runtime.env?.anthropic.envVarName ?? 'WOLF_ANTHROPIC_API_KEY';
      return {
        kicker: 'Setup',
        title: 'Add your Anthropic API key',
        body: `wolf needs ${varName} in your shell to run paid Process / Tailor calls. Add the line below to your ~/.zshrc (or shell rc), restart wolf serve, then click the connection pill to reconnect.`,
      };
    }
    case 'connected-empty':
      return {
        kicker: 'Step 2 of 4',
        title: 'Import a job posting',
        body: 'Open a job page in the wolf browser and click Import below to save it to wolf inbox.',
        primary: {
          label: 'Import this page',
          onClick: () => void actions.importCurrentPage(),
          disabled: state.currentPageStatus.kind === 'duplicate',
        },
      };
    case 'has-imports': {
      // Batch threshold is 5: below that, hide Process Inbox entirely
      // and just keep the per-page Import action visible so the user
      // is encouraged to keep adding to the queue. At or above 5 the
      // batch button appears as primary with Import demoted to a
      // secondary chip.
      const count = state.inbox.rawCount;
      const batchWorthwhile = count >= BATCH_THRESHOLD;
      const importBtn = {
        label: 'Import this page',
        onClick: () => void actions.importCurrentPage(),
        disabled: state.currentPageStatus.kind === 'duplicate',
      };
      if (batchWorthwhile) {
        return {
          kicker: 'Step 3 of 4',
          title: `${count} pages in your inbox`,
          body: 'Process Inbox turns raw imports into structured Ready jobs with company, title, and location parsed.',
          primary: { label: `Process Inbox (${count})`, onClick: () => void actions.processInbox() },
          secondary: { label: 'Import another', onClick: () => void actions.importCurrentPage() },
        };
      }
      return {
        kicker: 'Step 2 of 4',
        title: count === 1 ? '1 page in your inbox' : `${count} pages in your inbox`,
        body: `Keep adding pages — batch processing unlocks at ${BATCH_THRESHOLD}.`,
        primary: importBtn,
      };
    }
    case 'has-processed': {
      // Same threshold as imports: hide Batch Tailor below 5 and let
      // the user finish jobs one at a time. At or above 5 surface the
      // batch action as primary with the per-job tailor as secondary.
      const count = state.tailor.untailoredJobCount;
      const batchWorthwhile = count >= BATCH_THRESHOLD;
      const tailorOneBtn = state.currentJobId
        ? { label: 'Tailor this job instantly', onClick: () => void actions.tailorInstantly() }
        : undefined;
      if (batchWorthwhile) {
        return {
          kicker: 'Step 4 of 4',
          title: `${count} jobs ready to tailor`,
          body: 'Batch Tailor generates resume + cover letter for every Ready job in one go.',
          primary: { label: `Batch Tailor (${count})`, onClick: () => void actions.batchTailor() },
          secondary: tailorOneBtn,
        };
      }
      return {
        kicker: 'Step 3 of 4',
        title: count === 1 ? '1 job ready to tailor' : `${count} jobs ready to tailor`,
        body: tailorOneBtn
          ? `Tailor this one now, or keep importing — batch tailoring unlocks at ${BATCH_THRESHOLD}.`
          : `Open a Ready job in the wolf browser to tailor it. Batch tailoring unlocks at ${BATCH_THRESHOLD}.`,
        primary: tailorOneBtn,
      };
    }
    case 'run-active':
      return {
        kicker: state.activeRunUi?.stepKicker ?? 'AI run active',
        title: 'wolf is working',
        body: 'wolf checks provider status every 60 seconds. Use Check run for the latest local state.',
        primary: {
          label: 'Check run',
          onClick: () => void actions.refreshActiveRun(),
        },
      };
    case 'has-tailored':
      return {
        kicker: 'All caught up',
        title: 'Resume + cover letter ready',
        body: 'Open the artifacts below to preview. Score, Reach out, and Autofill are coming next.',
      };
  }
}

export function HeroIcon(): ReactNode {
  // Reserved for S6 — currently unused.
  return null;
}
