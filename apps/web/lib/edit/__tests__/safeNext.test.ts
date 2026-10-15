import { describe, it, expect } from 'vitest';
import { safeNext } from '../safeNext';

describe('safeNext', () => {
  it.each([
    ['/kayit', '/kayit'],
    ['/lp/beykent-anaokulu?x=1', '/lp/beykent-anaokulu?x=1'],
    ['/kayit#form', '/kayit#form'],
    [null, '/'],
    ['', '/'],
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['/\t/evil.com', '/'],
    ['/\n/evil.com', '/'],
    ['/\r/evil.com', '/'],
    ['javascript:alert(1)', '/'],
    ['/api/edit/enable', '/'],
    ['/a/../../api/edit/enable', '/'],
    ['/.//evil.com', '/'],
    ['/a/..//evil.com', '/'],
    ['/a/../..//evil.com', '/'],
    ['/.//evil.com?x=1', '/'],
    ['/./\\evil.com', '/'],
    ['/.\\/evil.com', '/'],
    ['/./\t/evil.com', '/'],
    ['/kayit/../lp/x', '/lp/x'],
    ['/%09/evil.com', '/%09/evil.com'],
    ['/%2F/evil.com', '/%2F/evil.com'],
  ])('%j → %j', (input, expected) => expect(safeNext(input)).toBe(expected));
});
