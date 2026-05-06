import { stringify } from 'smol-toml';
import { WOLF_BUILTIN_QUESTIONS } from '../../utils/profileFields.js';
import { parseProfileToml, type QuestionEntry } from '../../utils/profileToml.js';
import { profileTomlTemplate } from '../../utils/profileTomlGenerate.js';

export const INIT_PRESET_NAMES = ['default', 'empty'] as const;
export type InitPresetName = typeof INIT_PRESET_NAMES[number];

export function normalizeInitPresetName(value: string | true | undefined): InitPresetName | undefined {
  if (value === undefined) return undefined;
  const name = value === true ? 'default' : value;
  if (isInitPresetName(name)) return name;
  throw new Error(`Unknown init preset "${name}". Available presets: ${INIT_PRESET_NAMES.join(', ')}`);
}

export function profileTomlForInitPreset(name: InitPresetName): string {
  switch (name) {
    case 'empty':
      return profileTomlTemplate;
    case 'default':
      return buildDefaultProfileToml();
  }
}

function buildDefaultProfileToml(): string {
  const profile = parseProfileToml(profileTomlTemplate);

  profile.identity.legal_first_name = 'John';
  profile.identity.legal_last_name = 'Smith';
  profile.identity.country_of_citizenship = 'China';
  profile.contact.email = 'john.smith@example.test';
  profile.contact.phone = '+1 555 020 3141';
  profile.address.full = '77 Massachusetts Ave, Cambridge, MA 02139, USA';
  profile.links.first = 'https://www.linkedin.com/in/john-smith-example';
  profile.links.second = 'https://github.com/john-smith-example';
  profile.links.others = 'https://leetcode.com/john-smith-example';
  profile.job_preferences.target_roles = [
    'Software Engineer',
    'Backend Engineer',
    'Full Stack Engineer',
  ].join('\n');
  profile.job_preferences.target_locations = [
    'Boston',
    'New York City',
    'Seattle',
    'SF Bay Area',
    'Remote-US',
  ].join('\n');
  profile.job_preferences.remote_preference = 'hybrid or remote preferred';
  profile.job_preferences.relocation_preferences = 'Open to Boston, New York City, Seattle, SF Bay Area, and remote-friendly US roles.';
  profile.job_preferences.sponsorship_preferences = 'F-1 OPT now; will need H-1B sponsorship in the future.';
  profile.job_preferences.min_annual_salary_usd = '120000';
  profile.job_preferences.scoring_notes = 'Prioritize new-grad backend, distributed systems, data infrastructure, TypeScript, Python, Go, Postgres, Kafka, Kubernetes, and cloud platform roles that are OPT/H-1B friendly.';
  profile.skills.text = 'TypeScript, Python, Go, Java, SQL, Postgres, Kafka, Redis, React, Node.js, Docker, Kubernetes, AWS, Linux, Git, Spark, gRPC';
  profile.awards.items = [
    'Graduate teaching assistant, Distributed Systems, 2025',
    'Best capstone project finalist, 2024',
  ].join('\n');

  profile.experience = [
    {
      id: 'atlas-cloud-intern',
      job_title: 'Software Engineer Intern',
      company: 'Northbridge Cloud',
      start: '2025-05',
      end: '2025-08',
      location: 'Boston, MA',
      bullets: [
        'Built TypeScript and Go services that processed cloud usage events into Postgres and Kafka-backed analytics tables.',
        'Added gRPC status checks and dashboards for a Kubernetes worker fleet, reducing manual incident triage during batch delays.',
        'Wrote integration tests for billing-event ingestion paths and documented rollback steps for failed deployments.',
      ].join('\n'),
      subnote: '',
    },
    {
      id: 'novapath-systems-intern',
      job_title: 'Software Engineering Intern',
      company: 'Novapath Systems',
      start: '2024-06',
      end: '2025-05',
      location: 'Cambridge, MA',
      bullets: [
        'Implemented Python and Spark jobs to evaluate distributed scheduling policies across synthetic workload traces.',
        'Improved experiment reproducibility by packaging simulation configs, metrics, and plotting scripts into one CLI workflow.',
        'Presented weekly findings to a five-person research group and translated results into engineering follow-up tasks.',
      ].join('\n'),
      subnote: '',
    },
  ];

  profile.project = [
    {
      id: 'opt-job-tracker',
      name: 'OPT Job Tracker',
      year: '2025',
      tech_stack: 'TypeScript, React, Node.js, Postgres',
      bullets: [
        'Built a full-stack tracker for job applications, sponsorship notes, interview stages, and follow-up reminders.',
        'Added search, status filters, and CSV import/export so classmates could reuse the workflow during recruiting.',
      ].join('\n'),
      subnote: '',
    },
    {
      id: 'distributed-cache-lab',
      name: 'Distributed Cache Lab',
      year: '2024',
      tech_stack: 'Go, Redis, gRPC',
      bullets: [
        'Implemented a sharded cache with consistent hashing, replication, and gRPC-based node coordination.',
        'Wrote load tests and failure-injection scripts to compare hit rate and recovery behavior across replication strategies.',
      ].join('\n'),
      subnote: '',
    },
  ];

  profile.education = [
    {
      id: 'northlake-university-ms-cs',
      degree: 'M.S. Computer Science',
      school: 'Northlake University',
      start: '2023',
      end: '2025',
      gpa: '3.8/4.0',
      relevant_coursework: 'Distributed Systems, Cloud Computing, Database Systems, Algorithms, Machine Learning',
      subnote: '',
    },
  ];

  profile.question = withPresetQuestionAnswers(profile.question, {
    authorized_to_work: 'Yes, I am legally authorized to work in the United States.',
    require_sponsorship: 'Yes, I will require H-1B sponsorship after OPT.',
    willing_to_relocate: 'Yes, for Boston, New York City, Seattle, SF Bay Area, and remote-friendly US roles.',
    salary_expectation: 'USD 120,000 to USD 150,000 base depending on location and level.',
    tell_me_about_yourself: 'I am a CS master’s new grad on F-1 OPT, focused on backend systems, data infrastructure, and practical full-stack tools.',
    tell_me_about_failure: 'In one project I underestimated integration risk; I recovered by adding earlier end-to-end checks and a shared launch checklist.',
    tell_me_about_conflict: 'When teammates disagreed on scope, I wrote down the trade-offs, proposed a smaller first milestone, and kept the larger idea in backlog.',
    biggest_strength: 'I am good at turning ambiguous technical problems into small, testable pieces.',
    biggest_weakness: 'I sometimes go too deep before sharing progress, so I now time-box investigation and post written checkpoints.',
    five_year_goal: 'I want to grow into an engineer trusted to own reliable backend systems and mentor newer teammates.',
    handle_stress_failure: 'I slow the problem down, identify the next reversible step, and communicate status early.',
    what_motivates: 'I like building tools that make other people faster and calmer at work.',
    led_team_or_project: 'I led a course project by splitting backend, frontend, and data tasks, then keeping the integration path visible every week.',
    handled_disagreed_feedback: 'I ask for the concrete risk behind the feedback, test that risk, and keep the parts that improve the work.',
    proudest_project: 'I am proud of OPT Job Tracker because it translated a stressful recruiting workflow into a concrete, reusable tool.',
    view_company_framework: 'I evaluate companies by user pain, engineering quality, learning curve, and whether the team can ship responsibly.',
    view_product_framework: 'I look at who uses the product, what job it helps them finish, and where reliability or usability would change outcomes.',
    suggestions_company_framework: 'I would first understand the company strategy, then suggest focused improvements tied to customer and engineering evidence.',
    suggestions_product_framework: 'I would look for friction in the main workflow, measure where users drop off, and propose a small experiment.',
  });

  return stringify(profile as unknown as Record<string, unknown>);
}

function withPresetQuestionAnswers(
  questions: QuestionEntry[],
  answersById: Record<string, string>,
): QuestionEntry[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return WOLF_BUILTIN_QUESTIONS.map((builtin) => {
    const existing = byId.get(builtin.id);
    return {
      id: builtin.id,
      prompt: existing?.prompt ?? builtin.prompt,
      required: existing?.required ?? builtin.required,
      answer: answersById[builtin.id] ?? existing?.answer ?? builtin.defaultAnswer ?? '',
      subnote: existing?.subnote ?? '',
    };
  });
}

function isInitPresetName(name: string): name is InitPresetName {
  return (INIT_PRESET_NAMES as readonly string[]).includes(name);
}
