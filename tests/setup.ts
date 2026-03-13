import * as core from '@actions/core';
import * as exec from '@actions/exec';

const mockEnsureBoringCache = jest.fn();
const mockExecBoringCache = jest.fn();
const mockInstallMise = jest.fn();
const mockInstallMiseTool = jest.fn();
const mockActivateMiseTool = jest.fn();
const mockHasMiseToolVersion = jest.fn();
const mockHasToolVersionOnPath = jest.fn();
const mockExportMiseEnv = jest.fn();
const mockReshimMise = jest.fn();
const mockReadProjectMiseTools = jest.fn();
const mockReadMiseTomlVersion = jest.fn();
const mockReadToolVersionsValue = jest.fn();
const mockStartRegistryProxy = jest.fn();
const mockWaitForProxy = jest.fn();
const mockStopRegistryProxy = jest.fn();
const mockFindAvailablePort = jest.fn();

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getState: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  setSecret: jest.fn(),
  info: jest.fn(),
  notice: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
}));

jest.mock('@actions/exec', () => ({
  exec: jest.fn(),
}));

jest.mock('@actions/cache', () => ({
  restoreCache: jest.fn().mockResolvedValue(null),
  saveCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@actions/tool-cache', () => ({
  find: jest.fn().mockReturnValue('/mock/tool-cache'),
  cacheDir: jest.fn().mockResolvedValue('/mock/tool-cache'),
  downloadTool: jest.fn().mockResolvedValue('/tmp/mock-download'),
  extractTar: jest.fn().mockResolvedValue('/tmp/mock-extract'),
  extractZip: jest.fn().mockResolvedValue('/tmp/mock-extract'),
}));

jest.mock('@boringcache/action-core', () => {
  const actual = jest.requireActual('@boringcache/action-core');
  return {
    ...actual,
    ensureBoringCache: mockEnsureBoringCache,
    execBoringCache: mockExecBoringCache,
    installMise: mockInstallMise,
    installMiseTool: mockInstallMiseTool,
    activateMiseTool: mockActivateMiseTool,
    hasMiseToolVersion: mockHasMiseToolVersion,
    hasToolVersionOnPath: mockHasToolVersionOnPath,
    exportMiseEnv: mockExportMiseEnv,
    reshimMise: mockReshimMise,
    readProjectMiseTools: mockReadProjectMiseTools,
    readMiseTomlVersion: mockReadMiseTomlVersion,
    readToolVersionsValue: mockReadToolVersionsValue,
    startRegistryProxy: mockStartRegistryProxy,
    waitForProxy: mockWaitForProxy,
    stopRegistryProxy: mockStopRegistryProxy,
    findAvailablePort: mockFindAvailablePort,
  };
});

const originalEnv = process.env;

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv };
  delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
  process.env.BORINGCACHE_SAVE_TOKEN = 'test-save-token';

  mockEnsureBoringCache.mockImplementation(async (options: { version: string; token?: string }) => {
    const token = options?.token || process.env.BORINGCACHE_API_TOKEN;
    if (token) {
      core.setSecret(token);
    }
  });

  mockExecBoringCache.mockImplementation(async (args: string[], options?: Parameters<typeof exec.exec>[2]) => {
    return exec.exec('boringcache', args, options);
  });

  mockInstallMise.mockResolvedValue(undefined);
  mockInstallMiseTool.mockResolvedValue(undefined);
  mockActivateMiseTool.mockResolvedValue(undefined);
  mockHasMiseToolVersion.mockResolvedValue(false);
  mockHasToolVersionOnPath.mockResolvedValue(false);
  mockExportMiseEnv.mockResolvedValue(undefined);
  mockReshimMise.mockResolvedValue(undefined);
  mockReadProjectMiseTools.mockResolvedValue([]);
  mockReadMiseTomlVersion.mockResolvedValue(null);
  mockReadToolVersionsValue.mockResolvedValue(null);
  mockStartRegistryProxy.mockResolvedValue({ pid: 4321, port: 5000, readOnly: false });
  mockWaitForProxy.mockResolvedValue(undefined);
  mockStopRegistryProxy.mockResolvedValue(undefined);
  mockFindAvailablePort.mockResolvedValue(5001);

  (exec.exec as jest.Mock).mockResolvedValue(0);
});

afterEach(() => {
  process.env = originalEnv;
});

export function mockGetInput(inputs: Record<string, string>): void {
  (core.getInput as jest.Mock).mockImplementation((name: string) => inputs[name] || '');
}

export function mockGetBooleanInput(inputs: Record<string, boolean>): void {
  (core.getBooleanInput as jest.Mock).mockImplementation((name: string) => inputs[name] || false);
}

export function mockGetState(states: Record<string, string>): void {
  (core.getState as jest.Mock).mockImplementation((name: string) => states[name] || '');
}

export const actionCoreMocks = {
  activateMiseTool: mockActivateMiseTool,
  ensureBoringCache: mockEnsureBoringCache,
  execBoringCache: mockExecBoringCache,
  exportMiseEnv: mockExportMiseEnv,
  hasMiseToolVersion: mockHasMiseToolVersion,
  hasToolVersionOnPath: mockHasToolVersionOnPath,
  installMise: mockInstallMise,
  installMiseTool: mockInstallMiseTool,
  reshimMise: mockReshimMise,
  findAvailablePort: mockFindAvailablePort,
  readMiseTomlVersion: mockReadMiseTomlVersion,
  readProjectMiseTools: mockReadProjectMiseTools,
  readToolVersionsValue: mockReadToolVersionsValue,
  startRegistryProxy: mockStartRegistryProxy,
  stopRegistryProxy: mockStopRegistryProxy,
  waitForProxy: mockWaitForProxy,
};
