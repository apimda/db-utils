/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A request for a page of results
 */
export interface DaoPageRequest {
  /**
   * Maximum number of results to return
   */
  limit: number;

  /**
   * Number of results to start
   */
  offset: number;

  /**
   * Name of column to sort by
   */
  sortColumn: string;

  /**
   * Sort order; if undefined, sort in ascending order
   */
  sortOrder: 'asc' | 'desc';
}

/**
 * Page of results with total count
 */
export interface DaoPage<T> {
  /**
   * Total number of results available
   */
  count: number;

  /**
   * Page of results
   */
  results: T[];
}

/**
 * A minimal CRUD-only Data Access Object
 */
export interface CrudDao<T, ID> {
  /**
   * Deletes the object with the given ID.
   * @param id ID of object to delete
   * @returns count of objects deleted
   */
  deleteById(id: ID): Promise<number>;

  /**
   * Retrieves an object by its id.
   * @param id ID of object to find
   */
  findById(id: ID): Promise<T | undefined>;

  /**
   * Insert an object.
   * @param obj object to insert
   */
  insert(obj: T): Promise<T>;

  /**
   * Update an object.
   * @param obj object to update
   */
  update(obj: T): Promise<T>;

  /**
   * Insert or update an object.
   * @param obj object to update
   */
  upsert(obj: T): Promise<T>;
}

/**
 * Data Access Object
 */
export interface Dao<T, ID> extends CrudDao<T, ID> {
  /**
   * Returns the number of objects in the table.
   */
  count(): Promise<number>;

  /**
   * Deletes all objects.
   * @returns count of objects deleted
   */
  deleteAll(): Promise<number>;

  /**
   * Deletes all objects with the given IDs.
   * @param ids IDs of objects to delete
   * @returns count of objects deleted
   */
  deleteManyById(ids: ID[]): Promise<number>;

  /**
   * Returns whether an object with the given ID exists.
   * @param id ID of object to check if exists
   */
  existsById(id: ID): Promise<boolean>;

  /**
   * Returns all objects.
   */
  findAll(): Promise<T[]>;

  /**
   * Returns all objects with the given IDs.
   * @param ids IDs of objects to find
   */
  findManyById(ids: ID[]): Promise<T[]>;

  /**
   * Returns a page of objects.
   */
  findPage(request: DaoPageRequest): Promise<DaoPage<T>>;

  /**
   * Insert many objects.
   * @param objs objects to insert
   */
  insertMany(objs: T[]): Promise<T[]>;

  /**
   * Update many objects.
   * @param objs objects to update
   */
  // TODO implement updateMay
  // updateMany(objs: T[]): Promise<T[]>;
}

import { PendingQuery, Row, RowList, Sql } from 'postgres';

export interface PostgresJsDaoMapping<T> {
  tableName: string;
  idColumnName: string;
  selectColumns: string[];
  idProperty: keyof T;
  createdAtProperty?: keyof T;
  updatedAtProperty?: keyof T;
  fromRow(row: Row): T;
  toRow(obj: T, sql: Sql): Row;
}

export type PostgresJsId = string | number | bigint;

/**
 * PostgresJS doesn't support bigint out of the box, so we transform them to strings here.
 * If you're using bigint, see: https://github.com/porsager/postgres#numbers-bigint-numeric
 */
export const bigintIdToString = (id: PostgresJsId) => (typeof id === 'bigint' ? id.toString() : id);

export abstract class BasePostgresJsDao<T, ID extends PostgresJsId> implements Dao<T, ID> {
  protected readonly selectList: PendingQuery<any>;
  constructor(
    protected sql: Sql,
    public mapping: PostgresJsDaoMapping<T>,
  ) {
    this.selectList = sql.unsafe(this.mapping.selectColumns.join(','));
  }

  protected async countWhere(sql: Sql, whereClause?: PendingQuery<any>) {
    const where = whereClause ?? sql`1=1`;
    const result = await sql`
      SELECT COUNT(*) as cnt
      FROM ${sql(this.mapping.tableName)}
      WHERE ${where}
    `;
    return parseInt(result[0]['cnt']);
  }

  protected results(rows: RowList<Row[]>) {
    return rows.map((r) => this.mapping.fromRow(r));
  }

  protected singleResult(rows: RowList<Row[]>) {
    return rows.length === 1 ? this.mapping.fromRow(rows[0]) : undefined;
  }

  async count(sql: Sql = this.sql): Promise<number> {
    return this.countWhere(sql);
  }

  async deleteAll(sql: Sql = this.sql): Promise<number> {
    const result = await sql`DELETE FROM ${sql(this.mapping.tableName)}`;
    return result.count;
  }

  async deleteById(id: ID, sql: Sql = this.sql): Promise<number> {
    const result = await sql`
      DELETE FROM ${sql(this.mapping.tableName)} 
      WHERE ${sql(this.mapping.idColumnName)}=${bigintIdToString(id)}
    `;
    return result.count;
  }

  async deleteManyById(ids: ID[], sql: Sql = this.sql): Promise<number> {
    const safeIds = ids.map(bigintIdToString);
    const result = await sql`
      DELETE FROM ${sql(this.mapping.tableName)} 
      WHERE ${sql(this.mapping.idColumnName)} IN ${safeIds}
    `;
    return result.count;
  }

