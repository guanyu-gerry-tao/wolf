import path from 'node:path';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { and, eq, inArray, like } from 'drizzle-orm';
import type { CompanyRepository } from '../companyRepository.js';
import type { Company, CompanyQuery, CompanyUpdate } from '../../types/company.js';
import type { DrizzleDb } from './drizzleDb.js';
import { companies } from './schema.js';
import { companyDir } from '../../utils/workspacePaths.js';

// Self-documenting header for freshly created info.md files. Same GitHub-Alert
// blockquote convention as resume_pool.md and hint.md — stripComments removes
// `> [!XYZ]` blocks before any AI sees the file.
const INFO_FILE_HEADER = `> [!TIP]
> info.md - Free-form notes about this company.
>
> Any prose below this alert block is stored per-company and carried forward
> for future jobs at the same employer (e.g. interview feedback, product notes,
> culture observations). This alert block is user-only and stripped before
> the AI sees this file (see stripComments).

`;

/**
 * Persists company rows in SQLite and keeps a companion info.md file at
 * `<workspace>/data/companies/<name>_<companyIdShort>/info.md`. The info.md
 * is auto-created on upsert so users always have a well-known place to drop notes.
 */
export class SqliteCompanyRepositoryImpl implements CompanyRepository {
  constructor(
    private readonly db: DrizzleDb,
    private readonly workspaceDir: string,
  ) {}

  async get(id: string): Promise<Company | null> {
    const rows = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    return rows.length > 0 ? rowToCompany(rows[0]) : null;
  }

  async getByName(name: string): Promise<Company | null> {
    const rows = await this.db
      .select()
      .from(companies)
      .where(eq(companies.name, name))
      .limit(1);
    return rows.length > 0 ? rowToCompany(rows[0]) : null;
  }

  async upsert(company: Company): Promise<void> {
    await this.db
      .insert(companies)
      .values(companyToRow(company))
      .onConflictDoUpdate({
        target: companies.id,
        set: {
          name: company.name,
          domain: company.domain ?? undefined,
          linkedinUrl: company.linkedinUrl ?? undefined,
          size: company.size ?? undefined,
          industry: company.industry ?? undefined,
          headquartersLocation: company.headquartersLocation ?? undefined,
          notes: company.notes ?? undefined,
          updatedAt: company.updatedAt,
        },
      });
    // Ensure info.md exists even for brand-new rows; preserve existing content.
    await this.ensureInfoFile(company.id, company.name);
  }

  async update(id: string, patch: CompanyUpdate): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(companies)
      .set({ ...patch, updatedAt: now })
      .where(eq(companies.id, id));
  }

  async query(q: CompanyQuery): Promise<Company[]> {
    const conditions = [];

    if (q.size !== undefined) {
      if (Array.isArray(q.size)) {
        conditions.push(inArray(companies.size, q.size));
      } else {
        conditions.push(eq(companies.size, q.size));
      }
    }

    if (q.industry !== undefined) {
      conditions.push(eq(companies.industry, q.industry));
    }

    // Substring match on name — pushes the filter to SQL instead of the
    // old pattern of loading every row and filtering in JS. `like` on a
    // TEXT column in SQLite is case-insensitive for ASCII by default.
    //
    // Trim first so callers passing whitespace-only input (e.g. a future
    // `wolf company list --name "   "`) don't end up with `LIKE '%   %'`
    // silently matching rows whose name happens to contain spaces.
    if (q.nameContains !== undefined) {
      const needle = q.nameContains.trim();
      if (needle.length > 0) {
        const pattern = `%${needle}%`;
        conditions.push(like(companies.name, pattern));
      }
    }

    const baseQuery = this.db.select().from(companies).where(and(...conditions));
    const rows = q.limit !== undefined
      ? await baseQuery.limit(q.limit)
      : await baseQuery;

    return rows.map(rowToCompany);
  }

  async getWorkspaceDir(id: string): Promise<string> {
    const company = await this.get(id);
    if (!company) throw new Error(`Company not found: ${id}`);
    return companyDir(this.workspaceDir, company.name, id);
  }

  async readInfo(id: string): Promise<string> {
    const dir = await this.getWorkspaceDir(id);
    try {
      return await readFile(path.join(dir, 'info.md'), 'utf-8');
    } catch (err: unknown) {
      // Missing file is expected when a company has no notes yet.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
      throw err;
    }
  }

  // Writes the header-only template if the file does not yet exist. Never
  // overwrites user-authored content.
  private async ensureInfoFile(companyId: string, companyName: string): Promise<void> {
    const dir = companyDir(this.workspaceDir, companyName, companyId);
    const infoPath = path.join(dir, 'info.md');
    const exists = await access(infoPath).then(() => true).catch(() => false);
    if (exists) return;
    await mkdir(dir, { recursive: true });
    await writeFile(infoPath, INFO_FILE_HEADER, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

type CompanyRow = typeof companies.$inferSelect;

function rowToCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain ?? null,
    linkedinUrl: row.linkedinUrl ?? null,
    size: row.size ?? null,
    industry: row.industry ?? null,
    headquartersLocation: row.headquartersLocation ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function companyToRow(company: Company): typeof companies.$inferInsert {
  return {
    id: company.id,
    name: company.name,
    domain: company.domain ?? undefined,
    linkedinUrl: company.linkedinUrl ?? undefined,
    size: company.size ?? undefined,
    industry: company.industry ?? undefined,
    headquartersLocation: company.headquartersLocation ?? undefined,
    notes: company.notes ?? undefined,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
