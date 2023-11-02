/* eslint-disable @typescript-eslint/no-explicit-any */

import { Row, RowList, Sql } from 'postgres';
import { Mapping, SaveType } from '../mapping-impl.js';
import { SqlExpression, sql } from '../sql-expression.js';
import { createSqlGenerator } from '../sql-generator.js';
import { PostgresJsDbType } from './postgres-mapping.js';

export function createDao<
  TObject,
  TReadOnly extends keyof TObject,
  TMapping extends Mapping<PostgresJsDbType, TObject, TReadOnly>,
>(idProperty: keyof TObject, mapping: TMapping, pgSql: Sql) {
  type TId = TObject[typeof idProperty];
  type TSave = SaveType<TObject, TReadOnly>;

  const generator = createSqlGenerator<PostgresJsDbType, TObject, TReadOnly, TMapping>(mapping);

  // const results = <TResult extends Partial<TObject>>(rows: RowList<Row[]>) => {
  //   return rows.map((r) => generator.utils.fromRow<TResult>(r));
  // };

  const singleResult = <TResult extends Partial<TObject>>(rows: RowList<Row[]>) => {
    return rows.length ? generator.utils.fromRow<TResult>(rows[0]) : undefined;
  };

  const replaceParamMarkers = (expr: string) => {
    let result = expr;
    let cnt = 0;
    while (result.includes('?')) {
      result = result.replace('?', `$${++cnt}`);
    }
    return result;
  };

  const execute = async (sql: SqlExpression<PostgresJsDbType>) => {
    return await pgSql.unsafe(replaceParamMarkers(sql.expression), sql.values as any);
  };

  const whereIdEqualClause = (id: TId) => {
    const where = { [idProperty]: id } as Partial<TObject>;
    return generator.whereEqualClause(where);
  };

  const deleteById = async (id: TId) => {
    const stmt = generator.deleteStatement(whereIdEqualClause(id));
    const result = await execute(stmt);
    return result.count;
  };

  const findById = async (id: TId) => {
    const stmt = generator.selectStatement(undefined, whereIdEqualClause(id));
    const result = await execute(stmt);
    return singleResult<TObject>(result);
  };

  const insert = async (obj: TSave) => {
    const stmt = sql`${generator.insertStatement(obj)} RETURNING ${generator.columnsClause()}`;
    const result = await execute(stmt);
    return generator.utils.fromRow(result[0]) as TObject;
  };

  const update = async (id: TId, obj: TSave) => {
    const update = generator.updateStatement(obj, whereIdEqualClause(id));
    const result = await execute(sql`${update} RETURNING ${generator.columnsClause()}`);
    return generator.utils.fromRow(result[0]) as TObject;
  };

  return {
    deleteById,
    findById,
    insert,
    update,
  };
}
