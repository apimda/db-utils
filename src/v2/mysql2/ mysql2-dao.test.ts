import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { camelToSnake } from '../../utils.js';
import { InferSave, createMapping } from '../mapping-impl.js';
import { auto } from '../mapping.js';
import { sql, sqlIdentifier } from '../sql-expression.js';
import { createDao } from './mysql2-dao.js';
import { MySql2DbType } from './mysql2-mapping.js';

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

const testMapping = createMapping<MySql2DbType, TestObj, 'objId' | 'created' | 'updated'>(
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
const dbPort = 3306;
const dbName = `test_${randomUUID()}`;
const user = 'test_user';
const pass = 'password';
const container = await new GenericContainer('mysql:8.0')
  .withExposedPorts(dbPort)
  .withEnvironment({
    MYSQL_ROOT_PASSWORD: pass,
    MYSQL_DATABASE: dbName,
    MYSQL_USER: user,
    MYSQL_PASSWORD: pass,
  })
  .start();
const port = container.getMappedPort(dbPort);
const url = `mysql://root:${pass}@localhost:${port}/${dbName}`;
const mySql = await mysql.createConnection(url);

// TODO test json, array columns
beforeEach(async () => {
  await mySql.query(`DROP TABLE IF EXISTS test_table CASCADE`);
  await mySql.query(`CREATE TABLE test_table 
  (
    obj_id              BIGINT                       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    obj_name            VARCHAR(100)                 NOT NULL,
    obj_optional        VARCHAR(100),
    is_admin            BOOLEAN,
    nested_one          INT                          NOT NULL,
    nested_two          INT                          NOT NULL, 
    money_amount        BIGINT                       NOT NULL,
    money_currency      CHAR(3)                      NOT NULL, 
    sql_test            VARCHAR(255),
    mapped_auto         BIGINT                       NOT NULL,
    created             DATETIME   DEFAULT (NOW())   NOT NULL,
    updated             DATETIME   DEFAULT (NOW())   NOT NULL ON UPDATE CURRENT_TIMESTAMP
  )`);
});

afterAll(async () => {
  await mySql.end();
  await container?.stop();
});

describe(' DAO Tests', () => {
  test('CRUD', async () => {
    const dao = createDao<TestObj, 'objId' | 'created' | 'updated', typeof testMapping>('objId', testMapping, mySql);
    const id = await dao.insert(testSaveData);
    let found = (await dao.findById(id))!;
    expect(found).toEqual({ ...found, ...testSaveData });

    const objName = 'updatedName';
    await dao.update(id, { ...testSaveData, objName });
    found = (await dao.findById(id))!;
    expect(found).toEqual({ ...found, objName });

    const deleted = await dao.deleteById(id);
    expect(deleted).toEqual(1);
    expect(await dao.findById(id)).toBeUndefined();
  });
});
