import { Lock } from 'lucide-react';

// FeatureCard renders an unimplemented capability as a "coming soon"
// roadmap entry rather than a broken-looking disabled button. Visual
// hierarchy: lock icon → feature title → one-line description → hint
// that says when it lands. Hover lifts opacity slightly so the card
// reads as intentional and informative, not as an error.

interface FeatureCardProps {
  title: string;
  description: string;
  coming: string;
  /** Optional id used by the visual review harness for snapshot anchoring. */
  id?: string;
}

export function FeatureCard({ title, description, coming, id }: FeatureCardProps) {
  return (
    <article
      id={id}
      className="feature-card"
      role="group"
      aria-label={`${title} — ${coming}`}
    >
      <div className="feature-card__icon" aria-hidden>
        <Lock size={14} />
      </div>
      <div className="feature-card__body">
        <p className="feature-card__title">{title}</p>
        <p className="feature-card__description">{description}</p>
        <p className="feature-card__coming">{coming}</p>
      </div>
    </article>
  );
}
