import { and, eq, inArray } from 'drizzle-orm';
import type { CompanyRepository } from '../company.js';
import type { Company, CompanyQuery, CompanyUpdate } from '../../types/company.js';
import type { DrizzleDb } from './drizzleDb.js';
import { companies } from './schema.js';

export class SqliteCompanyRepository implements CompanyRepository {
  constructor(private readonly db: DrizzleDb) {}

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

    const rows = await (q.limit !== undefined
      ? this.db
          .select()
          .from(companies)
          .where(and(...conditions))
          .limit(q.limit)
      : this.db
          .select()
          .from(companies)
          .where(and(...conditions)));

    return rows.map(rowToCompany);
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
