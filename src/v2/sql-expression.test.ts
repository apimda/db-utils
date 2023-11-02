import { describe, expect, test } from 'vitest';
import { sql, sqlIdentifier, sqlUnsafe } from './sql-expression.js';

type MyDbType = string | number | boolean | object | null;

describe('SQL Expression Tests', () => {
  test('simplest expression possible', () => {
    const expr = sql<MyDbType>`SELECT * FROM my_table`;
    expect(expr.expression).toBe('SELECT * FROM my_table');
    expect(expr.values).toEqual([]);
  });
  test('single parameter expression', () => {
    const expr = sql<MyDbType>`SELECT * FROM my_table WHERE id = ${123}`;
    expect(expr.expression).toBe('SELECT * FROM my_table WHERE id = ?');
    expect(expr.values).toEqual([123]);
  });
  test('single parameter expression w/identifier', () => {
    const expr = sql<MyDbType>`SELECT * FROM my_table WHERE ${sqlIdentifier('id')} = ${123}`;
    expect(expr.expression).toBe(`SELECT * FROM my_table WHERE id = ?`);
    expect(expr.values).toEqual([123]);
  });
  test('single parameter expression w/unsafe', () => {
    const expr = sql<MyDbType>`SELECT * FROM my_table WHERE ${sqlUnsafe('id')} = ${123}`;
    expect(expr.expression).toBe(`SELECT * FROM my_table WHERE id = ?`);
    expect(expr.values).toEqual([123]);
  });
  test('expression with multiple parameters', () => {
    const name = 'John';
    const age = 30;
    const expr = sql<MyDbType>`SELECT * FROM my_table WHERE name = ${name} AND age = ${age} ORDER BY name ASC`;
    expect(expr.expression).toBe('SELECT * FROM my_table WHERE name = ? AND age = ? ORDER BY name ASC');
    expect(expr.values).toEqual([name, age]);
  });
  test('expression with sub-expressions', () => {
    const name = 'John';
    const age = 30;
    const lowerNameExpr = sql<MyDbType>`LOWER(${name})`;
    const expr = sql<MyDbType>`SELECT * FROM my_table WHERE name = ${lowerNameExpr} AND age = ${age} ORDER BY name ASC`;
    expect(expr.expression).toBe('SELECT * FROM my_table WHERE name = LOWER(?) AND age = ? ORDER BY name ASC');
    expect(expr.values).toEqual([name, age]);
  });
});
