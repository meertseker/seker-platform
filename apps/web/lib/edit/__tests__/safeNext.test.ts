import { describe, it, expect } from 'vitest';
import { safeNext } from '../safeNext';

describe('safeNext', () => {
  it.each([
    ['/kayit', '/kayit'],
    ['/lp/beykent-anaokulu?x=1', '/lp/beykent-anaokulu?x=1'],
    [null, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['/api/edit/enable', '/'],
  ])('%s → %s', (input, expected) => expect(safeNext(input)).toBe(expected));
});
