/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mapping, SaveType } from './mapping-impl.js';
import { SqlExpression, sqlIdentifier, sql as sqlTemplate, sqlUnsafe } from './sql-expression.js';

export function createSqlGenerator<
  TDbType,
  TObject,
  TReadOnly extends keyof TObject,
  TMapping extends Mapping<TDbType, TObject, TReadOnly>,
>(mapping: TMapping) {
  // type TDbType = InferDbType<TMapping>;
  // type TObject = InferObjectType<TMapping>;
  type TSave = SaveType<TObject, TReadOnly>;
  type TSql = SqlExpression<TDbType>;
  type TPropKey = keyof TObject;
  const sql = sqlTemplate<TDbType>;

  const sqlAppend = (expressions: TSql[], separator: string) => {
    const result = expressions.reduce((acc, expr) => {
      return acc ? sql`${acc}${sqlUnsafe(separator)}${expr}` : expr;
    });
    return result;
  };

  const fromRow = <TResult extends Partial<TObject>>(row: Record<string, TDbType>) => {
    const result: Record<string, any> = {};
    for (const prop in mapping.properties) {
      result[prop] = mapping.properties[prop].extractFromRow(row);
    }
    return result as TResult;
  };

  const toRow = (data: Partial<TObject>) => {
    const row: Record<string, TSql> = {};
    for (const key in data) {
      const propMapping = mapping.properties[key];
      propMapping.applyToRow(row, (data as any)[key]);
    }
    return row;
  };

  const whereEqualClause = (data: Partial<TObject>) => {
    const expressions: TSql[] = [];
    const row = toRow(data);
    for (const key in data) {
      const columns = mapping.properties[key].columns.map((c) => {
        return sql`${sqlIdentifier(c.name)}=${row[c.name]}`;
      });
      expressions.push(...columns);
    }
    return sqlAppend(expressions, ' AND ');
  };

  const allKeys = Object.keys(mapping.properties) as (keyof TObject)[];

  const columnsClause = (keys?: TPropKey[]) => {
    const columns: TSql[] = [];
    const keysToUse = keys ?? allKeys;
    for (const key of keysToUse) {
      const propMapping = mapping.properties[key];
      for (const column of propMapping.columns) {
        if (column.selectExpression) {
          columns.push(sql`${column.selectExpression} AS ${sqlIdentifier(column.name)}`);
        } else {
          columns.push(sql`${sqlIdentifier(column.name)}`);
        }
      }
    }
    return sqlAppend(columns, ', ');
  };

  const deleteStatement = (whereClause: TSql) => {
    return sql`DELETE FROM ${sqlIdentifier(mapping.tableName)} WHERE ${whereClause}`;
  };

  const selectStatement = (keys?: TPropKey[], whereClause?: TSql) => {
    const colsClause = columnsClause(keys);
    const selectBase = sql`SELECT ${colsClause} FROM ${sqlIdentifier(mapping.tableName)}`;
    return whereClause ? sql`${selectBase} WHERE ${whereClause}` : selectBase;
  };

  const insertStatement = (data: TSave) => {
    const into: TSql[] = [];
    const values: TSql[] = [];
    const row = toRow(data as unknown as Partial<TObject>);
    for (const key in data) {
      if (mapping.readOnlyProperties.includes(key as any)) {
        continue;
      }
      const propMapping = mapping.properties[key as TPropKey];
      for (const column of propMapping.columns) {
        into.push(sql`${sqlIdentifier(column.name)}`);
        values.push(sql`${row[column.name]}`);
      }
    }
    const intoClause = sqlAppend(into, ', ');
    const valuesClause = sqlAppend(values, ', ');
    return sql`INSERT INTO ${sqlIdentifier(mapping.tableName)} (${intoClause}) VALUES (${valuesClause})`;
  };

  const updateStatement = (data: Partial<TSave>, whereClause: TSql) => {
    const set: TSql[] = [];
    const row = toRow(data as unknown as Partial<TObject>);
    for (const key in data) {
      if (mapping.readOnlyProperties.includes(key as any)) {
        continue;
      }
      const propMapping = mapping.properties[key as TPropKey];
      for (const column of propMapping.columns) {
        set.push(sql`${sqlIdentifier(column.name)}=${row[column.name]}`);
      }
    }
    const setClause = sqlAppend(set, ', ');
    return sql`UPDATE ${sqlIdentifier(mapping.tableName)} SET ${setClause} WHERE ${whereClause}`;
  };

  return {
    deleteStatement,
    insertStatement,
    selectStatement,
    updateStatement,
    whereEqualClause,
    columnsClause,
    utils: { sqlAppend, fromRow, toRow },
  };
}
