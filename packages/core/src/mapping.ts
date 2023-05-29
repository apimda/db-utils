import { Row, Sql } from 'postgres';
import { PostgresJsDaoMapping } from './dao.js';

export type DbType = string | number | boolean | object | null;

export interface PropertyMapper<TVal> {
  extractFromRow(row: Record<string, DbType>): TVal;
  applyToRow(row: Record<string, DbType>, value: TVal, sql: Sql): void;
}

export interface SimplePropertyMapper<TVal> {
  fromDb: (rowVal: DbType) => TVal;
  toDb: (value: TVal, sql: Sql) => DbType;
}

export interface ColumnAutoMapper {
  buildPrefix: (componentPath: string[]) => string;
  propertyNameToColumnName: (propName: string) => string;
}

export interface GenerationConfig {
  generateTimestamps: boolean;
  idGenerator?: () => string | number | bigint;
}

export type MapperDefaults = {
  properties: SimplePropertyMapper<any>;
  columns: ColumnAutoMapper;
  generation: GenerationConfig;
};

export interface SqlColumn {
  sql: string;
  name: string;
}

export const auto = Symbol('auto');
export const id = Symbol('id');
export const createdAt = Symbol('createdAt');
export const updatedAt = Symbol('updatedAt');

export type ColumnMarker = typeof id | typeof createdAt | typeof updatedAt;

export type SimpleColumnDef = typeof auto | ColumnMarker | string | [string, ColumnMarker];

export type MappedColumnDef<T> = {
  column: string | SqlColumn;
  marker?: ColumnMarker;
  mapper: SimplePropertyMapper<T>;
};

export type MultiMappedColumnDef<T> = {
  columns: (string | SqlColumn)[];
  mapper: PropertyMapper<T>;
};

export type ColumnDef<T> = SimpleColumnDef | MappedColumnDef<T> | MultiMappedColumnDef<T>;

export type MappingDef<T extends object | unknown> = {
  [TKey in keyof Required<T>]: T[TKey] extends object | unknown
    ? ColumnDef<T[TKey]> | MappingDef<T[TKey]>
    : ColumnDef<T[TKey]>;
};

type AnyDef = ColumnDef<any> | MappingDef<any>;

export function mapping<T>(tableName: string, defaults: MapperDefaults, mappingDef: MappingDef<T>) {
  function fromSimpleDef(def: SimpleColumnDef, componentPath: string[], propName: string) {
    const column = Array.isArray(def) ? def[0] : def;
    const columnName =
      typeof column === 'string'
        ? column
        : defaults.columns.buildPrefix(componentPath) + defaults.columns.propertyNameToColumnName(propName!);
    let marker;
    if (Array.isArray(def)) {
      marker = def[1];
    } else if (column !== auto && typeof column !== 'string') {
      marker = column;
    }
    return new SimpleColumnMapping(new Column(columnName, marker), propName, defaults.properties);
  }

  function fromMappedDef(def: MappedColumnDef<any>, propName: string) {
    return new SimpleColumnMapping(new Column(def.column, def.marker), propName, def.mapper);
  }

  function fromMultiMappedDef(def: MultiMappedColumnDef<any>, propName: string) {
    const columns = def.columns.map(c => new Column(c));
    return new ColumnMapping(columns, propName, def.mapper);
  }

  function fromDef(def: AnyDef, componentPath: string[], propName?: string) {
    if (
      def === auto ||
      def === id ||
      def === createdAt ||
      def === updatedAt ||
      typeof def === 'string' ||
      Array.isArray(def)
    ) {
      return fromSimpleDef(def as SimpleColumnDef, componentPath, propName!);
    } else if ('column' in def) {
      return fromMappedDef(def as MappedColumnDef<any>, propName!);
    } else if ('columns' in def) {
      return fromMultiMappedDef(def as MultiMappedColumnDef<any>, propName!);
    } else {
      const mappingDef = def as Record<string, AnyDef>;
      const objMapping: ObjectMapping<any> = {};
      for (const prop in mappingDef) {
        const newComponentPath = propName ? componentPath.concat(propName) : [];
        objMapping[prop] = fromDef(mappingDef[prop], newComponentPath, prop);
      }
      return new ComponentMapping(objMapping);
    }
  }
  const mapping = fromDef(mappingDef, [], '') as ComponentMapping<T>;
  return new Mapping(tableName, mapping, defaults.generation);
}

interface MappingSupport<T> {
  columns: Column[];
  extractFromRow(row: Row): T;
  applyToRow(row: Row, value: T, sql: Sql): void;
}

export class Column {
  public selectExpr: string;
  public name: string;

  constructor(public source: string | SqlColumn, public marker?: ColumnMarker) {
    if (typeof source === 'string') {
      this.selectExpr = source;
      this.name = source;
    } else {
      this.selectExpr = `${source.sql} AS ${source.name}`;
      this.name = source.name;
    }
  }
}

