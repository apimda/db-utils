/* eslint-disable @typescript-eslint/no-empty-function */
import { randomUUID } from 'node:crypto';
import postgres, { Sql } from 'postgres';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

export interface DbStartResult {
  url: string;
  container: StartedTestContainer;
}

export type DbContainerStarter = () => Promise<DbStartResult>;

export class DbTestContext {
  public static readonly DB_URL_ENV_KEY = '__DB_URL_ENV_KEY__';
  public static readonly GLOBAL_KEY = '__DB_GLOBAL_KEY__';

  public static readonly DEFAULT_CONTAINER_STARTER: DbContainerStarter = async () => {
    const dbPort = 5432;
    const pass = 'password';
    const container = await new GenericContainer('postgres:15')
      .withExposedPorts(5432)
      .withEnvironment({ POSTGRES_PASSWORD: pass })
      .start();
    const port = container.getMappedPort(dbPort);
    const url = `postgres://postgres:${pass}@localhost:${port}/postgres`;
    return {
      url,
      container
    };
  };

  public readonly sql: Sql;
  public readonly testSchemaName: string;

  public static async createGlobal(startContainer = DbTestContext.DEFAULT_CONTAINER_STARTER) {
    const result = await DbTestContext.create(startContainer);
    process.env[DbTestContext.DB_URL_ENV_KEY] = result.connectionUrl;
    (globalThis as any)[DbTestContext.GLOBAL_KEY] = result;
  }

  public static async destroyGlobal() {
    const context = (globalThis as any)[DbTestContext.GLOBAL_KEY] as DbTestContext | undefined;
    await context?.destroy();
  }

  /**
   * Create/initialize the test context, e.g. in beforeAll()
   * @param startContainer function to create/start the DB container
   * @returns test context instance
   */
  static async create(startContainer = DbTestContext.DEFAULT_CONTAINER_STARTER) {
    const urlEnv = process.env[DbTestContext.DB_URL_ENV_KEY];
    if (urlEnv) {
      return new DbTestContext(urlEnv);
    }
    const { container, url } = await startContainer();
    return new DbTestContext(url, container);
  }

  private constructor(public readonly connectionUrl: string, private readonly container?: StartedTestContainer) {
    this.testSchemaName = `test_` + randomUUID().replaceAll('-', '');
    this.sql = postgres(connectionUrl, {
      connection: {
        search_path: `${this.testSchemaName},public`
      },
      onnotice: () => {} // turn off notice logging - it would otherwise log schema messages that are okay
    });
  }

  /**
   * Destroy the context, e.g. in afterAll()
   */
  async destroy() {
    await this.sql.end();
    await this.container?.stop();
  }
}
