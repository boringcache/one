import { assertImplementedMode, normalizeMode, resolveModeSpec } from '../lib/modes';

describe('mode registry', () => {
  it('normalizes supported modes', () => {
    expect(normalizeMode('docker')).toBe('docker');
    expect(normalizeMode('archive')).toBe('archive');
  });

  it('resolves auto to archive for the current MVP', () => {
    const spec = resolveModeSpec('auto');
    expect(spec.requested).toBe('auto');
    expect(spec.resolved).toBe('archive');
    expect(spec.implemented).toBe(true);
    expect(spec.compatibilityWrappers).toEqual(['boringcache/action']);
  });

  it('marks product modes as implemented while keeping wrapper references for migration', () => {
    const spec = resolveModeSpec('docker');
    expect(spec.implemented).toBe(true);
    expect(() => assertImplementedMode(spec)).not.toThrow();
    expect(spec.compatibilityWrappers).toEqual(['boringcache/docker-action']);
  });
});
