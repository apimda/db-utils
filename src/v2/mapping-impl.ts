/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AutoConfig,
  Column,
  MappingDef,
  MultiColumnPropertyDef,
  PropertyDef,
  SingleColumnPropertyDef,
  auto,
  identityAutoConfig,
} from './mapping.js';
import { SqlExpression, isSqlExpression, sql } from './sql-expression.js';

export interface PropertyMapping<TDbType, TValue> {
  columns: Column<TDbType>[];
  readOnly: boolean;
  extractFromRow: (row: Record<string, TDbType>) => TValue;
  applyToRow: (row: Record<string, SqlExpression<TDbType>>, value: TValue) => void;
}

function toColumn(
  columnDef: typeof auto | string | Column<any>,
  propertyName: string,
  autoConfig: AutoConfig,
): Column<any> {
  if (typeof columnDef === 'string') {
    const name = columnDef;
    return { name };
  } else if (columnDef === auto) {
    const name = autoConfig.propertyNameToColumnName(propertyName);
    return { name };
  } else {
    return columnDef;
  }
}

function toSqlExpression(value: any | SqlExpression<any>): SqlExpression<any> {
  if (value && typeof value === 'object') {
    if (isSqlExpression(value)) {
      return value;
    } else {
      return sql`${value}}`;
    }
  } else {
    return sql`${value}`;
  }
}

function fromAutoPropertyDef(propertyName: string, autoConfig: AutoConfig, readOnly: boolean) {
  const column = toColumn(auto, propertyName, autoConfig);
  return {
    columns: [column],
    readOnly,
    extractFromRow: (row: Record<string, any>) => row[column.name],
    applyToRow: (row: Record<string, SqlExpression<any>>, value: any) => {
      row[column.name] = sql`${value}`;
    },
  };
}

function fromStringPropertyDef(columnName: string, readOnly: boolean) {
  return {
    columns: [{ name: columnName }],
    readOnly,
    extractFromRow: (row: Record<string, any>) => row[columnName],
    applyToRow: (row: Record<string, SqlExpression<any>>, value: any) => {
      row[columnName] = sql`${value}`;
    },
  };
}

function fromSingleColumnPropertyDef(
  def: SingleColumnPropertyDef<any, any>,
  propertyName: string,
  autoConfig: AutoConfig,
  readOnly: boolean,
) {
  const column = toColumn(def.column, propertyName as string, autoConfig);
  return {
    columns: [column],
    readOnly,
    extractFromRow: (row: Record<string, any>) => {
      const dbValue = row[column.name];
      return def.fromDb ? def.fromDb(dbValue) : dbValue;
    },
    applyToRow: (row: Record<string, SqlExpression<any>>, value: any) => {
      const dbValue = def.toDb ? def.toDb(value) : value;
      row[column.name] = toSqlExpression(dbValue);
    },
  };
}

function fromMultiColumnPropertyDef(def: MultiColumnPropertyDef<any, any>, readOnly: boolean) {
  return {
    columns: def.columns.map((columnDef) =>
      typeof columnDef === 'string' ? ({ name: columnDef } as Column<any>) : columnDef,
    ),
    readOnly,
    extractFromRow: def.extractFromRow,
    applyToRow: def.applyToRow,
  };
}

function fromPropertyDef(def: PropertyDef<any, any>, propertyName: string, autoConfig: AutoConfig, readOnly: boolean) {
  if (def === auto) {
    return fromAutoPropertyDef(propertyName, autoConfig, readOnly);
  } else if (typeof def === 'string') {
    return fromStringPropertyDef(def, readOnly);
  } else if (typeof def === 'object') {
    if ('column' in def) {
      return fromSingleColumnPropertyDef(def, propertyName, autoConfig, readOnly);
    } else if ('columns' in def) {
      return fromMultiColumnPropertyDef(def, readOnly);
    }
  }
  throw new Error(`Unexpected property mapping definition`);
}

export function createMapping<TDbType, TObject, TReadOnly extends keyof TObject>(
  tableName: string,
  def: MappingDef<TDbType, TObject>,
  readOnlyProperties: readonly TReadOnly[],
  autoConfig: AutoConfig = identityAutoConfig,
) {
  const mappings: Record<string, PropertyMapping<TDbType, any>> = {};
  for (const propertyName in def) {
    const propertyDef = def[propertyName];
    const readOnly = readOnlyProperties.includes(propertyName as any);
    const mapping = fromPropertyDef(propertyDef, propertyName, autoConfig, readOnly);
    mappings[propertyName] = mapping;
  }
  // TODO validation, e.g. no duplicate column names
  return {
    def,
    tableName,
    readOnlyProperties,
    properties: mappings as PropertyMappings<TDbType, TObject>,
  };
}

export type PropertyMappings<TDbType, TObject> = {
  [TKey in keyof Required<TObject>]: PropertyMapping<TDbType, TObject[TKey]>;
};

export type Mapping<TDbType, TObject, TReadOnly extends keyof TObject> = {
  tableName: string;
  def: MappingDef<TDbType, TObject>;
  readOnlyProperties: readonly TReadOnly[];
  properties: PropertyMappings<TDbType, TObject>;
};

export type AnyMapping = Mapping<any, any, any>;

export type InferObjectType<TMapping> = TMapping extends Mapping<any, infer TObject, any> ? TObject : never;

export type InferDbType<TMapping> = TMapping extends Mapping<infer TDbType, any, any> ? TDbType : never;

export type InferSave<TMapping> = TMapping extends Mapping<any, infer TObject, infer TReadOnly>
  ? Omit<TObject, TReadOnly>
  : never;

export type SaveType<TObject, TReadOnly extends keyof TObject> = Omit<TObject, TReadOnly>;
