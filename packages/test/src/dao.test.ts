import { BasePostgresJsDao, mapperDefaults } from '@apimda/db-utils-core';
import { Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { auto, createdAt, id, mapping, updatedAt } from '../../core/src/mapping.js';
import { daoTest } from './dao-test-utils.js';
import { DbTestContext } from './db-test-context.js';

interface TestObj {
  objId?: string;
  objName: string;
  isAdmin: boolean;
  created?: Date;
  updated?: Date;
}

const testMapping = mapping<TestObj>('test_obj', mapperDefaults, {
  objId: id,
  objName: auto,
  isAdmin: auto,
  created: createdAt,
  updated: updatedAt
});

class TestObjDao extends BasePostgresJsDao<TestObj, string> {
  constructor(sql: Sql) {
    super(sql, testMapping);
  }
}

let context: DbTestContext;
let dao: TestObjDao;

beforeAll(async () => {
  context = await DbTestContext.create();
  await context.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  dao = new TestObjDao(context.sql);
});

beforeEach(async () => {
  await context.recreateTestSchema();
  await context.sql`CREATE TABLE test_obj 
  (
    obj_id      uuid          DEFAULT uuid_generate_v4()  NOT NULL,
    obj_name    varchar(100),
    is_admin    boolean,
    created     timestamptz   DEFAULT NOW()               NOT NULL,
    updated     timestamptz   DEFAULT NOW()               NOT NULL,
    PRIMARY KEY (obj_id)
  )`;
});

afterAll(async () => {
  await context.destroy();
});

describe(' DAO Tests', () => {
  test('Generic DAO Test', async () => {
    await daoTest<TestObj, string>(
      dao,
      () => ({ objName: 'some name', isAdmin: true }),
      entity => ({ ...entity, objName: 'new name', isAdmin: false })
    );
  });
});
