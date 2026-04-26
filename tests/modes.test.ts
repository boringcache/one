import { assertImplementedMode, normalizeMode, resolveModeSpec } from '../lib/modes';

describe('mode registry', () => {
  it('normalizes supported modes', () => {
    expect(normalizeMode('docker')).toBe('docker');
    expect(normalizeMode('archive')).toBe('archive');
    expect(normalizeMode('go')).toBe('go');
    expect(normalizeMode('maven')).toBe('maven');
  });

  it('resolves auto to archive for the current MVP', () => {
    const spec = resolveModeSpec('auto');
    expect(spec.requested).toBe('auto');
    expect(spec.resolved).toBe('archive');
    expect(spec.implemented).toBe(true);
  });

  it('marks product modes as implemented', () => {
    for (const mode of ['docker', 'go'] as const) {
      const spec = resolveModeSpec(mode);
      expect(spec.implemented).toBe(true);
      expect(() => assertImplementedMode(spec)).not.toThrow();
    }
  });
});
