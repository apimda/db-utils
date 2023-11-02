/* eslint-disable @typescript-eslint/no-explicit-any */

import mysql from 'mysql2/promise';
import { Mapping, SaveType } from '../mapping-impl.js';
import { SqlExpression } from '../sql-expression.js';
import { createSqlGenerator } from '../sql-generator.js';
import { MySql2DbType } from './mysql2-mapping.js';

export function createDao<
  TObject,
  TReadOnly extends keyof TObject,
  TMapping extends Mapping<MySql2DbType, TObject, TReadOnly>,
>(idProperty: keyof TObject, mapping: TMapping, mySql: mysql.Connection) {
  type TId = TObject[typeof idProperty];
  type TSave = SaveType<TObject, TReadOnly>;

  const generator = createSqlGenerator<MySql2DbType, TObject, TReadOnly, TMapping>(mapping);

  // const results = <TResult extends Partial<TObject>>(rows: mysql.RowDataPacket[]) => {
  //   return rows.map((r) => generator.utils.fromRow<TResult>(r));
  // };

  const singleResult = <TResult extends Partial<TObject>>(rows: mysql.RowDataPacket[]) => {
    return rows.length ? generator.utils.fromRow<TResult>(rows[0]) : undefined;
  };

  const execute = async <
    T extends
      | mysql.ResultSetHeader
      | mysql.ResultSetHeader[]
      | mysql.RowDataPacket[]
      | mysql.RowDataPacket[][]
      | mysql.ProcedureCallPacket,
  >(
    sql: SqlExpression<MySql2DbType>,
  ) => {
    const result = await mySql.query<T>(sql.expression, sql.values);
    return result[0];
  };

  const whereIdEqualClause = (id: TId) => {
    const where = { [idProperty]: id } as Partial<TObject>;
    return generator.whereEqualClause(where);
  };

  const deleteById = async (id: TId) => {
    const stmt = generator.deleteStatement(whereIdEqualClause(id));
    const result = await execute<mysql.ResultSetHeader>(stmt);
    return result.affectedRows;
  };

  const findById = async (id: TId) => {
    const stmt = generator.selectStatement(undefined, whereIdEqualClause(id));
    const result = await execute<mysql.RowDataPacket[]>(stmt);
    return singleResult<TObject>(result);
  };

  const insert = async (obj: TSave) => {
    const stmt = generator.insertStatement(obj);
    const result = await execute<mysql.ResultSetHeader>(stmt);
    return result.insertId;
  };

  const update = async (id: TId, obj: TSave) => {
    const stmt = generator.updateStatement(obj, whereIdEqualClause(id));
    await execute<mysql.ResultSetHeader>(stmt);
  };

  return {
    deleteById,
    findById,
    insert,
    update,
    util: {
      execute,
    },
  };
}
