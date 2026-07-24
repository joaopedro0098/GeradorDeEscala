import { describe, expect, it } from 'vitest';
import { assertNever } from './utils';

describe('assertNever', () => {
  it('throws with the unexpected value serialized', () => {
    expect(() => assertNever('unexpected' as never)).toThrowError(/unexpected/i);
  });
});
