// Bộ chuyển đổi: giao diện Cloudflare D1 (prepare/bind/first/all/run/batch) trên SQLite chạy trong trình duyệt (sql.js).
// Nhờ vậy toàn bộ mã máy chủ trong server/ chạy được nguyên vẹn khi lưu dữ liệu trên trình duyệt.

import type { Database, SqlValue } from "sql.js";

const toSql = (v: unknown): SqlValue => (v === undefined ? null : typeof v === "boolean" ? Number(v) : (v as SqlValue));

class LocalStatement implements D1PreparedStatement {
  constructor(
    private readonly db: LocalD1,
    private readonly sql: string,
    private readonly params: SqlValue[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new LocalStatement(this.db, this.sql, values.map(toSql));
  }

  async first<T>(): Promise<T | null> {
    return this.exec<T>().results[0] ?? null;
  }

  async all<T>(): Promise<D1Result<T>> {
    return this.exec<T>();
  }

  async run<T>(): Promise<D1Result<T>> {
    return this.exec<T>();
  }

  /** Chạy đồng bộ – batch() dựa vào điều này để gói nhiều câu lệnh trong một giao dịch. */
  exec<T>(): D1Result<T> {
    return this.db.query<T>(this.sql, this.params);
  }
}

export class LocalD1 implements D1Database {
  constructor(public raw: Database) {}

  prepare(sql: string): D1PreparedStatement {
    return new LocalStatement(this, sql);
  }

  query<T>(sql: string, params: SqlValue[]): D1Result<T> {
    const stmt = this.raw.prepare(sql);
    try {
      stmt.bind(params);
      const results: T[] = [];
      while (stmt.step()) results.push(stmt.getAsObject() as T);
      return { results, success: true, meta: { changes: this.raw.getRowsModified(), last_row_id: 0 } };
    } finally {
      stmt.free();
    }
  }

  /** Giống D1: các câu lệnh chạy trong một giao dịch, lỗi một câu thì huỷ cả lô. */
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.raw.exec("BEGIN");
    try {
      const out = statements.map((s) => (s as LocalStatement).exec<T>());
      this.raw.exec("COMMIT");
      return out;
    } catch (err) {
      this.raw.exec("ROLLBACK");
      throw err;
    }
  }
}
