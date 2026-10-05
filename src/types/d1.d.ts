// Kiểu tối thiểu của Cloudflare D1 để phần máy chủ (server/) chạy được trong trình duyệt ở chế độ lưu trên trình duyệt.
// Bản đầy đủ nằm ở @cloudflare/workers-types, chỉ dùng trong tsconfig.worker.json.
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
