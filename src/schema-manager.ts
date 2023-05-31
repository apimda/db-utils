import { Sql } from 'postgres';

export interface SchemaManager {
  /**
   * Perform database-wide initialization steps, e.g. installing extensions.
   * @param sql Postgres.js sql connection
   */
  initializeDatabase(sql: Sql): Promise<void>;

  /**
   * Create schema with specified name, including tables, views, triggers, etc.
   * @param sql Postgres.js sql connection
   * @param schemaName name of schema to create
   */
  createSchema(sql: Sql, schemaName: string): Promise<void>;

  /**
   * Drop schema with specified name
   * @param sql Postgres.js sql connection
   * @param schemaName name of schema to create
   */
  dropSchema(sql: Sql, schemaName: string): Promise<void>;
}
