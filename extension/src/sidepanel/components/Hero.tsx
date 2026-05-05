import { type ReactNode } from 'react';
import { useCompanionState } from '../state/StateContext';
import { useCompanionActions } from '../hooks/useCompanionActions';
import type { AppPhase } from '../state/phase';

interface HeroProps {
  phase: AppPhase;
}

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
    <section className="hero" aria-label="next step">
      <p className="eyebrow">{content.kicker}</p>
      <h2 className="hero-title">{content.title}</h2>
      <p className="hero-body">{content.body}</p>
      {(content.primary || content.secondary) && (
        <div className="hero-actions">
          {content.primary && (
            <button
              type="button"
              className="hero-primary"
              disabled={content.primary.disabled}
              onClick={content.primary.onClick}
            >
              {content.primary.label}
            </button>
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
    </section>
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
    case 'has-imports':
      return {
        kicker: 'Step 3 of 4',
        title: `${state.inbox.rawCount} imported page${state.inbox.rawCount === 1 ? '' : 's'} ready`,
        body: 'Process Inbox turns raw imports into structured Ready jobs with company, title, and location parsed.',
        primary: {
          label: `Process Inbox (${state.inbox.rawCount})`,
          onClick: () => void actions.processInbox(),
        },
      };
    case 'has-processed':
      return {
        kicker: 'Step 4 of 4',
        title: `${state.tailor.untailoredJobCount} job${state.tailor.untailoredJobCount === 1 ? '' : 's'} ready to tailor`,
        body: 'Tailor generates a resume and cover letter for each Ready job. Use Batch Tailor for the whole queue, or Tailor this job instantly for the current page.',
        primary: {
          label: `Batch Tailor (${state.tailor.untailoredJobCount})`,
          onClick: () => void actions.batchTailor(),
        },
      };
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
