/**
 * schema.ts — Drizzle ORM table definitions.
 *
 * Single source of truth for the database schema.
 * TypeScript row types are inferred from here.
 *
 * All CREATE TABLE statements live in ./initializeSchema.ts.
 * Repositories import table references from here.
 */
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CompanySize } from '../../utils/types/company.js';
import type { JobError, JobSource, JobStatus } from '../../utils/types/job.js';
import type { Sponsorship } from '../../utils/types/sponsorship.js';
import type { BatchItemStatus } from '../batchItemRepository.js';
import type {
  BackgroundAiBatchItemStatus,
  BackgroundAiBatchShardStatus,
  BackgroundAiBatchStatus,
  BackgroundAiBatchSubjectType,
  BackgroundAiBatchType,
} from '../backgroundAiBatchRepository.js';
import type { InboxItemKind, InboxItemStatus } from '../inboxRepository.js';

type BatchType = 'score' | 'tailor' | 'inbox_promote';
type BatchAiProvider = 'anthropic' | 'openai';
type BatchStatus = 'pending' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
  linkedinUrl: text('linkedin_url'),
  size: text('size').$type<CompanySize>(),
  industry: text('industry'),
  headquartersLocation: text('headquarters_location'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  companyId: text('company_id').notNull(),
  url: text('url').notNull(),
  source: text('source').$type<JobSource>().notNull(),
  location: text('location').notNull(),
  remote: integer('remote', { mode: 'boolean' }).notNull(),
  // β.10j/k: plain numbers. 0 = explicitly unpaid; null = unknown.
  salaryLow: real('salary_low'),
  salaryHigh: real('salary_high'),
  workAuthorizationRequired: text('work_authorization_required').$type<Sponsorship>().notNull(),
  clearanceRequired: integer('clearance_required', { mode: 'boolean' }).notNull(),
  // v2: JD prose lives in this column instead of `data/jobs/<dir>/jd.md`.
  // Default '' makes the column safe on legacy v1 rows that haven't run
  // migration yet — they read empty until v1→v2 populates them from disk.
  descriptionMd: text('description_md').notNull().default(''),
  score: real('score'),
  scoreJustification: text('score_justification'),
  status: text('status').$type<JobStatus>().notNull(),
  error: text('error').$type<JobError>(),
  appliedProfileId: text('applied_profile_id'),
  // β.10h: artifact paths replaced with booleans. Files live at convention
  // paths under `data/jobs/<jobDirName>/` (resolved via JobRepository
  // helpers); these flags say whether a given pipeline step has produced
  // its artifact. Cheaper to query, doesn't drift if the workspace moves.
  hasTailoredResume: integer('has_tailored_resume', { mode: 'boolean' }).notNull().default(false),
  hasTailoredCoverLetter: integer('has_tailored_cover_letter', { mode: 'boolean' }).notNull().default(false),
  hasScreenshots: integer('has_screenshots', { mode: 'boolean' }).notNull().default(false),
  hasOutreachDraft: integer('has_outreach_draft', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// batches
// ---------------------------------------------------------------------------

export const batches = sqliteTable('batches', {
  id: text('id').primaryKey(),                // wolf internal UUID
  batchId: text('batch_id').notNull(),        // external ID returned by the AI provider (Anthropic / OpenAI)
  type: text('type').$type<BatchType>().notNull(),
  aiProvider: text('ai_provider').$type<BatchAiProvider>().notNull(),
  model: text('model'),
  profileId: text('profile_id').notNull(),
  status: text('status').$type<BatchStatus>().notNull(),
  errorMessage: text('error_message'),
  submittedAt: text('submitted_at').notNull(),
  completedAt: text('completed_at'),
});

export const batchItems = sqliteTable('batch_items', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  customId: text('custom_id').notNull(),
  status: text('status').$type<BatchItemStatus>().notNull(),
  resultText: text('result_text'),
  errorMessage: text('error_message'),
  consumedAt: text('consumed_at'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

// ---------------------------------------------------------------------------
// inbox_items
// ---------------------------------------------------------------------------

export const inboxItems = sqliteTable('inbox_items', {
  id: text('id').primaryKey(),
  kind: text('kind').$type<InboxItemKind>().notNull(),
  source: text('source').notNull(),
  url: text('url'),
  title: text('title'),
  rawJson: text('raw_json').notNull(),
  rawSha256: text('raw_sha256').notNull(),
  status: text('status').$type<InboxItemStatus>().notNull(),
  jobId: text('job_id'),
  receivedAt: text('received_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  error: text('error'),
});

// ---------------------------------------------------------------------------
// background_ai_batches
// ---------------------------------------------------------------------------

export const backgroundAiBatches = sqliteTable('background_ai_batches', {
  id: text('id').primaryKey(),
  type: text('type').$type<BackgroundAiBatchType>().notNull(),
  status: text('status').$type<BackgroundAiBatchStatus>().notNull(),
  inputJson: text('input_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deadlineAt: text('deadline_at'),
  error: text('error'),
});

export const backgroundAiBatchShards = sqliteTable('background_ai_batch_shards', {
  id: text('id').primaryKey(),
  backgroundAiBatchId: text('background_ai_batch_id').notNull(),
  provider: text('provider').notNull(),
  providerBatchId: text('provider_batch_id'),
  status: text('status').$type<BackgroundAiBatchShardStatus>().notNull(),
  itemCount: integer('item_count').notNull(),
  nextPollAt: text('next_poll_at'),
  submittedAt: text('submitted_at'),
  completedAt: text('completed_at'),
  error: text('error'),
});

export const backgroundAiBatchItems = sqliteTable('background_ai_batch_items', {
  id: text('id').primaryKey(),
  backgroundAiBatchId: text('background_ai_batch_id').notNull(),
  shardId: text('shard_id'),
  subjectType: text('subject_type').$type<BackgroundAiBatchSubjectType>().notNull(),
  subjectId: text('subject_id').notNull(),
  status: text('status').$type<BackgroundAiBatchItemStatus>().notNull(),
  aiInputJson: text('ai_input_json').notNull(),
  debugJson: text('debug_json'),
  debugExpiresAt: text('debug_expires_at'),
  targetId: text('target_id'),
  error: text('error'),
});
