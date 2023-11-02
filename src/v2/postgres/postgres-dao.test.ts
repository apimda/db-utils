import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { camelToSnake } from '../../utils.js';
import { InferSave, createMapping } from '../mapping-impl.js';
import { auto } from '../mapping.js';
import { sql, sqlIdentifier } from '../sql-expression.js';
import { createDao } from './postgres-dao.js';
import { PostgresJsDbType } from './postgres-mapping.js';

class Money {
  constructor(
    public amount: bigint,
    public currency: string,
  ) {}
}

interface TestObj {
  objId: string;
  objName: string;
  objOptional?: string;
  isAdmin: boolean;
  nested: {
    nestedOne: number;
    nestedTwo: number;
  };
  money: Money;
  sqlTest?: Uppercase<string>;
  mappedAuto: bigint;
  created: Date;
  updated: Date;
}

const autoConfig = {
  propertyNameToColumnName: (propName: string) => camelToSnake(propName),
};

const testMapping = createMapping<PostgresJsDbType, TestObj, 'objId' | 'created' | 'updated'>(
  'test_table',
  {
    objId: auto,
    objOptional: auto,
    objName: auto,
    isAdmin: 'is_admin',
    nested: {
      columns: ['nested_one', 'nested_two'],
      extractFromRow: (row) => {
        const nestedOne = row['nested_one'] as number;
        const nestedTwo = row['nested_two'] as number;
        return { nestedOne, nestedTwo };
      },
      applyToRow: (row, value) => {
        row['nested_one'] = sql`${value.nestedOne}`;
        row['nested_two'] = sql`${value.nestedTwo}`;
      },
    },
    money: {
      columns: ['money_amount', 'money_currency'],
      extractFromRow: (row) => {
        const amount = BigInt(row['money_amount'] as string);
        const currency = row['money_currency'] as string;
        return new Money(amount, currency);
      },
      applyToRow: (row, value) => {
        row['money_amount'] = sql`${value.amount.toString()}`;
        row['money_currency'] = sql`${value.currency}`;
      },
    },
    sqlTest: {
      column: { selectExpression: sql`UPPER(${sqlIdentifier('sql_test')})`, name: 'sql_test' },
      fromDb: (dbValue) => (dbValue ? (dbValue as Uppercase<string>) : undefined),
      toDb: (value) => (value ? sql`LOWER(${value})` : null),
    },
    mappedAuto: {
      column: auto,
      fromDb: (dbValue) => BigInt(dbValue as string),
      toDb: (value) => value.toString(),
    },
    created: auto,
    updated: auto,
  },
  ['objId', 'created', 'updated'],
  autoConfig,
);

const testSaveData: InferSave<typeof testMapping> = {
  objName: 'test',
  isAdmin: true,
  nested: { nestedOne: 1, nestedTwo: 2 },
  money: new Money(100n, 'EUR'),
  sqlTest: 'TEST',
  mappedAuto: 123n,
};

// TODO: move this to a utility class
const dbPort = 5432;
const pass = 'password';
const container = await new GenericContainer('postgres:15')
  .withExposedPorts(5432)
  .withEnvironment({ POSTGRES_PASSWORD: pass })
  .start();
const port = container.getMappedPort(dbPort);
const url = `postgres://postgres:${pass}@localhost:${port}/postgres`;
const testSchemaName = `test_` + randomUUID().replaceAll('-', '');
const pgSql = postgres(url, {
  connection: {
    search_path: `${testSchemaName},public`,
  },
  onnotice: () => {}, // turn off notice logging - it would otherwise log schema messages that are okay
});
await pgSql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

// TODO test json, array columns
beforeEach(async () => {
  await pgSql`DROP SCHEMA IF EXISTS ${pgSql(testSchemaName)} CASCADE`;
  await pgSql`CREATE SCHEMA ${pgSql(testSchemaName)}`;
  await pgSql`CREATE TABLE test_table 
  (
    obj_id              uuid          DEFAULT uuid_generate_v4()  NOT NULL,
    obj_name            varchar(100)                              NOT NULL,
    obj_optional        varchar(100),
    is_admin            boolean,
    nested_one          int                                       NOT NULL,
    nested_two          int                                       NOT NULL, 
    money_amount        bigint                                    NOT NULL,
    money_currency      text                                      NOT NULL, 
    sql_test            text,
    mapped_auto         bigint                                    NOT NULL,
    created             timestamptz   DEFAULT NOW()               NOT NULL,
    updated             timestamptz   DEFAULT NOW()               NOT NULL,
    PRIMARY KEY (obj_id)
  )`;
});

afterAll(async () => {
  await pgSql.end();
  await container?.stop();
});

describe(' DAO Tests', () => {
  test('CRUD', async () => {
    const dao = createDao<TestObj, 'objId' | 'created' | 'updated', typeof testMapping>('objId', testMapping, pgSql);
    const inserted = await dao.insert(testSaveData);
    const found = await dao.findById(inserted.objId);
    expect(found).toEqual(inserted);

    const updated = await dao.update(inserted.objId, { ...inserted, objName: 'updated' });
    const foundUpdated = await dao.findById(inserted.objId);
    expect(foundUpdated).toEqual(updated);

    const deleted = await dao.deleteById(inserted.objId);
    expect(deleted).toEqual(1);
    const foundDeleted = await dao.findById(inserted.objId);
    expect(foundDeleted).toBeUndefined();
  });
});
