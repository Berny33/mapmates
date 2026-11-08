import { describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from '../setup/test-env.js';

describe('test database safety guard', () => {
  it('accepts a database whose name ends with _test', () => {
    expect(() =>
      assertTestDatabaseUrl('postgres://u:p@localhost:5432/mapmates_test'),
    ).not.toThrow();
  });

  it.each([
    ['a development database', 'postgres://u:p@localhost:5432/mapmates'],
    ['an empty value', ''],
    ['a missing value', undefined],
    ['an invalid URL', 'not-a-url'],
  ])('rejects %s', (_label, url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow(
      'must point to a database whose name ends with _test',
    );
  });
});
