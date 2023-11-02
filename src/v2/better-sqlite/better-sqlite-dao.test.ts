import Database from 'better-sqlite3';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { camelToSnake } from '../../utils.js';
import { InferSave, createMapping } from '../mapping-impl.js';
import { auto } from '../mapping.js';
import { sql, sqlIdentifier } from '../sql-expression.js';
import { createDao } from './better-sqlite-dao.js';
import { BetterSqliteDbType } from './better-sqlite-mapping.js';

class Money {
  constructor(
    public amount: bigint,
    public currency: string,
  ) {}
}

interface TestObj {
  objId: number;
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

const testMapping = createMapping<BetterSqliteDbType, TestObj, 'objId' | 'created' | 'updated'>(
  'test_table',
  {
    objId: auto,
    objOptional: auto,
    objName: auto,
    isAdmin: { column: 'is_admin', fromDb: (dbValue) => !!dbValue, toDb: (value) => (value ? 1 : 0) },
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
      column: { selectExpression: sql<BetterSqliteDbType>`UPPER(${sqlIdentifier('sql_test')})`, name: 'sql_test' },
      fromDb: (dbValue) => (dbValue ? (dbValue as Uppercase<string>) : undefined),
      toDb: (value) => (value ? sql`LOWER(${value})` : null),
    },
    mappedAuto: {
      column: auto,
      fromDb: (dbValue) => BigInt(dbValue as number), // see defaultSafeIntegers() for bigint handling in better-sqlite3
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

const sqlite = new Database(':memory:');

// TODO test json, array columns
beforeEach(() => {
  sqlite.exec(`DROP TABLE IF EXISTS test_table`);
  sqlite.exec(`CREATE TABLE test_table
  (
      obj_id         INTEGER                        NOT NULL PRIMARY KEY AUTOINCREMENT,
      obj_name       TEXT                           NOT NULL,
      obj_optional   TEXT,
      is_admin       INTEGER,
      nested_one     INTEGER                        NOT NULL,
      nested_two     INTEGER                        NOT NULL,
      money_amount   INTEGER                        NOT NULL,
      money_currency TEXT                           NOT NULL,
      sql_test       TEXT,
      mapped_auto    INTEGER                        NOT NULL,
      created        TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated        TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
});

afterAll(() => {
  sqlite.close();
});

describe(' DAO Tests', () => {
  test('CRUD', () => {
    const dao = createDao<TestObj, 'objId' | 'created' | 'updated', typeof testMapping>('objId', testMapping, sqlite);
    const inserted = dao.insert(testSaveData);
    const found = dao.findById(inserted.objId);
    expect(found).toEqual(inserted);

    const updated = dao.update(inserted.objId, { ...inserted, objName: 'updated' });
    const foundUpdated = dao.findById(inserted.objId);
    expect(foundUpdated).toEqual(updated);

    const deleted = dao.deleteById(inserted.objId);
    expect(deleted).toEqual(1);
    const foundDeleted = dao.findById(inserted.objId);
    expect(foundDeleted).toBeUndefined();
  });
});
