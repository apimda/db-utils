import { BasePostgresJsDao, mapperDefaults } from '@apimda/db-utils-core';
import { Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { DbType, auto, createdAt, id, mapping, updatedAt } from '../../core/src/mapping.js';
import { daoTest } from './dao-test-utils.js';
import { DbTestContext } from './db-test-context.js';

class Money {
  constructor(public amount: bigint, public currency: string) {}
}

interface TestObj {
  objId?: string;
  objName: string;
  isAdmin: boolean;
  myComp: {
    nestedOne: number;
    nestedTwo: number;
  };
  money: Money;
  sqlTest?: string;
  created?: Date;
  updated?: Date;
}

const testMapping = mapping<TestObj>('test_obj', mapperDefaults, {
  objId: id,
  objName: auto,
  isAdmin: auto,
  myComp: { nestedOne: auto, nestedTwo: auto },
  money: {
    columns: ['money_amount', 'money_currency'],
    mapper: {
      extractFromRow: (row: Record<string, DbType>) => {
        const amount = BigInt(row['money_amount'] as string);
        const currency = row['money_currency'] as string;
        return new Money(amount, currency);
      },
      applyToRow: (row: Record<string, DbType>, value: Money) => {
        row['money_amount'] = value.amount.toString();
        row['money_currency'] = value.currency;
      }
    }
  },
  sqlTest: {
    column: { sql: 'UPPER(sql_test)', name: 'sql_test' },
    mapper: {
      fromDb: rowVal => (rowVal ? (rowVal as string) : undefined),
      toDb: (value, sql) => (value ? sql`LOWER(${value})` : null)
    }
  },
  created: createdAt,
  updated: updatedAt
});

class TestObjDao extends BasePostgresJsDao<TestObj, string> {
  constructor(sql: Sql) {
    super(sql, testMapping);
  }
}

let context: DbTestContext;
let dao: TestObjDao;

beforeAll(async () => {
  context = await DbTestContext.create();
  await context.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  dao = new TestObjDao(context.sql);
});

beforeEach(async () => {
  await context.recreateTestSchema();
  await context.sql`CREATE TABLE test_obj 
  (
    obj_id      uuid          DEFAULT uuid_generate_v4()  NOT NULL,
    obj_name    varchar(100),
    is_admin    boolean,
    my_comp_nested_one int NOT NULL,
    my_comp_nested_two int NOT NULL, 
    money_amount bigint NOT NULL,
    money_currency text NOT NULL, 
    sql_test text,
    created     timestamptz   DEFAULT NOW()               NOT NULL,
    updated     timestamptz   DEFAULT NOW()               NOT NULL,
    PRIMARY KEY (obj_id)
  )`;
});

afterAll(async () => {
  await context.destroy();
});

describe(' DAO Tests', () => {
  test('Generic DAO Test', async () => {
    await daoTest<TestObj, string>(
      dao,
      () => ({
        objName: 'some name',
        isAdmin: true,
        myComp: { nestedOne: 1, nestedTwo: 2 },
        money: new Money(9007199254740991n, 'USD')
      }),
      entity => ({ ...entity, objName: 'new name', isAdmin: false, sqlTest: 'ALL UPPER CASE' })
    );
  });
});
