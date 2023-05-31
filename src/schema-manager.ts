export interface SchemaManager {
  /**
   * Perform database-wide initialization steps, e.g. installing extensions.
   */
  initializeDatabase(): Promise<void>;

  /**
   * Create schema with specified name, including tables, views, triggers, etc.
   * @param schemaName name of schema to create
   */
  createSchema(schemaName?: string): Promise<void>;

  /**
   * Drop schema with specified name
   * @param schemaName name of schema to create
   */
  dropSchema(schemaName?: string): Promise<void>;
}
