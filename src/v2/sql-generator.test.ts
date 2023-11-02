import { describe, expect, test } from 'vitest';
import { camelToSnake } from '../utils.js';
import { InferSave, createMapping } from './mapping-impl.js';
import { auto } from './mapping.js';
import { sql, sqlIdentifier } from './sql-expression.js';
import { createSqlGenerator } from './sql-generator.js';
export type TestDbType = string | number | boolean | object | null;

export class Money {
  constructor(
    public amount: bigint,
    public currency: string,
  ) {}
}

export interface TestObj {
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

export const testMapping = createMapping<TestDbType, TestObj, 'objId' | 'created' | 'updated'>(
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

export const testSaveData: InferSave<typeof testMapping> = {
  objName: 'test',
  isAdmin: true,
  nested: { nestedOne: 1, nestedTwo: 2 },
  money: new Money(100n, 'EUR'),
  sqlTest: 'TEST',
  mappedAuto: 123n,
};

// TODO generics are getting ridiculous - need to simplify
const generator = createSqlGenerator<TestDbType, TestObj, 'objId' | 'created' | 'updated', typeof testMapping>(
  testMapping,
);

describe('whereEqual', () => {
  test('single column property', () => {
    const expr = generator.whereEqualClause({ objId: '123' });
    expect(expr.expression).toBe('obj_id=?');
    expect(expr.values).toEqual(['123']);
  });
  test('multi-column property', () => {
    const expr = generator.whereEqualClause({ money: new Money(100n, 'EUR') });
    expect(expr.expression).toBe('money_amount=? AND money_currency=?');
    expect(expr.values).toEqual(['100', 'EUR']);
  });
  test('multi-column property', () => {
    const expr = generator.whereEqualClause({ money: new Money(100n, 'EUR'), sqlTest: 'TEST' });
    expect(expr.expression).toBe('money_amount=? AND money_currency=? AND sql_test=LOWER(?)');
    expect(expr.values).toEqual(['100', 'EUR', 'TEST']);
  });
});

describe('selectClause', () => {
  test('simple SELECT', () => {
    const expr = generator.selectStatement(['objId']);
    expect(expr.expression).toBe('SELECT obj_id FROM test_table');
    expect(expr.values).toEqual([]);
  });
  test('simple SELECT w/where', () => {
    const expr = generator.selectStatement(['objId'], sql`1=${1}`);
    expect(expr.expression).toBe('SELECT obj_id FROM test_table WHERE 1=?');
    expect(expr.values).toEqual([1]);
  });
  test('multi-column SELECT', () => {
    const expr = generator.selectStatement(['objId', 'money', 'sqlTest']);
    expect(expr.expression).toBe(
      'SELECT obj_id, money_amount, money_currency, UPPER(sql_test) AS sql_test FROM test_table',
    );
    expect(expr.values).toEqual([]);
  });
});

describe('deleteClause', () => {
  test('simple DELETE', () => {
    const expr = generator.deleteStatement(sql`1=${1}`);
    expect(expr.expression).toBe('DELETE FROM test_table WHERE 1=?');
    expect(expr.values).toEqual([1]);
  });
});

describe('insertClause', () => {
  test('INSERT', () => {
    const expr = generator.insertStatement(testSaveData);
    expect(expr.expression).toBe(
      'INSERT INTO test_table ' +
        '(obj_name, is_admin, nested_one, nested_two, money_amount, money_currency, sql_test, mapped_auto) ' +
        'VALUES (?, ?, ?, ?, ?, ?, LOWER(?), ?)',
    );
    expect(expr.values).toEqual(['test', true, 1, 2, '100', 'EUR', 'TEST', '123']);
  });
});

describe('updateClause', () => {
  test('partial UPDATE', () => {
    const expr = generator.updateStatement({ objName: 'updatedName' }, sql`1=${1}`);
    expect(expr.expression).toBe('UPDATE test_table SET obj_name=? WHERE 1=?');
    expect(expr.values).toEqual(['updatedName', 1]);
  });
  test('full UPDATE', () => {
    const expr = generator.updateStatement(testSaveData, sql`1=1`);
    expect(expr.expression).toBe(
      'UPDATE test_table SET ' +
        'obj_name=?, is_admin=?, nested_one=?, nested_two=?, money_amount=?, ' +
        'money_currency=?, sql_test=LOWER(?), mapped_auto=? ' +
        'WHERE 1=1',
    );
    expect(expr.values).toEqual(['test', true, 1, 2, '100', 'EUR', 'TEST', '123']);
  });
});
