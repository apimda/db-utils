/* eslint-disable @typescript-eslint/no-explicit-any */

// class Money {
//   constructor(
//     public amount: bigint,
//     public currency: string,
//   ) {}
// }

// interface TestObj {
//   objId: string;
//   objName: string;
//   objOptional?: string;
//   isAdmin: boolean;
//   myComp: {
//     nestedOne: number;
//     nestedTwo: number;
//   };
//   money: Money;
//   sqlTest?: string;
//   mappedAuto: bigint;
//   created: Date;
//   updated: Date;
// }

// const createTable = `CREATE TABLE test_obj
// (
//   obj_id              uuid          DEFAULT uuid_generate_v4()  NOT NULL,
//   obj_name            varchar(100)                              NOT NULL,
//   obj_optional        varchar(100),
//   is_admin            boolean,
//   my_comp_nested_one  int                                       NOT NULL,
//   my_comp_nested_two  int                                       NOT NULL,
//   money_amount        bigint                                    NOT NULL,
//   money_currency      text                                      NOT NULL,
//   sql_test            text,
//   mapped_auto         bigint                                    NOT NULL,
//   created             timestamptz   DEFAULT NOW()               NOT NULL,
//   updated             timestamptz   DEFAULT NOW()               NOT NULL,

//   PRIMARY KEY (obj_id)
// )`;

// const testMapping = createMapping<PostgresJsDbType, TestObj, 'objId' | 'created' | 'updated'>(
//   'test_obj',
//   {
//     objId: auto,
//     objOptional: auto,
//     objName: auto,
//     isAdmin: 'is_admin',
//     myComp: {
//       columns: ['nested_one', 'nested_two'],
//       extractFromRow: (row) => {
//         const nestedOne = row['nested_one'] as number;
//         const nestedTwo = row['nested_two'] as number;
//         return { nestedOne, nestedTwo };
//       },
//       applyToRow: (row, value) => {
//         row['nested_one'] = sql`${value.nestedOne}`;
//         row['nested_two'] = sql`${value.nestedTwo}`;
//       },
//     },
//     money: {
//       columns: ['money_amount', 'money_currency'],
//       extractFromRow: (row) => {
//         const amount = BigInt(row['money_amount'] as string);
//         const currency = row['money_currency'] as string;
//         return new Money(amount, currency);
//       },
//       applyToRow: (row, value) => {
//         row['money_amount'] = sql`${value.amount.toString()}`;
//         row['money_currency'] = sql`${value.currency}`;
//       },
//     },
//     sqlTest: {
//       column: { selectExpression: sql`UPPER(${sqlLiteral('sql_test')})`, name: 'sql_test' },
//       fromDb: (dbValue) => (dbValue ? (dbValue as string) : undefined),
//       toDb: (value) => (value ? sql`LOWER(${value})` : null),
//     },
//     mappedAuto: {
//       column: auto,
//       fromDb: (dbValue) => BigInt(dbValue as string),
//       toDb: (value) => value.toString(),
//     },
//     created: auto,
//     updated: auto,
//   },
//   ['objId', 'created', 'updated'],
// );

// const fields = ['objId', 'created', 'updated'] as const;
// type fieldsType = (typeof fields)[number];
// //   ^?
// testMapping.readOnlyProperties;
// //          ^?
// testMapping.def.objId;
// //               ^?
// testMapping.properties;
// //          ^?
// testMapping.properties.objId;
// //                           ^?
// testMapping.properties.objName;
// //                            ^?
// console.log(testMapping.properties);
// type save = InferSave<typeof testMapping.properties>;

/*
  Design goals:
  - Should not need to know your DB schema - your DDL is single source of truth
  - Mappings should be fast to define
  - Mappings should be easy to test (ideally you have to define as little as possible in your tests)
  - Driver adapter should be as tiny as possible and work well with native DB driver
  - DAO abstraction should be simple to use (and optional)
  - Should be designed so that more complex query builders can be built on top of it

  SELECT:
  1. Generate select clause: mapping.selectClause(properties?: (keyof TObj)[])
  2. Generate where clause (optional): mapping.whereClause(filter: Partial<TObj>)
  3. Prepare/execute query: adapter.execute(sql: SqlExpression<TDbType>): Promise<{ results: Record<string, TDbType>[] }>
  4. Map result to object: mapping.fromRow(row: Record<string, TDbType>): TObj

  INSERT:
  1. Generate insert clause: mapping.insertClause(obj: TObj)

  UPDATE:
  1. Generate update clause: mapping.updateClause(obj: Partial<TObj>)
  2. Generate where clause (optional): mapping.whereClause(filter: Partial<TObj>)
*/

// testMapping.propertyMappings.objId;
//                            ^?
