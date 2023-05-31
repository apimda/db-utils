import { randomUUID } from 'node:crypto';
import { MapperDefaults } from './mapping.js';

export const snakeToCamel = (x: string) => {
  let str = x[0];
  for (let i = 1; i < x.length; i++) {
    str += x[i] === '_' ? x[++i].toUpperCase() : x[i];
  }
  return str;
};

export const camelToSnake = (x: string) => x.replace(/([A-Z])/g, '_$1').toLowerCase();

export const sortByProperty = <T>(array: T[], prop: keyof T) =>
  array.sort((a, b) => (a[prop] < b[prop] ? -1 : a[prop] < b[prop] ? 1 : 0));

export const mapperDefaults: MapperDefaults = {
  columns: {
    buildPrefix: (componentPath: string[]) =>
      componentPath.length ? `${componentPath.map(camelToSnake).join('_')}_` : '',
    propertyNameToColumnName: propName => camelToSnake(propName)
  },
  properties: {
    fromDb: rowVal => {
      return rowVal ?? undefined;
    },
    toDb: value => {
      return value ?? null;
    }
  },
  generation: {
    generateTimestamps: true,
    idGenerator: randomUUID
  }
};
