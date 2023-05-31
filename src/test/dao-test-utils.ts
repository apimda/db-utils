import { expect } from 'vitest';
import { BasePostgresJsDao, PostgresJsId } from '../dao.js';
import { sortByProperty } from '../utils.js';

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
  expect(applyIdAndTimestamps(entity, inserted)).toEqual(await dao.findById(id));
  expect(await dao.existsById(id)).toBe(true);
  expect(await dao.count()).toBe(1);

  const updated = await dao.update(updateFn(inserted));
  expect(updated).toEqual(await dao.findById(id));

  await dao.deleteById(id);
  expect(await dao.findById(id!)).toBeUndefined();
  expect(await dao.existsById(id)).toBe(false);
  expect(await dao.count()).toBe(0);

  // Upsert
  const upsInserted = await dao.upsert(createFn());
  const upsId = upsInserted[idProp] as TId;
  expect(upsInserted).toEqual(await dao.findById(upsId));
  const upsUpdated = await dao.upsert(updateFn(upsInserted));
  expect(upsUpdated).toEqual(await dao.findById(upsId));
  await dao.deleteById(upsId);
  expect(await dao.count()).toBe(0);

  // Batch
  const batchNum = 4;
  const entityArr: TEntity[] = [];
  for (let i = 0; i < batchNum; i++) {
    entityArr.push(createFn());
  }

  const insertedArr = await dao.insertMany(entityArr);
  for (const [idx, obj] of insertedArr.entries()) {
    const id = obj[idProp] as TId;
    expect(id).toBeDefined();
    expect(applyIdAndTimestamps(entityArr[idx], obj)).toEqual(obj);
  }
  expect(await dao.count()).toBe(batchNum);

  // const updatedArr = await dao.updateMany(entityArr.map(updateFn));
  // TODO support updateMany
  const foundAllArr = await dao.findAll();
  expect(foundAllArr).toHaveLength(batchNum);
  for (const [idx, obj] of foundAllArr.entries()) {
    // expect(updatedArr[idx]).toEqual(obj);
    expect(insertedArr[idx]).toEqual(obj);
  }

  const idArr = foundAllArr.slice(batchNum / 2).map(e => e[idProp] as TId);
  const findManyByIdArr = await dao.findManyById(idArr);
  expect(idArr.length).toBe(findManyByIdArr.length);
  for (const [idx, obj] of findManyByIdArr.entries()) {
    expect(foundAllArr[batchNum / 2 + idx]).toEqual(obj);
  }

  // Pages
  const allByIdAsc = sortByProperty(foundAllArr, idProp);
  const firstPageAsc = await dao.findPage({
    limit: batchNum / 2,
    offset: 0,
    sortColumn: dao.mapping.idColumnName,
    sortOrder: 'asc'
  });
  expect(firstPageAsc.count).toBe(batchNum);
  expect(firstPageAsc.results.length).toBe(batchNum / 2);
  expect(firstPageAsc.results).toEqual(allByIdAsc.slice(0, batchNum / 2));

  const secondPageAsc = await dao.findPage({
    limit: batchNum / 2,
    offset: batchNum / 2,
    sortColumn: dao.mapping.idColumnName,
    sortOrder: 'asc'
  });
  expect(firstPageAsc.count).toBe(batchNum);
  expect(firstPageAsc.results.length).toBe(batchNum / 2);
  expect(secondPageAsc.results).toEqual(allByIdAsc.slice(batchNum / 2));

  const fullPageDesc = await dao.findPage({
    limit: batchNum,
    offset: 0,
    sortColumn: dao.mapping.idColumnName,
    sortOrder: 'desc'
  });
  expect(fullPageDesc.count).toBe(batchNum);
  expect(fullPageDesc.results.length).toBe(batchNum);
  expect(fullPageDesc.results).toEqual(allByIdAsc.reverse());
}
