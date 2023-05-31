import assert from 'node:assert/strict';
import { BasePostgresJsDao, PostgresJsId } from '../dao.js';
import { sortByProperty } from '../utils.js';

const removeUndefinedValues = (obj: any) => {
  return Object.fromEntries(Object.entries(obj).flatMap(([k, v]) => (v === undefined ? [] : [[k, v]])));
};

const assertEqualIgnoreUndefined = (one: any, two: any) => {
  assert.deepStrictEqual(removeUndefinedValues(one), removeUndefinedValues(two));
};

export async function daoTest<TEntity, TId extends PostgresJsId>(
  dao: BasePostgresJsDao<TEntity, TId>,
  createFn: () => TEntity,
  updateFn: (entity: TEntity) => TEntity
) {
  const idProp = dao.mapping.idProperty;
  const createdProp = dao.mapping.createdAtProperty;
  const updatedProp = dao.mapping.updatedAtProperty;

  const applyIdAndTimestamps = (src: TEntity, upd: TEntity) => ({
    ...src,
    ...(createdProp && { [createdProp]: upd[createdProp] }),
    ...(updatedProp && { [updatedProp]: upd[updatedProp] }),
    [idProp]: upd[idProp]
  });

  // CRUD
  const entity = createFn();
  const inserted = await dao.insert(entity);
  const id = inserted[idProp] as TId;
  assertEqualIgnoreUndefined(applyIdAndTimestamps(entity, inserted), await dao.findById(id));
  assert.strictEqual(await dao.existsById(id), true);
  assert.strictEqual(await dao.count(), 1);

  const updated = await dao.update(updateFn(inserted));
  assertEqualIgnoreUndefined(updated, await dao.findById(id));

  await dao.deleteById(id);
  assert.strictEqual(await dao.findById(id!), undefined);
  assert.strictEqual(await dao.existsById(id), false);
  assert.strictEqual(await dao.count(), 0);

  // Upsert
  const upsInserted = await dao.upsert(createFn());
  const upsId = upsInserted[idProp] as TId;
  assertEqualIgnoreUndefined(upsInserted, await dao.findById(upsId));
  const upsUpdated = await dao.upsert(updateFn(upsInserted));
  assertEqualIgnoreUndefined(upsUpdated, await dao.findById(upsId));
  await dao.deleteById(upsId);
  assert.strictEqual(await dao.count(), 0);

  // Batch
  const batchNum = 4;
  const entityArr: TEntity[] = [];
  for (let i = 0; i < batchNum; i++) {
    entityArr.push(createFn());
  }

  const insertedArr = await dao.insertMany(entityArr);
  for (const [idx, obj] of insertedArr.entries()) {
    assert(obj[idProp] !== undefined);
    assertEqualIgnoreUndefined(applyIdAndTimestamps(entityArr[idx], obj), obj);
  }
  assert.strictEqual(await dao.count(), batchNum);

  // const updatedArr = await dao.updateMany(entityArr.map(updateFn));
  // TODO support updateMany
  const foundAllArr = await dao.findAll();
  assert.strictEqual(foundAllArr.length, batchNum);
  for (const [idx, obj] of foundAllArr.entries()) {
    // expect(updatedArr[idx]).toEqual(obj);
    assertEqualIgnoreUndefined(insertedArr[idx], obj);
  }

  const idArr = foundAllArr.slice(batchNum / 2).map(e => e[idProp] as TId);
  const findManyByIdArr = await dao.findManyById(idArr);
  assert.strictEqual(idArr.length, findManyByIdArr.length);
  for (const [idx, obj] of findManyByIdArr.entries()) {
    assertEqualIgnoreUndefined(foundAllArr[batchNum / 2 + idx], obj);
  }

  // Pages
  const allByIdAsc = sortByProperty(foundAllArr, idProp);
  const firstPageAsc = await dao.findPage({
    limit: batchNum / 2,
    offset: 0,
    sortColumn: dao.mapping.idColumnName,
    sortOrder: 'asc'
  });
  assert.strictEqual(firstPageAsc.count, batchNum);
  assert.strictEqual(firstPageAsc.results.length, batchNum / 2);
  assertEqualIgnoreUndefined(firstPageAsc.results, allByIdAsc.slice(0, batchNum / 2));

  const secondPageAsc = await dao.findPage({
    limit: batchNum / 2,
    offset: batchNum / 2,
    sortColumn: dao.mapping.idColumnName,
    sortOrder: 'asc'
  });
  assert.strictEqual(firstPageAsc.count, batchNum);
  assert.strictEqual(firstPageAsc.results.length, batchNum / 2);
  assertEqualIgnoreUndefined(secondPageAsc.results, allByIdAsc.slice(batchNum / 2));

  const fullPageDesc = await dao.findPage({
    limit: batchNum,
    offset: 0,
    sortColumn: dao.mapping.idColumnName,
    sortOrder: 'desc'
  });
  assert.strictEqual(fullPageDesc.count, batchNum);
  assert.strictEqual(fullPageDesc.results.length, batchNum);
  assertEqualIgnoreUndefined(fullPageDesc.results, allByIdAsc.reverse());
}