  async existsById(id: ID, sql: Sql = this.sql): Promise<boolean> {
    const result = await sql`
      SELECT EXISTS (
        SELECT 1 
        FROM ${sql(this.mapping.tableName)}
        WHERE ${sql(this.mapping.idColumnName)}=${bigintIdToString(id)}
      )
    `;
    return result[0]['exists'] === true ? true : false;
  }

  async findAll(sql: Sql = this.sql): Promise<T[]> {
    const rows = await sql`
      SELECT ${this.selectList}
      FROM ${sql(this.mapping.tableName)}
    `;
    return this.results(rows);
  }

  async findById(id: ID, sql: Sql = this.sql): Promise<T | undefined> {
    const rows = await sql`
      SELECT ${this.selectList}
      FROM ${sql(this.mapping.tableName)}
      WHERE ${sql(this.mapping.idColumnName)}=${bigintIdToString(id)}
    `;
    return this.singleResult(rows);
  }

  async findManyById(ids: ID[], sql: Sql = this.sql): Promise<T[]> {
    const safeIds = ids.map(bigintIdToString);
    const rows = await sql`
      SELECT ${this.selectList}
      FROM ${sql(this.mapping.tableName)}
      WHERE ${sql(this.mapping.idColumnName)} IN ${sql(safeIds)}
    `;
    return this.results(rows);
  }

  async findPage(request: DaoPageRequest, sql: Sql = this.sql): Promise<DaoPage<T>> {
    const sortOrder = request.sortOrder === 'desc' ? sql`DESC` : sql`ASC`;
    const rows = await sql`
      SELECT ${this.selectList}
      FROM ${sql(this.mapping.tableName)}
      ORDER BY ${sql(request.sortColumn)} ${sortOrder}
      OFFSET ${request.offset}
      LIMIT ${request.limit}
    `;
    const results = this.results(rows);
    const count = await this.count(sql);
    return {
      results,
      count,
    };
  }

  async insert(obj: T, sql: Sql = this.sql): Promise<T> {
    const row = this.mapping.toRow(obj, sql);
    const result = await sql`
      INSERT INTO ${sql(this.mapping.tableName)} ${sql(row)}
      RETURNING ${this.selectList}
    `;
    return this.mapping.fromRow(result[0]);
  }

  async insertMany(objs: T[], sql: Sql = this.sql): Promise<T[]> {
    if (objs.length === 0) {
      return [];
    }
    const rows = objs.map((obj) => this.mapping.toRow(obj, sql));
    const result = await sql`
      INSERT INTO ${sql(this.mapping.tableName)} ${sql(rows)}
      RETURNING ${this.selectList}
    `;
    return this.results(result);
  }

  async update(obj: T, sql: Sql = this.sql): Promise<T> {
    const row = this.mapping.toRow(obj, sql);
    const result = await sql`
      UPDATE ${sql(this.mapping.tableName)} 
      SET ${sql(row)}
      RETURNING ${this.selectList}
    `;
    return this.mapping.fromRow(result[0]);
  }

  // async updateMany(objs: T[], sql: Sql = this.sql): Promise<T[]> {
  //   if (objs.length === 0) {
  //     return [];
  //   }

  //   const cols = Object.keys(this.mapping.toRow(objs[0], sql)).sort();
  //   const vals: any[][] = [];
  //   for (const obj of objs) {
  //     const row = this.mapping.toRow(obj, sql);
  //     const val: any[] = [];
  //     for (const col of cols) {
  //       val.push(row[col]);
  //     }
  //     vals.push(val);
  //   }

  //   const setStmt = cols.map(c => `${c}=u.${c}`).join(', ');
  // const result = await sql`
  //   UPDATE ${sql(this.mapping.tableName)}
  //   SET ${sql.unsafe(setStmt)}
  //   FROM (values ${sql(vals)}) as u (${sql.unsafe(cols.join(', '))})
  //   WHERE ${sql(this.mapping.tableName)}.${sql(this.mapping.idColumnName)}=u.${sql(this.mapping.idColumnName)}
  //   RETURNING ${this.selectList}
  // `;
  // const result = await sql`
  //   UPDATE test_obj
  //   SET created=u.created, is_admin=u.is_admin, obj_id=u.obj_id, obj_name=u.obj_name, updated=u.updated
  //   FROM (values ${sql(vals)}) as u (${sql.unsafe(cols.join(', '))})
  //   WHERE test_obj.obj_id = u.obj_id::uuid
  //   RETURNING u.obj_id, u.obj_name, u.is_admin, u.created, u.updated
  // `;
  // return this.results(result);
  // }

  async upsert(obj: T, sql: Sql = this.sql): Promise<T> {
    const row = this.mapping.toRow(obj, sql);
    const result = await sql`
      INSERT INTO ${sql(this.mapping.tableName)} ${sql(row)}
      ON CONFLICT (${sql(this.mapping.idColumnName)}) DO UPDATE
      SET ${sql(row)}
      RETURNING ${this.selectList}
    `;
    return this.mapping.fromRow(result[0]);
  }
}
