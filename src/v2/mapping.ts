/* eslint-disable @typescript-eslint/no-explicit-any */
import { SqlExpression } from './sql-expression.js';

export const auto = Symbol('auto');

export interface Column<TDbType> {
  name: string;
  selectExpression?: SqlExpression<TDbType>;
}

export interface SingleColumnPropertyDef<TDbType, TValue> {
  column: typeof auto | string | Column<TDbType>;
  fromDb?: (dbValue: TDbType) => TValue;
  toDb?: (value: TValue) => TDbType | SqlExpression<TDbType>;
}

export interface MultiColumnPropertyDef<TDbType, TValue> {
  columns: string[] | Column<TDbType>[];
  extractFromRow: (row: Record<string, TDbType>) => TValue;
  applyToRow: (row: Record<string, SqlExpression<TDbType>>, value: TValue) => void;
}

export type PropertyDef<TDbType, TValue> =
  | typeof auto
  | string
  | SingleColumnPropertyDef<TDbType, TValue>
  | MultiColumnPropertyDef<TDbType, TValue>;

// TODO only allow auto/string when TValue extends TDbType
// type RequireProps<Type, Key extends keyof Type> = Type & Required<Pick<Type, Key>>;
// export type PropertyMappingDef<TDbType, TValue> = TValue extends TDbType
//   ?
//       | typeof auto
//       | string
//       | SingleColumnPropertyMappingDef<TDbType, TValue>
//       | MultiColumnPropertyMappingDef<TDbType, TValue>
//   :
//       | RequireProps<SingleColumnPropertyMappingDef<TDbType, TValue>, 'fromDb' | 'toDb'>
//       | MultiColumnPropertyMappingDef<TDbType, TValue>;

export type MappingDef<TDbType, TObject> = {
  [TKey in keyof Required<TObject>]: PropertyDef<TDbType, TObject[TKey]>;
};

export type AutoConfig = {
  propertyNameToColumnName: (propName: string) => string;
};

export const identityAutoConfig: AutoConfig = {
  propertyNameToColumnName(propName) {
    return propName;
  },
};
