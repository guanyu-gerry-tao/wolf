/**
 * schema.ts — Drizzle ORM table definitions.
 *
 * This is the single source of truth for the database schema.
 * TypeScript types for all rows are inferred from here — no manual mapping needed.
 */

import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import type { CompanySize } from '../types/index.js';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
  linkedinUrl: text('linkedinUrl'),
  size: integer('size').$type<CompanySize | null>(),
  industry: text('industry'),
  headquartersLocation: text('headquartersLocation'),
  notes: text('notes'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  companyId: text('companyId').notNull(),
  url: text('url').notNull(),
  source: text('source').notNull(),
  description: text('description').notNull(),
  location: text('location').notNull(),
  remote: integer('remote', { mode: 'boolean' }).notNull(),
  salary: text('salary', { mode: 'json' }).$type<number | 'unpaid' | null>(),
  workAuthorizationRequired: text('workAuthorizationRequired'),
  score: real('score'),
  scoreJustification: text('scoreJustification'),
  status: text('status').notNull(),
  appliedProfileId: text('appliedProfileId'),
  tailoredResumePath: text('tailoredResumePath'),
  tailoredResumePdfPath: text('tailoredResumePdfPath'),
  coverLetterPath: text('coverLetterPath'),
  coverLetterPdfPath: text('coverLetterPdfPath'),
  screenshotPath: text('screenshotPath'),
  outreachDraftPath: text('outreachDraftPath'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

export const batches = sqliteTable('batches', {
  id: text('id').primaryKey(),
  batchId: text('batchId').notNull(),
  type: text('type').notNull(),
  aiProvider: text('aiProvider').notNull(),
  profileId: text('profileId').notNull(),
  status: text('status').notNull(),
  submittedAt: text('submittedAt').notNull(),
  completedAt: text('completedAt'),
});
