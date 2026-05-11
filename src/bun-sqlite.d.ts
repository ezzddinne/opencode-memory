declare module "bun:sqlite" {
  export class Database {
    constructor(path: string, options?: { create?: boolean; readonly?: boolean });
    run(sql: string, ...params: unknown[]): void;
    query(sql: string, ...params: unknown[]): {
      all(...params: unknown[]): Record<string, unknown>[]
      get(...params: unknown[]): Record<string, unknown> | undefined
    }
    prepare(sql: string): {
      all(...params: unknown[]): Record<string, unknown>[]
      get(...params: unknown[]): Record<string, unknown> | undefined
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
    }
    exec(sql: string): void
    close(): void
  }
}
