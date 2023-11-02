/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A request for a page of results
 */
export interface DaoPageRequest<TObject> {
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
  sortColumn: keyof TObject;

  /**
   * Sort order; if undefined, sort in ascending order
   */
  sortOrder: 'asc' | 'desc';
}

/**
 * Page of results with total count
 */
export interface DaoPage<TObject> {
  /**
   * Total number of results available
   */
  count: number;

  /**
   * Page of results
   */
  results: TObject[];
}

/**
 * A minimal CRUD-only Data Access Object
 */
export interface CrudDao<TObject, TId, TSave> {
  /**
   * Deletes the object with the given ID.
   * @param id ID of object to delete
   * @returns count of objects deleted
   */
  deleteById(id: TId): Promise<number>;

  /**
   * Retrieves an object by its id.
   * @param id ID of object to find
   */
  findById(id: TId): Promise<TObject | undefined>;

  /**
   * Insert an object.
   * @param obj object to insert
   */
  insert(obj: TSave): Promise<TObject>;

  /**
   * Update an object.
   * @param obj object to update
   */
  update(obj: TSave): Promise<TObject>;

  /**
   * Insert or update an object.
   * @param obj object to update
   */
  upsert(obj: TObject): Promise<TObject>;
}

/**
 * Data Access Object
 */
export interface Dao<TObject, TId, TSave> extends CrudDao<TObject, TId, TSave> {
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
  deleteManyById(ids: TId[]): Promise<number>;

  /**
   * Returns whether an object with the given ID exists.
   * @param id ID of object to check if exists
   */
  existsById(id: TId): Promise<boolean>;

  /**
   * Returns all objects.
   */
  findAll(): Promise<TObject[]>;

  /**
   * Returns all objects with the given IDs.
   * @param ids IDs of objects to find
   */
  findManyById(ids: TId[]): Promise<TObject[]>;

  /**
   * Returns a page of objects.
   */
  findPage(request: DaoPageRequest<TObject>): Promise<DaoPage<TObject>>;

  /**
   * Insert many objects.
   * @param objs objects to insert
   */
  insertMany(objs: TSave[]): Promise<TObject[]>;

  /**
   * Update many objects.
   * @param objs objects to update
   */
  updateMany(objs: TSave[]): Promise<TObject[]>;
}
