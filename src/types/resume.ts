/** Free-form section (e.g. Summary, Objective) — no structured bullet items. */
export interface ResumePlainSection {
  heading: string;
  content: string;
}

export interface ResumeSectionItem {
  title: string | null;       // null for unnamed items
  subtitle: string | null;    // e.g. company name
  location: string | null;    // e.g. "Mountain View, CA"
  date: string | null;        // e.g. "Jun 2025 – Aug 2025"
  bullets: string[];
}

/** Structured section with bullet-point items (e.g. Experience, Education). */
export interface ResumeSection {
  heading: string;
  items: ResumeSectionItem[];
}

/**
 * Parsed, structured form of a .tex resume file.
 * The contact info header is treated as placeholder content —
 * wolf always overwrites it with the selected UserProfile's data at generation time.
 */
export interface Resume {
  name: string;
  contactInfo: {
    email: string;
    phone: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
  sections: (ResumeSection | ResumePlainSection)[];
  rawTex: string; // original .tex source
}
