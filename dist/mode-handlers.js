"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runModeRestore = runModeRestore;
exports.runModeSave = runModeSave;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const action_core_1 = require("@boringcache/action-core");
const utils_1 = require("./utils");
const DOCKER_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-from');
const DOCKER_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-cache-to');
const DOCKER_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-docker-metadata.json');
const BUILDKIT_CACHE_DIR_FROM = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-from');
const BUILDKIT_CACHE_DIR_TO = path.join(os.tmpdir(), 'boringcache-one-buildkit-local-to');
const BUILDKIT_METADATA_FILE = path.join(os.tmpdir(), 'boringcache-one-buildkit-metadata.json');
let rustLastOutput = '';
async function runModeRestore(plan, inputs) {
    switch (plan.mode) {
        case 'docker':
            return runDockerRestore(plan, inputs);
        case 'buildkit':
            return runBuildkitRestore(plan, inputs);
        case 'bazel':
            return runBazelRestore(plan, inputs);
        case 'gradle':
            return runGradleRestore(plan, inputs);
        case 'maven':
            return runMavenRestore(plan, inputs);
        case 'rust-sccache':
            return runRustRestore(plan, inputs);
        case 'turbo-proxy':
            return runTurboProxyRestore(plan, inputs);
        case 'archive':
            return {};
    }
}
async function runModeSave(mode) {
    switch (mode) {
        case 'docker':
            await runDockerSave();
            return;
        case 'buildkit':
            await runBuildkitSave();
            return;
        case 'bazel':
        case 'gradle':
        case 'maven':
        case 'turbo-proxy':
            await stopProxyFromState();
            return;
        case 'rust-sccache':
            await runRustSave();
            return;
        case 'archive':
            return;
    }
}
function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return String(value).trim().toLowerCase() === 'true';
}
function parseList(input, separator = /[\n,]/) {
    return input
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean);
}
function parseMultiline(input) {
    return input
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}
function slugify(value) {
    return value.replace(/[^a-zA-Z0-9]/g, '-');
}
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
function modeStateKey(key) {
    return `mode-${key}`;
}
function saveModeState(key, value) {
    core.saveState(modeStateKey(key), value);
}
function getModeState(key) {
    return core.getState(modeStateKey(key));
}
function addLocalBinPaths() {
    const home = os.homedir();
    core.addPath(path.join(home, '.local', 'bin'));
    core.addPath(path.join(home, '.boringcache', 'bin'));
}
function registryProxyLogPath(port) {
    return path.join(os.tmpdir(), `boringcache-proxy-${port}.log`);
}
async function execBoringCache(args, options) {
    return (0, action_core_1.execBoringCache)(args, options);
}
async function restoreSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
    if (!(0, action_core_1.hasRestoreToken)()) {
        core.notice(`Skipping cache restore (${(0, action_core_1.missingRestoreTokenMessage)()})`);
        return;
    }
    const args = ['restore', workspace, `${cacheKey}:${cacheDir}`];
    if (flags.verbose) {
        args.push('--verbose');
    }
    await execBoringCache(args);
}
async function saveSimpleCache(workspace, cacheKey, cacheDir, flags = {}) {
    if (!(0, action_core_1.hasSaveToken)()) {
        core.notice(`Skipping cache save (${(0, action_core_1.missingSaveTokenMessage)()})`);
        return;
    }
    if (!fs.existsSync(cacheDir) || fs.readdirSync(cacheDir).length === 0) {
        core.notice('No cache files to save');
        return;
    }
    const args = ['save', workspace, `${cacheKey}:${cacheDir}`, '--force'];
    if (flags.verbose) {
        args.push('--verbose');
    }
    if (flags.exclude) {
        args.push('--exclude', flags.exclude);
    }
    await execBoringCache(args);
}
function getRegistryRef(port, cacheTag, host = '127.0.0.1') {
    return `${host}:${port}/${cacheTag}`;
}
function getRegistryCacheFlags(ref, cacheMode) {
    return {
        from: `type=registry,ref=${ref},registry.insecure=true`,
        to: `type=registry,ref=${ref},mode=${cacheMode},registry.insecure=true`,
    };
}
async function inspectDockerTemplate(containerName, template) {
    let output = '';
    const result = await exec.exec('docker', ['inspect', '-f', template, containerName], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    const value = output.trim();
    if (result !== 0 || !value || value === '<no value>') {
        return null;
    }
    return value;
}
async function getContainerGateway(containerName) {
    const directGateway = await inspectDockerTemplate(containerName, '{{.NetworkSettings.Gateway}}');
    if (directGateway) {
        return directGateway;
    }
    const networkGateways = await inspectDockerTemplate(containerName, '{{range .NetworkSettings.Networks}}{{if .Gateway}}{{.Gateway}}{{"\\n"}}{{end}}{{end}}');
    if (networkGateways) {
        const firstGateway = networkGateways
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean);
        if (firstGateway) {
            return firstGateway;
        }
    }
    core.warning(`Could not determine gateway for container ${containerName}, falling back to 172.17.0.1`);
    return '172.17.0.1';
}
async function getContainerNetworkMode(containerName) {
    const networkMode = await inspectDockerTemplate(containerName, '{{.HostConfig.NetworkMode}}');
    if (!networkMode) {
        core.warning(`Could not determine network mode for container ${containerName}, assuming bridge`);
        return 'bridge';
    }
    return networkMode;
}
async function setupQemuIfNeeded(platforms) {
    if (!platforms) {
        return;
    }
    const result = await exec.exec('docker', ['run', '--privileged', '--rm', 'tonistiigi/binfmt', '--install', 'all'], { ignoreReturnCode: true });
    if (result !== 0) {
        throw new Error(`Failed to set up QEMU for multi-platform builds (exit ${result})`);
    }
}
async function setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, registryMode) {
    const builderName = `boringcache-${process.env.GITHUB_RUN_ID || Date.now()}`;
    let driverToUse = driver || 'docker-container';
    if (driverToUse === 'docker') {
        core.warning('Buildx driver "docker" does not support cache export; falling back to "docker-container".');
        driverToUse = 'docker-container';
    }
    const effectiveDriverOpts = [...driverOpts];
    if (registryMode && driverToUse === 'docker-container' && !effectiveDriverOpts.some((opt) => opt.startsWith('network='))) {
        effectiveDriverOpts.push('network=host');
    }
    let configPath = '';
    if (buildkitdConfigInline.trim()) {
        configPath = path.join(os.tmpdir(), `buildkitd-${Date.now()}.toml`);
        fs.writeFileSync(configPath, buildkitdConfigInline);
    }
    const args = ['buildx', 'create', '--name', builderName, '--driver', driverToUse];
    for (const driverOpt of effectiveDriverOpts) {
        args.push('--driver-opt', driverOpt);
    }
    if (configPath) {
        args.push('--config', configPath);
    }
    args.push('--use');
    const createResult = await exec.exec('docker', args, { ignoreReturnCode: true });
    if (createResult !== 0) {
        throw new Error(`Failed to create buildx builder (exit ${createResult})`);
    }
    return builderName;
}
async function getBuilderPlatforms(builderName) {
    let output = '';
    const result = await exec.exec('docker', ['buildx', 'inspect', builderName, '--bootstrap'], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
        },
    });
    if (result !== 0) {
        return '';
    }
    const line = output.split('\n').find((value) => value.trim().startsWith('Platforms:'));
    return line ? line.replace('Platforms:', '').trim() : '';
}
async function buildDockerImage(opts) {
    const args = ['buildx', 'build', '--builder', opts.builder, '-f', opts.dockerfile];
    for (const tag of opts.tags) {
        args.push('-t', `${opts.image}:${tag}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--build-arg', buildArg);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    if (opts.target) {
        args.push('--target', opts.target);
    }
    if (opts.platforms) {
        args.push('--platform', opts.platforms);
    }
    if (opts.push) {
        args.push('--push');
    }
    if (opts.load) {
        args.push('--load');
    }
    if (opts.noCache) {
        args.push('--no-cache');
    }
    if (opts.cacheFrom) {
        args.push('--cache-from', opts.cacheFrom);
        args.push('--cache-to', opts.cacheTo || opts.cacheFrom);
    }
    else if (opts.cacheDirFrom) {
        args.push('--cache-from', `type=local,src=${opts.cacheDirFrom}`);
        args.push('--cache-to', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
    }
    args.push('--metadata-file', DOCKER_METADATA_FILE);
    args.push('.');
    const result = await exec.exec('docker', args, {
        cwd: opts.context,
        env: {
            ...process.env,
            DOCKER_BUILDKIT: '1',
        },
    });
    if (result !== 0) {
        throw new Error(`docker buildx build failed with exit code ${result}`);
    }
}
function readDockerMetadata() {
    if (!fs.existsSync(DOCKER_METADATA_FILE)) {
        return { imageId: '', digest: '' };
    }
    try {
        const data = JSON.parse(fs.readFileSync(DOCKER_METADATA_FILE, 'utf8'));
        return {
            imageId: data['containerimage.config.digest'] || '',
            digest: data['containerimage.digest'] || '',
        };
    }
    catch (error) {
        core.warning(`Failed to parse Docker metadata file: ${error.message}`);
        return { imageId: '', digest: '' };
    }
}
function materializeMaybeFile(value, filename, rootDir) {
    if (!value.trim()) {
        return '';
    }
    const candidate = path.resolve(rootDir, value);
    if (fs.existsSync(candidate)) {
        return candidate;
    }
    const target = path.join(os.tmpdir(), filename);
    fs.writeFileSync(target, value);
    return target;
}
async function installBuildctl() {
    addLocalBinPaths();
    try {
        const result = await exec.exec('buildctl', ['--version'], {
            ignoreReturnCode: true,
            silent: true,
        });
        if (result === 0) {
            return;
        }
    }
    catch {
    }
    const version = 'v0.19.0';
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'buildctl-'));
    const archivePath = path.join(tmpDir, 'buildkit.tar.gz');
    const installDir = path.join(os.homedir(), '.local', 'bin');
    try {
        const url = `https://github.com/moby/buildkit/releases/download/${version}/buildkit-${version}.linux-amd64.tar.gz`;
        const curlCode = await exec.exec('curl', ['-fsSL', '--output', archivePath, url], { ignoreReturnCode: true });
        if (curlCode !== 0) {
            throw new Error(`Failed to download buildctl from ${url}`);
        }
        await exec.exec('tar', ['-xzf', archivePath, '-C', tmpDir]);
        await fs.promises.mkdir(installDir, { recursive: true });
        const srcPath = path.join(tmpDir, 'bin', process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
        const destPath = path.join(installDir, process.platform === 'win32' ? 'buildctl.exe' : 'buildctl');
        await fs.promises.copyFile(srcPath, destPath);
        if (process.platform !== 'win32') {
            await fs.promises.chmod(destPath, 0o755);
        }
        core.addPath(installDir);
    }
    finally {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
}
async function buildWithBuildctl(opts) {
    var _a;
    const args = ['--addr', opts.addr];
    if (opts.tlsCa || opts.tlsCert || opts.tlsKey) {
        if (opts.tlsCa) {
            args.push('--tlscacert', opts.tlsCa);
        }
        if (opts.tlsCert) {
            args.push('--tlscert', opts.tlsCert);
        }
        if (opts.tlsKey) {
            args.push('--tlskey', opts.tlsKey);
        }
    }
    if (opts.tlsSkipVerify) {
        args.push('--tlsskipverify');
    }
    args.push('build', '--frontend', 'dockerfile.v0');
    args.push('--local', `context=${opts.contextPath}`);
    args.push('--local', `dockerfile=${opts.dockerfileDir}`);
    args.push('--opt', `filename=${opts.dockerfileName}`);
    if (opts.noCache) {
        args.push('--no-cache');
    }
    if (opts.platforms) {
        args.push('--opt', `platform=${opts.platforms}`);
    }
    if (opts.target) {
        args.push('--opt', `target=${opts.target}`);
    }
    for (const buildArg of opts.buildArgs) {
        args.push('--opt', `build-arg:${buildArg}`);
    }
    for (const secret of opts.secrets) {
        args.push('--secret', secret);
    }
    for (const ssh of opts.sshSpecs) {
        args.push('--ssh', ssh);
    }
    if (opts.importCache) {
        args.push('--import-cache', opts.importCache);
        args.push('--export-cache', opts.exportCache || opts.importCache);
    }
    else if (opts.cacheDirFrom) {
        args.push('--import-cache', `type=local,src=${opts.cacheDirFrom}`);
        args.push('--export-cache', `type=local,dest=${opts.cacheDirTo},mode=${opts.cacheMode}`);
    }
    if ((_a = opts.output) === null || _a === void 0 ? void 0 : _a.trim()) {
        args.push('--output', opts.output.trim());
    }
    else {
        const nameParams = opts.imageTags.map((tag) => `name=${tag}`).join(',');
        args.push('--output', `type=image,${nameParams},push=${opts.push ? 'true' : 'false'}`);
    }
    args.push('--metadata-file', opts.metadataFile);
    const result = await exec.exec('buildctl', args);
    if (result !== 0) {
        throw new Error(`buildctl failed with exit code ${result}`);
    }
}
function readBuildkitDigest(metadataFile) {
    if (!fs.existsSync(metadataFile)) {
        return '';
    }
    try {
        const data = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        return data['containerimage.digest'] || '';
    }
    catch (error) {
        core.warning(`Failed to parse BuildKit metadata file: ${error.message}`);
        return '';
    }
}
function writeBazelrc(port, readOnly) {
    const bazelrcPath = path.join(os.homedir(), '.bazelrc');
    const remoteMaxConnections = parseInt(process.env.BORINGCACHE_BAZEL_REMOTE_MAX_CONNECTIONS || '', 10);
    const maxConnections = Number.isFinite(remoteMaxConnections) && remoteMaxConnections > 0
        ? remoteMaxConnections
        : 64;
    const config = [
        '',
        '# BoringCache remote cache',
        `build --remote_cache=http://127.0.0.1:${port}`,
        `build --remote_upload_local_results=${!readOnly}`,
        'build --remote_download_minimal',
        `build --remote_max_connections=${maxConnections}`,
        '',
    ].join('\n');
    fs.appendFileSync(bazelrcPath, config);
}
function resolveGradleHome(input) {
    const gradleHome = input || '~/.gradle';
    if (gradleHome.startsWith('~')) {
        return path.join(os.homedir(), gradleHome.slice(1));
    }
    return path.resolve(gradleHome);
}
function resolveUserPath(input, workingDirectory) {
    if (input.startsWith('~')) {
        return path.join(os.homedir(), input.slice(1));
    }
    if (path.isAbsolute(input)) {
        return input;
    }
    return path.resolve(workingDirectory, input);
}
function writeGradleInitScript(gradleHome, port, readOnly) {
    const initDir = path.join(gradleHome, 'init.d');
    fs.mkdirSync(initDir, { recursive: true });
    const initScript = `gradle.settingsEvaluated { settings ->
    settings.buildCache {
        remote(HttpBuildCache) {
            url = "http://127.0.0.1:${port}/cache/"
            push = ${!readOnly}
            allowInsecureProtocol = true
        }
    }
}
`;
    fs.writeFileSync(path.join(initDir, 'boringcache-cache.gradle'), initScript);
}
function enableGradleBuildCache(gradleHome) {
    fs.mkdirSync(gradleHome, { recursive: true });
    fs.appendFileSync(path.join(gradleHome, 'gradle.properties'), '\norg.gradle.caching=true\n');
}
function ensureMavenBuildCacheExtension(extensionsPath, version) {
    const extensionBlock = [
        '  <extension>',
        '    <groupId>org.apache.maven.extensions</groupId>',
        '    <artifactId>maven-build-cache-extension</artifactId>',
        `    <version>${version}</version>`,
        '  </extension>',
    ].join('\n');
    fs.mkdirSync(path.dirname(extensionsPath), { recursive: true });
    if (fs.existsSync(extensionsPath)) {
        const existing = fs.readFileSync(extensionsPath, 'utf8');
        if (existing.includes('<artifactId>maven-build-cache-extension</artifactId>')) {
            return;
        }
        if (existing.includes('</extensions>')) {
            fs.writeFileSync(extensionsPath, existing.replace('</extensions>', `${extensionBlock}\n</extensions>`));
            return;
        }
    }
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<extensions xmlns="http://maven.apache.org/EXTENSIONS/1.0.0"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://maven.apache.org/EXTENSIONS/1.0.0 https://maven.apache.org/xsd/core-extensions-1.0.0.xsd">
${extensionBlock}
</extensions>
`;
    fs.writeFileSync(extensionsPath, content);
}
function writeMavenBuildCacheConfig(configPath, port, readOnly, cacheId) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<cache xmlns="http://maven.apache.org/BUILD-CACHE-CONFIG/1.2.0"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="http://maven.apache.org/BUILD-CACHE-CONFIG/1.2.0 https://maven.apache.org/xsd/build-cache-config-1.2.0.xsd">
  <configuration>
    <remote enabled="true" saveToRemote="${!readOnly}" transport="resolver" id="${cacheId}">
      <url>http://127.0.0.1:${port}</url>
    </remote>
  </configuration>
</cache>
`;
    fs.writeFileSync(configPath, content);
}
async function execRustBoringCache(args) {
    rustLastOutput = '';
    let output = '';
    const code = await execBoringCache(args, {
        silent: true,
        listeners: {
            stdout: (data) => {
                const text = data.toString();
                output += text;
                process.stdout.write(text);
            },
            stderr: (data) => {
                const text = data.toString();
                output += text;
                process.stderr.write(text);
            },
        },
    });
    rustLastOutput = output;
    return code;
}
function wasRustCacheHit(exitCode) {
    if (exitCode !== 0) {
        return false;
    }
    if (!rustLastOutput) {
        return true;
    }
    return ![/Cache miss/i, /No cache entries/i, /Found 0\//i].some((pattern) => pattern.test(rustLastOutput));
}
function getCargoHome() {
    return process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
}
function configureCargoEnv() {
    const cargoHome = getCargoHome();
    process.env.CARGO_HOME = cargoHome;
    core.exportVariable('CARGO_HOME', cargoHome);
    core.addPath(path.join(cargoHome, 'bin'));
    core.exportVariable('CARGO_INCREMENTAL', '0');
    core.exportVariable('CARGO_TERM_COLOR', 'always');
}
async function setupRustToolchain(version, options) {
    const profile = options.profile || 'minimal';
    await exec.exec('rustup', ['toolchain', 'install', version, '--profile', profile, '--no-self-update']);
    await exec.exec('rustup', ['default', version]);
    for (const target of parseList(options.targets || '', /,/)) {
        await exec.exec('rustup', ['target', 'add', target]);
    }
    for (const component of parseList(options.components || '', /,/)) {
        await exec.exec('rustup', ['component', 'add', component]);
    }
    await exec.exec('rustc', ['--version']);
}
async function detectRustVersion(workingDir, inputVersion) {
    if (inputVersion) {
        return inputVersion;
    }
    const toolchainToml = path.join(workingDir, 'rust-toolchain.toml');
    try {
        const content = await fs.promises.readFile(toolchainToml, 'utf-8');
        const match = content.match(/channel\s*=\s*["']([^"']+)["']/);
        if (match === null || match === void 0 ? void 0 : match[1]) {
            return match[1];
        }
    }
    catch {
    }
    const toolchainFile = path.join(workingDir, 'rust-toolchain');
    try {
        return (await fs.promises.readFile(toolchainFile, 'utf-8')).trim();
    }
    catch {
    }
    const toolVersionsFile = path.join(workingDir, '.tool-versions');
    try {
        const content = await fs.promises.readFile(toolVersionsFile, 'utf-8');
        const rustLine = content.split('\n').find((line) => line.startsWith('rust '));
        if (rustLine) {
            return rustLine.split(/\s+/)[1].trim();
        }
    }
    catch {
    }
    return 'stable';
}
async function hasGitDependencies(lockPath) {
    try {
        const content = await fs.promises.readFile(lockPath, 'utf-8');
        return content.includes('source = "git+');
    }
    catch {
        return false;
    }
}
function getSccacheDir() {
    return process.env.SCCACHE_DIR || path.join(os.homedir(), '.cache', 'sccache');
}
function configureSccacheEnv(cacheSize) {
    const sccacheDir = getSccacheDir();
    process.env.RUSTC_WRAPPER = 'sccache';
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    process.env.SCCACHE_DIR = sccacheDir;
    core.exportVariable('SCCACHE_DIR', sccacheDir);
    process.env.SCCACHE_CACHE_SIZE = cacheSize;
    core.exportVariable('SCCACHE_CACHE_SIZE', cacheSize);
    core.exportVariable('CC', 'sccache cc');
    core.exportVariable('CXX', 'sccache c++');
    core.exportVariable('SCCACHE_IDLE_TIMEOUT', process.env.SCCACHE_IDLE_TIMEOUT || '0');
    fs.mkdirSync(sccacheDir, { recursive: true });
}
async function startSccacheServer() {
    await exec.exec('sccache', ['--start-server'], { ignoreReturnCode: true });
}
async function installSccache(versionInput = '0.13.0') {
    addLocalBinPaths();
    if (await (0, action_core_1.hasToolVersionOnPath)('sccache', versionInput)) {
        core.info(`Using existing sccache ${versionInput} from PATH`);
        return;
    }
    const normalizedVersion = versionInput.startsWith('v') ? versionInput : `v${versionInput}`;
    let assetName = null;
    if (process.platform === 'linux') {
        if (process.arch === 'x64') {
            assetName = `sccache-${normalizedVersion}-x86_64-unknown-linux-musl`;
        }
        else if (process.arch === 'arm64') {
            assetName = `sccache-${normalizedVersion}-aarch64-unknown-linux-musl`;
        }
    }
    else if (process.platform === 'darwin' && process.arch === 'arm64') {
        assetName = `sccache-${normalizedVersion}-aarch64-apple-darwin`;
    }
    else if (process.platform === 'win32' && process.arch === 'x64') {
        assetName = `sccache-${normalizedVersion}-x86_64-pc-windows-msvc`;
    }
    if (!assetName) {
        await exec.exec('cargo', ['install', 'sccache', '--locked']);
        return;
    }
    const extension = process.platform === 'win32' ? '.zip' : '.tar.gz';
    const url = `https://github.com/mozilla/sccache/releases/download/${normalizedVersion}/${assetName}${extension}`;
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sccache-'));
    const archivePath = path.join(tempDir, `sccache${extension}`);
    try {
        const curlCode = await exec.exec('curl', ['-sS', '--fail', '--location', '--output', archivePath, url], {
            ignoreReturnCode: true,
        });
        if (curlCode !== 0) {
            throw new Error(`Failed to download sccache from ${url}`);
        }
        if (process.platform === 'win32') {
            await exec.exec('unzip', ['-q', archivePath, '-d', tempDir]);
        }
        else {
            await exec.exec('tar', ['-xzf', archivePath, '-C', tempDir]);
        }
        const installDir = path.join(os.homedir(), '.local', 'bin');
        await fs.promises.mkdir(installDir, { recursive: true });
        const binaryName = process.platform === 'win32' ? 'sccache.exe' : 'sccache';
        const srcPath = path.join(tempDir, assetName, binaryName);
        const destPath = path.join(installDir, binaryName);
        await fs.promises.copyFile(srcPath, destPath);
        if (process.platform !== 'win32') {
            await fs.promises.chmod(destPath, 0o755);
        }
        core.addPath(installDir);
    }
    finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}
async function stopSccacheServer() {
    try {
        await exec.exec('sccache', ['--show-stats'], { ignoreReturnCode: true });
        await exec.exec('sccache', ['--stop-server'], { ignoreReturnCode: true });
    }
    catch {
    }
}
async function startPortableCacheProxy(workspace, port, tag, readOnly = false) {
    const proxy = await (0, action_core_1.startRegistryProxy)({
        command: 'cache-registry',
        workspace,
        tag,
        host: '127.0.0.1',
        port,
        noPlatform: true,
        noGit: true,
        readOnly,
    });
    await (0, action_core_1.waitForProxy)(proxy.port, undefined, proxy.pid);
    return proxy;
}
function configureTurboRemoteEnv(apiUrl, token, team) {
    core.exportVariable('TURBO_API', apiUrl);
    core.exportVariable('TURBO_TOKEN', token);
    core.exportVariable('TURBO_TEAM', team || 'team_boringcache');
}
function resolveNodePackageManagerCacheDir(packageManager) {
    if (!packageManager) {
        return null;
    }
    switch (packageManager.name) {
        case 'pnpm':
            return process.env.PNPM_STORE_DIR || process.env.NPM_CONFIG_STORE_DIR || packageManager.cacheDir;
        case 'yarn':
            return process.env.YARN_CACHE_FOLDER || packageManager.cacheDir;
        case 'npm':
            return process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE || packageManager.cacheDir;
    }
}
function configureNodePackageManagerEnv(packageManager) {
    if (!packageManager) {
        return null;
    }
    const cacheDir = resolveNodePackageManagerCacheDir(packageManager);
    if (!cacheDir) {
        return null;
    }
    ensureDir(cacheDir);
    switch (packageManager.name) {
        case 'pnpm':
            core.exportVariable('PNPM_STORE_DIR', cacheDir);
            core.exportVariable('NPM_CONFIG_STORE_DIR', cacheDir);
            break;
        case 'yarn':
            core.exportVariable('YARN_CACHE_FOLDER', cacheDir);
            core.exportVariable('YARN_ENABLE_GLOBAL_CACHE', 'false');
            break;
        case 'npm':
            core.exportVariable('npm_config_cache', cacheDir);
            core.exportVariable('NPM_CONFIG_CACHE', cacheDir);
            break;
    }
    return cacheDir;
}
async function ensureCorepackPackageManager(workingDirectory, packageManager, runtimeTools) {
    if (!packageManager || packageManager.name === 'npm' || runtimeTools.some((tool) => tool.name === packageManager.name)) {
        return;
    }
    const corepackEnabled = await exec.exec('corepack', ['enable'], { cwd: workingDirectory, ignoreReturnCode: true });
    if (corepackEnabled !== 0) {
        core.notice(`corepack enable failed for ${packageManager.name}; continuing without corepack bootstrap`);
        return;
    }
    if (packageManager.packageManagerField) {
        await exec.exec('corepack', ['install'], { cwd: workingDirectory, ignoreReturnCode: true });
        return;
    }
    if (packageManager.version) {
        await exec.exec('corepack', ['prepare', `${packageManager.name}@${packageManager.version}`, '--activate'], { cwd: workingDirectory, ignoreReturnCode: true });
    }
}
function configureSccacheProxyEnv(port) {
    const endpoint = `http://127.0.0.1:${port}/`;
    core.exportVariable('SCCACHE_WEBDAV_ENDPOINT', endpoint);
    core.exportVariable('RUSTC_WRAPPER', 'sccache');
    core.exportVariable('CC', 'sccache cc');
    core.exportVariable('CXX', 'sccache c++');
    core.exportVariable('SCCACHE_IDLE_TIMEOUT', process.env.SCCACHE_IDLE_TIMEOUT || '0');
}
function getModeCacheTag(inputCacheTag, defaultPrefix) {
    return (0, action_core_1.getCacheTagPrefix)(inputCacheTag, defaultPrefix);
}
function toolEnabled(plan, toolName) {
    return plan.runtimeTools.some((tool) => tool.name === toolName);
}
async function runDockerRestore(plan, inputs) {
    const context = path.resolve(plan.workingDirectory, core.getInput('context') || '.');
    const dockerfile = core.getInput('dockerfile') || 'Dockerfile';
    const dockerCommand = core.getInput('docker-command') || 'build';
    const shouldBuild = dockerCommand !== 'setup';
    const imageInput = core.getInput('image') || '';
    const image = shouldBuild
        ? core.getInput('image', { required: true })
        : (imageInput || 'boringcache/docker-setup');
    const tags = parseList(core.getInput('tags') || 'latest');
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const push = parseBoolean(core.getInput('push'), false);
    const load = parseBoolean(core.getInput('load'), true) && !platforms;
    const noCache = parseBoolean(core.getInput('no-cache'), false);
    const cacheMode = core.getInput('cache-mode') || 'max';
    const driver = core.getInput('driver') || 'docker-container';
    const driverOpts = parseMultiline(core.getInput('driver-opts') || '');
    const buildkitdConfigInline = core.getInput('buildkitd-config-inline') || '';
    const cacheBackend = core.getInput('cache-backend') || 'registry';
    const registryTag = core.getInput('registry-tag') || '';
    const cacheTag = inputs.cacheTag || slugify(image);
    const cacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
    const useRegistryProxy = cacheBackend !== 'local';
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag', cacheTag);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('exclude', inputs.exclude);
    const builderName = await setupBuildxBuilder(driver, driverOpts, buildkitdConfigInline, useRegistryProxy);
    core.setOutput('buildx-name', builderName);
    core.setOutput('buildx-platforms', await getBuilderPlatforms(builderName));
    await setupQemuIfNeeded(platforms);
    if (useRegistryProxy) {
        let proxyBindHost = '127.0.0.1';
        let refHost = '127.0.0.1';
        if (driver === 'docker-container') {
            const containerName = `buildx_buildkit_${builderName}0`;
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = parseInt(inputs.proxyPort || '5000', 10);
        const proxy = await (0, action_core_1.startRegistryProxy)({
            command: 'docker-registry',
            workspace: plan.workspace,
            tag: registryTag || cacheTag,
            host: proxyBindHost,
            port: requestedPort,
            noGit: inputs.proxyNoGit,
            noPlatform: inputs.proxyNoPlatform,
            verbose: inputs.verbose,
            readOnly: inputs.readOnly,
        });
        await (0, action_core_1.waitForProxy)(proxy.port, undefined, proxy.pid);
        saveModeState('proxy-pid', String(proxy.pid));
        core.setOutput('proxy-port', String(proxy.port));
        core.setOutput('proxy-log-path', registryProxyLogPath(proxy.port));
        if (shouldBuild) {
            const ref = getRegistryRef(proxy.port, cacheTag, refHost);
            const registryCache = getRegistryCacheFlags(ref, cacheMode);
            await buildDockerImage({
                dockerfile,
                context,
                image,
                tags,
                buildArgs,
                secrets,
                target,
                platforms,
                push,
                load,
                noCache,
                builder: builderName,
                cacheMode,
                cacheFrom: registryCache.from,
                cacheTo: registryCache.to,
            });
        }
    }
    else {
        ensureDir(DOCKER_CACHE_DIR_FROM);
        await restoreSimpleCache(plan.workspace, cacheTag, DOCKER_CACHE_DIR_FROM, cacheFlags);
        if (shouldBuild) {
            ensureDir(DOCKER_CACHE_DIR_TO);
            saveModeState('cache-dir', DOCKER_CACHE_DIR_TO);
            await buildDockerImage({
                dockerfile,
                context,
                image,
                tags,
                buildArgs,
                secrets,
                target,
                platforms,
                push,
                load,
                noCache,
                builder: builderName,
                cacheMode,
                cacheDirFrom: DOCKER_CACHE_DIR_FROM,
                cacheDirTo: DOCKER_CACHE_DIR_TO,
            });
        }
    }
    if (shouldBuild) {
        const { imageId, digest } = readDockerMetadata();
        core.setOutput('image-id', imageId);
        core.setOutput('digest', digest);
    }
    core.setOutput('workspace', plan.workspace);
    core.setOutput('cache-tag', cacheTag);
    return {};
}
async function runDockerSave() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        await (0, action_core_1.stopRegistryProxy)(parseInt(proxyPid, 10));
        return;
    }
    const workspace = getModeState('workspace');
    const cacheDir = getModeState('cache-dir');
    const cacheTag = getModeState('cache-tag');
    if (!workspace || !cacheDir || !cacheTag) {
        return;
    }
    addLocalBinPaths();
    await saveSimpleCache(workspace, cacheTag, cacheDir, {
        verbose: getModeState('verbose') === 'true',
        exclude: getModeState('exclude'),
    });
}
async function runBuildkitRestore(plan, inputs) {
    const workspaceRoot = process.env.GITHUB_WORKSPACE || plan.workingDirectory;
    const contextInput = core.getInput('context') || '.';
    const contextPath = path.resolve(plan.workingDirectory, contextInput);
    const dockerfileInput = core.getInput('dockerfile') || 'Dockerfile';
    const dockerfilePath = path.resolve(plan.workingDirectory, contextInput, dockerfileInput);
    const dockerfileDir = path.dirname(dockerfilePath);
    const dockerfileName = path.basename(dockerfilePath);
    if (!fs.existsSync(contextPath)) {
        throw new Error(`Context path does not exist: ${contextPath}`);
    }
    if (!fs.existsSync(dockerfilePath)) {
        throw new Error(`Dockerfile does not exist: ${dockerfilePath}`);
    }
    const image = core.getInput('image', { required: true });
    const tags = parseList(core.getInput('tags') || 'latest');
    const imageTags = tags.length > 0 ? tags.map((tag) => `${image}:${tag}`) : [`${image}:latest`];
    const push = parseBoolean(core.getInput('push'), false);
    const output = core.getInput('output') || '';
    const buildArgs = parseMultiline(core.getInput('build-args') || '');
    const secrets = parseMultiline(core.getInput('secrets') || '');
    const sshSpecs = parseMultiline(core.getInput('ssh') || '');
    const target = core.getInput('target') || '';
    const platforms = core.getInput('platforms') || '';
    const noCache = parseBoolean(core.getInput('no-cache'), false);
    const cacheMode = core.getInput('cache-mode') || 'max';
    const buildkitHost = core.getInput('buildkit-host', { required: true });
    const tlsCaInput = core.getInput('buildkit-tls-ca') || '';
    const tlsCertInput = core.getInput('buildkit-tls-cert') || '';
    const tlsKeyInput = core.getInput('buildkit-tls-key') || '';
    const tlsSkipVerify = parseBoolean(core.getInput('buildkit-tls-skip-verify'), false);
    const cacheBackend = core.getInput('cache-backend') || 'registry';
    const registryTag = core.getInput('registry-tag') || '';
    const cacheTag = inputs.cacheTag || slugify(image);
    const cacheFlags = { verbose: inputs.verbose, exclude: inputs.exclude };
    const useRegistryProxy = cacheBackend !== 'local';
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag', cacheTag);
    saveModeState('verbose', String(inputs.verbose));
    saveModeState('exclude', inputs.exclude);
    if (fs.existsSync(BUILDKIT_METADATA_FILE)) {
        fs.rmSync(BUILDKIT_METADATA_FILE);
    }
    await installBuildctl();
    const tlsCa = materializeMaybeFile(tlsCaInput, 'buildkit-ca.pem', workspaceRoot);
    const tlsCert = materializeMaybeFile(tlsCertInput, 'buildkit-cert.pem', workspaceRoot);
    const tlsKey = materializeMaybeFile(tlsKeyInput, 'buildkit-key.pem', workspaceRoot);
    if (useRegistryProxy) {
        let proxyBindHost = '127.0.0.1';
        let refHost = '127.0.0.1';
        if (buildkitHost.startsWith('docker-container://')) {
            const containerName = buildkitHost.replace('docker-container://', '');
            const networkMode = await getContainerNetworkMode(containerName);
            if (networkMode !== 'host') {
                proxyBindHost = '0.0.0.0';
                refHost = await getContainerGateway(containerName);
            }
        }
        const requestedPort = parseInt(inputs.proxyPort || '5000', 10);
        const proxy = await (0, action_core_1.startRegistryProxy)({
            command: 'docker-registry',
            workspace: plan.workspace,
            tag: registryTag || cacheTag,
            host: proxyBindHost,
            port: requestedPort,
            noGit: inputs.proxyNoGit,
            noPlatform: inputs.proxyNoPlatform,
            verbose: inputs.verbose,
            readOnly: inputs.readOnly,
        });
        await (0, action_core_1.waitForProxy)(proxy.port, undefined, proxy.pid);
        saveModeState('proxy-pid', String(proxy.pid));
        core.setOutput('proxy-port', String(proxy.port));
        core.setOutput('proxy-log-path', registryProxyLogPath(proxy.port));
        const ref = getRegistryRef(proxy.port, cacheTag, refHost);
        const registryCache = getRegistryCacheFlags(ref, cacheMode);
        await buildWithBuildctl({
            addr: buildkitHost,
            tlsCa,
            tlsCert,
            tlsKey,
            tlsSkipVerify,
            contextPath,
            dockerfileDir,
            dockerfileName,
            buildArgs,
            secrets,
            sshSpecs,
            target,
            platforms,
            cacheMode,
            importCache: registryCache.from,
            exportCache: registryCache.to,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        });
    }
    else {
        ensureDir(BUILDKIT_CACHE_DIR_FROM);
        ensureDir(BUILDKIT_CACHE_DIR_TO);
        saveModeState('cache-dir', BUILDKIT_CACHE_DIR_TO);
        await restoreSimpleCache(plan.workspace, cacheTag, BUILDKIT_CACHE_DIR_FROM, cacheFlags);
        await buildWithBuildctl({
            addr: buildkitHost,
            tlsCa,
            tlsCert,
            tlsKey,
            tlsSkipVerify,
            contextPath,
            dockerfileDir,
            dockerfileName,
            buildArgs,
            secrets,
            sshSpecs,
            target,
            platforms,
            cacheMode,
            cacheDirFrom: BUILDKIT_CACHE_DIR_FROM,
            cacheDirTo: BUILDKIT_CACHE_DIR_TO,
            output,
            imageTags,
            push,
            noCache,
            metadataFile: BUILDKIT_METADATA_FILE,
        });
    }
    core.setOutput('digest', readBuildkitDigest(BUILDKIT_METADATA_FILE));
    core.setOutput('workspace', plan.workspace);
    core.setOutput('cache-tag', cacheTag);
    return {};
}
async function runBuildkitSave() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        await (0, action_core_1.stopRegistryProxy)(parseInt(proxyPid, 10));
        return;
    }
    const workspace = getModeState('workspace');
    const cacheDir = getModeState('cache-dir');
    const cacheTag = getModeState('cache-tag');
    if (!workspace || !cacheDir || !cacheTag) {
        return;
    }
    addLocalBinPaths();
    await saveSimpleCache(workspace, cacheTag, cacheDir, {
        verbose: getModeState('verbose') === 'true',
        exclude: getModeState('exclude'),
    });
}
async function runBazelRestore(plan, inputs) {
    var _a, _b;
    const inputVersion = core.getInput('bazel-version') || '';
    const runtimeVersion = ((_a = plan.runtimeTools.find((tool) => tool.name === 'bazel')) === null || _a === void 0 ? void 0 : _a.version) || '';
    const bazelVersion = inputVersion || runtimeVersion;
    const cacheTag = inputs.cacheTag || getModeCacheTag('', 'bazel');
    const proxyPort = parseInt(inputs.proxyPort || '0', 10) || await (0, action_core_1.findAvailablePort)();
    saveModeState('proxy-pid', '');
    if (bazelVersion) {
        core.exportVariable('USE_BAZEL_VERSION', bazelVersion);
    }
    const proxy = await (0, action_core_1.startRegistryProxy)({
        command: 'cache-registry',
        workspace: plan.workspace,
        tag: cacheTag,
        host: '127.0.0.1',
        port: proxyPort,
        noGit: inputs.proxyNoGit,
        noPlatform: inputs.proxyNoPlatform,
        verbose: inputs.verbose,
        readOnly: inputs.readOnly,
    });
    await (0, action_core_1.waitForProxy)(proxy.port, undefined, proxy.pid);
    saveModeState('proxy-pid', String(proxy.pid));
    writeBazelrc(proxy.port, (_b = proxy.readOnly) !== null && _b !== void 0 ? _b : inputs.readOnly);
    core.setOutput('cache-tag', cacheTag);
    core.setOutput('proxy-port', String(proxy.port));
    core.setOutput('proxy-log-path', registryProxyLogPath(proxy.port));
    core.setOutput('workspace', plan.workspace);
    return {};
}
async function runGradleRestore(plan, inputs) {
    var _a;
    const cacheTag = inputs.cacheTag || getModeCacheTag('', 'gradle');
    const proxyPort = parseInt(inputs.proxyPort || '0', 10) || await (0, action_core_1.findAvailablePort)();
    const gradleHome = resolveGradleHome(core.getInput('gradle-home') || '');
    const enableBuildCache = parseBoolean(core.getInput('enable-build-cache'), true);
    const proxy = await (0, action_core_1.startRegistryProxy)({
        command: 'cache-registry',
        workspace: plan.workspace,
        tag: cacheTag,
        host: '127.0.0.1',
        port: proxyPort,
        noGit: inputs.proxyNoGit,
        noPlatform: inputs.proxyNoPlatform,
        verbose: inputs.verbose,
        readOnly: inputs.readOnly,
    });
    await (0, action_core_1.waitForProxy)(proxy.port, undefined, proxy.pid);
    saveModeState('proxy-pid', String(proxy.pid));
    writeGradleInitScript(gradleHome, proxy.port, (_a = proxy.readOnly) !== null && _a !== void 0 ? _a : inputs.readOnly);
    if (enableBuildCache) {
        enableGradleBuildCache(gradleHome);
    }
    core.setOutput('cache-tag', cacheTag);
    core.setOutput('proxy-port', String(proxy.port));
    core.setOutput('proxy-log-path', registryProxyLogPath(proxy.port));
    core.setOutput('workspace', plan.workspace);
    return {};
}
async function runMavenRestore(plan, inputs) {
    var _a;
    const cacheTag = inputs.cacheTag || getModeCacheTag('', 'maven');
    const proxyPort = parseInt(inputs.proxyPort || '0', 10) || await (0, action_core_1.findAvailablePort)();
    const workingDirectory = plan.workingDirectory;
    const extensionsPath = resolveUserPath(core.getInput('maven-extensions-path') || '.mvn/extensions.xml', workingDirectory);
    const buildCacheConfigPath = resolveUserPath(core.getInput('maven-build-cache-config-path') || '.mvn/maven-build-cache-config.xml', workingDirectory);
    const localRepo = resolveUserPath(core.getInput('maven-local-repo') || '~/.m2/repository', workingDirectory);
    const extensionVersion = core.getInput('maven-build-cache-extension-version') || '1.2.2';
    const cacheId = core.getInput('maven-build-cache-id') || 'boringcache';
    const proxy = await (0, action_core_1.startRegistryProxy)({
        command: 'cache-registry',
        workspace: plan.workspace,
        tag: cacheTag,
        host: '127.0.0.1',
        port: proxyPort,
        noGit: inputs.proxyNoGit,
        noPlatform: inputs.proxyNoPlatform,
        verbose: inputs.verbose,
        readOnly: inputs.readOnly,
    });
    await (0, action_core_1.waitForProxy)(proxy.port, undefined, proxy.pid);
    saveModeState('proxy-pid', String(proxy.pid));
    ensureMavenBuildCacheExtension(extensionsPath, extensionVersion);
    writeMavenBuildCacheConfig(buildCacheConfigPath, proxy.port, (_a = proxy.readOnly) !== null && _a !== void 0 ? _a : inputs.readOnly, cacheId);
    ensureDir(localRepo);
    core.setOutput('cache-tag', cacheTag);
    core.setOutput('proxy-port', String(proxy.port));
    core.setOutput('proxy-log-path', registryProxyLogPath(proxy.port));
    core.setOutput('maven-extensions-path', extensionsPath);
    core.setOutput('maven-build-cache-config-path', buildCacheConfigPath);
    core.setOutput('maven-local-repo', localRepo);
    core.setOutput('workspace', plan.workspace);
    return {};
}
async function runTurboProxyRestore(plan, inputs) {
    const cacheTag = inputs.cacheTag || getModeCacheTag('', 'turbo');
    const turboApiUrl = core.getInput('turbo-api-url') || '';
    const turboToken = core.getInput('turbo-token') || 'boringcache';
    const turboTeam = core.getInput('turbo-team') || '';
    const preferredPort = parseInt(core.getInput('turbo-port') || inputs.proxyPort || '4227', 10);
    const packageManager = await (0, utils_1.detectNodePackageManager)(plan.workingDirectory);
    const packageManagerCacheDir = configureNodePackageManagerEnv(packageManager);
    await ensureCorepackPackageManager(plan.workingDirectory, packageManager, plan.runtimeTools);
    if (packageManager) {
        core.setOutput('package-manager', packageManager.name);
        core.setOutput('package-manager-cache-dir', packageManagerCacheDir || packageManager.cacheDir);
    }
    if (turboApiUrl) {
        configureTurboRemoteEnv(turboApiUrl, turboToken, turboTeam);
        core.setOutput('workspace', plan.workspace);
        core.setOutput('cache-tag', cacheTag);
        return {};
    }
    let proxy;
    try {
        proxy = await startPortableCacheProxy(plan.workspace, preferredPort, cacheTag, inputs.readOnly);
    }
    catch {
        proxy = await startPortableCacheProxy(plan.workspace, await (0, action_core_1.findAvailablePort)(), cacheTag, inputs.readOnly);
    }
    saveModeState('proxy-pid', String(proxy.pid));
    configureTurboRemoteEnv(`http://127.0.0.1:${proxy.port}`, turboToken, turboTeam);
    core.setOutput('cache-tag', cacheTag);
    core.setOutput('proxy-port', String(proxy.port));
    core.setOutput('proxy-log-path', registryProxyLogPath(proxy.port));
    core.setOutput('workspace', plan.workspace);
    return {};
}
async function runRustRestore(plan, inputs) {
    var _a;
    const cacheTagPrefix = inputs.cacheTag || getModeCacheTag('', 'rust');
    const inputVersion = core.getInput('rust-version') || core.getInput('toolchain');
    const workingDir = plan.workingDirectory;
    const cacheCargo = core.getInput('cache-cargo') !== 'false';
    const cacheCargoBin = core.getInput('cache-cargo-bin') === 'true';
    const cacheTarget = core.getInput('cache-target') !== 'false';
    const useSccache = core.getInput('sccache') === 'true';
    const sccacheVersion = core.getInput('sccache-version') || '0.13.0';
    const sccacheMode = core.getInput('sccache-mode') || 'local';
    const sccacheCacheSize = core.getInput('sccache-cache-size') || '5G';
    const targets = core.getInput('targets');
    const components = core.getInput('components');
    const profile = core.getInput('profile') || 'minimal';
    const rustVersion = await detectRustVersion(workingDir, inputVersion);
    core.setOutput('workspace', plan.workspace);
    core.setOutput('rust-version', rustVersion);
    core.setOutput('cache-tag', cacheTagPrefix);
    saveModeState('workspace', plan.workspace);
    saveModeState('cache-tag-prefix', cacheTagPrefix);
    saveModeState('rust-version', rustVersion);
    saveModeState('working-dir', workingDir);
    saveModeState('cache-cargo', String(cacheCargo));
    saveModeState('cache-cargo-bin', String(cacheCargoBin));
    saveModeState('cache-target', String(cacheTarget));
    saveModeState('use-sccache', String(useSccache));
    saveModeState('sccache-mode', sccacheMode);
    saveModeState('verbose', String(inputs.verbose));
    configureCargoEnv();
    const cargoHome = getCargoHome();
    const cargoRegistryTag = core.getInput('cargo-tag') || `${cacheTagPrefix}-cargo-registry`;
    const cargoGitTag = core.getInput('cargo-git-tag') || `${cacheTagPrefix}-cargo-git`;
    const cargoBinTag = core.getInput('cargo-bin-tag') || `${cacheTagPrefix}-cargo-bin`;
    const rustMajorMinor = ((_a = rustVersion.match(/^(\d+\.\d+)/)) === null || _a === void 0 ? void 0 : _a[1]) || rustVersion;
    const targetTag = core.getInput('target-tag') || `${cacheTagPrefix}-target-rust${rustMajorMinor}`;
    const sccacheTag = core.getInput('sccache-tag') || `${cacheTagPrefix}-sccache-rust${rustMajorMinor}`;
    core.setOutput('cargo-tag', cargoRegistryTag);
    core.setOutput('cargo-bin-tag', cargoBinTag);
    core.setOutput('target-tag', targetTag);
    core.setOutput('sccache-tag', sccacheTag);
    let registryRestored = false;
    let cargoBinRestored = false;
    let targetRestored = false;
    let sccacheRestored = false;
    if (cacheCargo) {
        const cargoRegistryDir = `${cargoHome}/registry`;
        const cargoGitDir = `${cargoHome}/git`;
        const registryResult = await execRustBoringCache(['restore', plan.workspace, `${cargoRegistryTag}:${cargoRegistryDir}`, ...(inputs.verbose ? ['--verbose'] : [])]);
        registryRestored = wasRustCacheHit(registryResult);
        const lockPath = path.join(workingDir, 'Cargo.lock');
        const hasGitDeps = await hasGitDependencies(lockPath);
        if (hasGitDeps) {
            await execRustBoringCache(['restore', plan.workspace, `${cargoGitTag}:${cargoGitDir}`, ...(inputs.verbose ? ['--verbose'] : [])]);
        }
        saveModeState('cargo-registry-tag', cargoRegistryTag);
        saveModeState('cargo-git-tag', cargoGitTag);
    }
    if (cacheCargoBin) {
        const cargoBinDir = `${cargoHome}/bin`;
        const binResult = await execRustBoringCache(['restore', plan.workspace, `${cargoBinTag}:${cargoBinDir}`, ...(inputs.verbose ? ['--verbose'] : [])]);
        cargoBinRestored = wasRustCacheHit(binResult);
        saveModeState('cargo-bin-tag', cargoBinTag);
    }
    if (cacheTarget) {
        const targetDir = path.join(workingDir, 'target');
        const targetResult = await execRustBoringCache(['restore', plan.workspace, `${targetTag}:${targetDir}`, ...(inputs.verbose ? ['--verbose'] : [])]);
        targetRestored = wasRustCacheHit(targetResult);
        saveModeState('target-tag', targetTag);
    }
    if (useSccache) {
        await installSccache(sccacheVersion);
        if (sccacheMode === 'proxy') {
            const proxy = await startPortableCacheProxy(plan.workspace, await (0, action_core_1.findAvailablePort)(), sccacheTag, inputs.readOnly);
            configureSccacheProxyEnv(proxy.port);
            await startSccacheServer();
            saveModeState('proxy-pid', String(proxy.pid));
            saveModeState('proxy-port', String(proxy.port));
            saveModeState('sccache-tag', sccacheTag);
            core.setOutput('proxy-port', String(proxy.port));
            core.setOutput('proxy-log-path', registryProxyLogPath(proxy.port));
        }
        else {
            configureSccacheEnv(sccacheCacheSize);
            const sccacheDir = getSccacheDir();
            const sccacheResult = await execRustBoringCache(['restore', plan.workspace, `${sccacheTag}:${sccacheDir}`, ...(inputs.verbose ? ['--verbose'] : [])]);
            sccacheRestored = wasRustCacheHit(sccacheResult);
            await startSccacheServer();
            saveModeState('sccache-tag', sccacheTag);
        }
    }
    if (!(plan.setup === 'mise' && toolEnabled(plan, 'rust'))) {
        await setupRustToolchain(rustVersion, { profile, targets, components });
    }
    const cacheHit = registryRestored || cargoBinRestored || targetRestored || sccacheRestored;
    core.setOutput('cache-hit', String(cacheHit));
    core.setOutput('sccache-hit', String(sccacheRestored));
    return { cacheHit };
}
async function runRustSave() {
    const workspace = getModeState('workspace');
    const workingDir = getModeState('working-dir') || process.cwd();
    const cacheCargo = getModeState('cache-cargo') === 'true';
    const cacheCargoBin = getModeState('cache-cargo-bin') === 'true';
    const cacheTarget = getModeState('cache-target') === 'true';
    const useSccache = getModeState('use-sccache') === 'true';
    const sccacheMode = getModeState('sccache-mode') || 'local';
    const verbose = getModeState('verbose') === 'true';
    const exclude = core.getInput('exclude');
    if (!workspace) {
        return;
    }
    if (!(0, action_core_1.hasSaveToken)()) {
        if (useSccache && sccacheMode === 'proxy') {
            await stopSccacheServer();
            await stopProxyFromState();
        }
        core.notice(`Save skipped: ${(0, action_core_1.missingSaveTokenMessage)()}`);
        return;
    }
    const cargoHome = getCargoHome();
    if (cacheCargo) {
        const cargoRegistryTag = getModeState('cargo-registry-tag');
        const cargoGitTag = getModeState('cargo-git-tag');
        const cargoRegistryDir = `${cargoHome}/registry`;
        const cargoGitDir = `${cargoHome}/git`;
        if (cargoRegistryTag) {
            const args = ['save', workspace, `${cargoRegistryTag}:${cargoRegistryDir}`];
            if (verbose) {
                args.push('--verbose');
            }
            if (exclude) {
                args.push('--exclude', exclude);
            }
            await execRustBoringCache(args);
        }
        if (cargoGitTag) {
            const lockPath = path.join(workingDir, 'Cargo.lock');
            if (await hasGitDependencies(lockPath)) {
                const args = ['save', workspace, `${cargoGitTag}:${cargoGitDir}`];
                if (verbose) {
                    args.push('--verbose');
                }
                if (exclude) {
                    args.push('--exclude', exclude);
                }
                await execRustBoringCache(args);
            }
        }
    }
    if (cacheCargoBin) {
        const cargoBinTag = getModeState('cargo-bin-tag');
        if (cargoBinTag) {
            const args = ['save', workspace, `${cargoBinTag}:${path.join(cargoHome, 'bin')}`];
            if (verbose) {
                args.push('--verbose');
            }
            if (exclude) {
                args.push('--exclude', exclude);
            }
            await execRustBoringCache(args);
        }
    }
    if (cacheTarget) {
        const targetTag = getModeState('target-tag');
        if (targetTag) {
            const args = ['save', workspace, `${targetTag}:${path.join(workingDir, 'target')}`];
            if (verbose) {
                args.push('--verbose');
            }
            if (exclude) {
                args.push('--exclude', exclude);
            }
            await execRustBoringCache(args);
        }
    }
    if (useSccache) {
        if (sccacheMode === 'proxy') {
            await stopSccacheServer();
            await stopProxyFromState();
        }
        else {
            const sccacheTag = getModeState('sccache-tag');
            if (sccacheTag) {
                await stopSccacheServer();
                const args = ['save', workspace, `${sccacheTag}:${getSccacheDir()}`];
                if (verbose) {
                    args.push('--verbose');
                }
                if (exclude) {
                    args.push('--exclude', exclude);
                }
                await execRustBoringCache(args);
            }
        }
    }
}
async function stopProxyFromState() {
    const proxyPid = getModeState('proxy-pid');
    if (proxyPid) {
        await (0, action_core_1.stopRegistryProxy)(parseInt(proxyPid, 10));
    }
}