class SimpleColumnMapping<T> implements MappingSupport<T> {
  constructor(public column: Column, public propertyName: string, private readonly mapper: SimplePropertyMapper<T>) {}

  get columns() {
    return [this.column];
  }

  extractFromRow(row: Row): T {
    const rowVal = row[this.column.name];
    return this.mapper.fromDb(rowVal);
  }

  applyToRow(row: Row, value: T, sql: Sql): void {
    row[this.column.name] = this.mapper.toDb(value, sql);
  }
}

class ColumnMapping<T> implements MappingSupport<T> {
  constructor(
    public columns: Column[],
    public propertyName: string,
    private readonly mappingFunctions: PropertyMapper<T>,
    public marker?: ColumnMarker
  ) {}

  extractFromRow(row: Row): T {
    return this.mappingFunctions.extractFromRow(row);
  }

  applyToRow(row: Row, value: T, sql: Sql): void {
    if (this.marker !== createdAt && this.marker !== updatedAt) {
      this.mappingFunctions.applyToRow(row, value, sql);
    }
  }
}

class ComponentMapping<T> implements MappingSupport<T> {
  constructor(public readonly mapping: ObjectMapping<T>) {}

  get columns() {
    const result: Column[] = [];
    for (const prop in this.mapping) {
      const childCols = this.mapping[prop].columns;
      result.push(...childCols);
    }
    return result;
  }

  findMarkedColumn(marker: ColumnMarker) {
    for (const prop in this.mapping) {
      const subMapping = this.mapping[prop];
      if (subMapping instanceof SimpleColumnMapping) {
        if (subMapping.column.marker === marker) {
          return { column: subMapping.column, propertyName: subMapping.propertyName };
        }
      }
    }
    return undefined;
  }

  extractFromRow(row: Row): T {
    const result: Record<string, any> = {};
    let isDefined = false;
    for (const prop in this.mapping) {
      const value = this.mapping[prop].extractFromRow(row);
      result[prop] = value;
      isDefined = isDefined || value !== undefined;
    }
    return (isDefined ? result : undefined) as T;
  }

  applyToRow(row: Row, value: T, sql: Sql): void {
    if (value) {
      for (const prop in this.mapping) {
        this.mapping[prop].applyToRow(row, value[prop], sql);
      }
    }
  }
}

type ObjectMapping<T> = {
  [TKey in keyof Required<T>]: SimpleColumnMapping<T[TKey]> | ColumnMapping<T[TKey]> | ComponentMapping<T[TKey]>;
};

type ColumnAndProperty = {
  column: Column;
  propertyName: string;
};

class Mapping<TObj> implements PostgresJsDaoMapping<TObj> {
  public idColumn: ColumnAndProperty;
  public createdAtColumn?: ColumnAndProperty;
  public updatedAtColumn?: ColumnAndProperty;

  constructor(
    public tableName: string,
    public mapping: ComponentMapping<TObj>,
    public assignmentConfig: GenerationConfig
  ) {
    const idColumn = mapping.findMarkedColumn(id);
    if (!idColumn) {
      throw new Error(`Cannot find ID column`);
    }
    this.idColumn = idColumn;
    this.createdAtColumn = mapping.findMarkedColumn(createdAt);
    this.updatedAtColumn = mapping.findMarkedColumn(updatedAt);
  }

  get idProperty() {
    return this.idColumn.propertyName as keyof TObj;
  }

  get createdAtProperty() {
    return this.createdAtColumn?.propertyName as keyof TObj | undefined;
  }

  get updatedAtProperty() {
    return this.updatedAtColumn?.propertyName as keyof TObj | undefined;
  }

  get idColumnName() {
    return this.idColumn.column.name;
  }

  get selectColumns() {
    return this.mapping.columns.map(c => c.selectExpr);
  }

  fromRow(row: Row): TObj {
    const obj = this.mapping.extractFromRow(row) as Record<string, any>;
    return obj as TObj;
  }

  toRow(obj: TObj, sql: Sql): Row {
    const row: Row = {};
    this.mapping.applyToRow(row, obj, sql);
    const objId = obj[this.idColumn.propertyName as keyof TObj];

    if (objId === undefined) {
      if (this.assignmentConfig.idGenerator) {
        row[this.idColumnName] = this.assignmentConfig.idGenerator();
      } else {
        delete row[this.idColumnName];
      }
    }

    const now = new Date();
    if (this.createdAtColumn) {
      if (this.assignmentConfig.generateTimestamps && objId === undefined) {
        row[this.createdAtColumn.column.name] = now;
      } else {
        delete row[this.createdAtColumn.column.name];
      }
    }

    if (this.updatedAtColumn) {
      if (this.assignmentConfig.generateTimestamps) {
        row[this.updatedAtColumn.column.name] = now;
      } else {
        delete row[this.updatedAtColumn.column.name];
      }
    }

    return row;
  }
}
