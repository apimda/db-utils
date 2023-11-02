/* eslint-disable @typescript-eslint/no-explicit-any */
import { Database } from 'better-sqlite3';
import { Mapping, SaveType } from '../mapping-impl.js';
import { SqlExpression, sql } from '../sql-expression.js';
import { createSqlGenerator } from '../sql-generator.js';
import { BetterSqliteDbType } from './better-sqlite-mapping.js';

export function createDao<
  TObject,
  TReadOnly extends keyof TObject,
  TMapping extends Mapping<BetterSqliteDbType, TObject, TReadOnly>,
>(idProperty: keyof TObject, mapping: TMapping, sqlite: Database) {
  type TId = TObject[typeof idProperty];
  type TSave = SaveType<TObject, TReadOnly>;

  const generator = createSqlGenerator<BetterSqliteDbType, TObject, TReadOnly, TMapping>(mapping);

  type Row = Record<string, BetterSqliteDbType>;

  const run = (sql: SqlExpression<BetterSqliteDbType>) => {
    return sqlite.prepare(sql.expression).run(sql.values);
  };

  const exec = (sql: SqlExpression<BetterSqliteDbType>) => {
    return sqlite.prepare(sql.expression).all(sql.values) as Row[];
  };

  const optionalResult = <TResult extends Partial<TObject> = TObject>(rows: Row[]) => {
    return rows.length ? generator.utils.fromRow<TResult>(rows[0]) : undefined;
  };

  const requiredResult = <TResult extends Partial<TObject> = TObject>(rows: Row[]) => {
    return generator.utils.fromRow<TResult>(rows[0]);
  };

  const whereIdEqualClause = (id: TId) => {
    const where = { [idProperty]: id } as Partial<TObject>;
    return generator.whereEqualClause(where);
  };

  const deleteById = (id: TId) => {
    const stmt = generator.deleteStatement(whereIdEqualClause(id));
    const result = run(stmt);
    return result.changes;
  };

  const findById = (id: TId) => {
    const stmt = generator.selectStatement(undefined, whereIdEqualClause(id));
    return optionalResult(exec(stmt));
  };

  const insert = (obj: TSave) => {
    const stmt = sql`${generator.insertStatement(obj)} RETURNING ${generator.columnsClause()}`;
    return requiredResult(exec(stmt));
  };

  const update = (id: TId, obj: TSave) => {
    const update = generator.updateStatement(obj, whereIdEqualClause(id));
    const stmt = sql`${update} RETURNING ${generator.columnsClause()}`;
    return requiredResult(exec(stmt));
  };

  return {
    deleteById,
    findById,
    insert,
    update,
  };
}
