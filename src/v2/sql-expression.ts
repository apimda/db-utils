const sqlExpressionMarker = Symbol('sqlExpressionMarker');
const sqlIdentifierMarker = Symbol('sqlIdentifierMarker');
const sqlUnsafeMarker = Symbol('sqlUnsafeMarker');

export type SqlExpression<TDbType> = {
  [sqlExpressionMarker]: true;
  expression: string;
  values: TDbType[];
};

export type SqlIdentifier = {
  [sqlIdentifierMarker]: true;
  name: string;
};

export type SqlUnsafe = {
  [sqlUnsafeMarker]: true;
  text: string;
};

export function sqlIdentifier(name: string): SqlIdentifier {
  return { [sqlIdentifierMarker]: true, name };
}

export function sqlUnsafe(text: string): SqlUnsafe {
  return { [sqlUnsafeMarker]: true, text: text };
}

export function isSqlExpression<TDbType>(val: unknown): val is SqlExpression<TDbType> {
  return typeof val === 'object' && val !== null && sqlExpressionMarker in val;
}

export function isSqlIdentifier(val: unknown): val is SqlIdentifier {
  return typeof val === 'object' && val !== null && sqlIdentifierMarker in val;
}

export function isSqlUnsafe(val: unknown): val is SqlUnsafe {
  return typeof val === 'object' && val !== null && sqlUnsafeMarker in val;
}

export function sql<TDbType>(
  strings: TemplateStringsArray,
  ...vals: (TDbType | SqlExpression<TDbType> | SqlIdentifier | SqlUnsafe)[]
): SqlExpression<TDbType> {
  // TODO is there a way to disallow '?' at compile time using type system?
  const hasIllegalChar = strings.find((str) => str.includes('?'));
  if (hasIllegalChar) {
    throw new Error(`Illegal character '?' found in template string: ${hasIllegalChar}`);
  }

  const expression = strings.reduce((acc, str, i) => {
    const val = vals[i - 1];
    if (isSqlExpression(val)) {
      return acc + val.expression + str;
    } else if (isSqlIdentifier(val)) {
      return acc + val.name + str;
      // return acc + '`' + val.name + '`' + str;
    } else if (isSqlUnsafe(val)) {
      return acc + val.text + str;
    } else {
      return acc + '?' + str;
    }
  });
  const values = vals.flatMap((val) => {
    if (isSqlExpression(val)) {
      return val.values;
    } else if (isSqlIdentifier(val) || isSqlUnsafe(val)) {
      return [];
    } else {
      return [val];
    }
  });
  return { expression, values, [sqlExpressionMarker]: true };
}
