import { DbTestContext } from './src/test/db-test-context.js';

export async function setup() {
  await DbTestContext.createGlobal();
}

export async function teardown() {
  await DbTestContext.destroyGlobal();
}
