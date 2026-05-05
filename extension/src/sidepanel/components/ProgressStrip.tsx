// Four-segment Apple-style progress indicator for the companion top bar.
// Segments correspond to: Connect → Import → Process → Tailor.
// Active segments use the accent color; pending segments are muted.

interface ProgressStripProps {
  active: number; // 0..3
  total?: number; // defaults to 4
  labels?: string[];
}

const DEFAULT_LABELS = ['Connect', 'Import', 'Process', 'Tailor'];

export function ProgressStrip({ active, total = 4, labels = DEFAULT_LABELS }: ProgressStripProps) {
  return (
    <div className="progress-strip" aria-label={`Step ${active + 1} of ${total}: ${labels[active] ?? ''}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`progress-segment ${i <= active ? 'progress-segment--active' : ''}`}
          title={labels[i] ?? ''}
          aria-hidden
        />
      ))}
    </div>
  );
}
