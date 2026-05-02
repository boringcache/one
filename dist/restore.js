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
exports.run = run;
const core = __importStar(require("@actions/core"));
const core_1 = require("./core");
const utils_1 = require("./utils");
const mode_handlers_1 = require("./mode-handlers");
function buildRuntimeRestoreFlagArgs(inputs) {
    const flagArgs = [];
    if (inputs.enableCrossOsArchive || inputs.noPlatform) {
        flagArgs.push('--no-platform');
    }
    if (inputs.verbose) {
        flagArgs.push('--verbose');
    }
    return flagArgs;
}
function buildCliSetupOptions(inputs, cliPlatform) {
    return {
        version: inputs.cliVersion,
        platform: cliPlatform,
        ...(inputs.trustedWorkspaceSigningKeyFingerprint
            ? { trustedWorkspaceSigningKeyFingerprint: inputs.trustedWorkspaceSigningKeyFingerprint }
            : {}),
    };
}
async function emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, runtimeHit) {
    const diagnostics = (0, utils_1.loadDiagnosticsConfig)(inputs);
    await (0, utils_1.runDiagnosticsGroup)(diagnostics, 'BoringCache Diagnostics', async () => {
        core.info(`workspace: ${plan.workspace}`);
        core.info(`setup: ${plan.setup}`);
        core.info(`mode: ${plan.mode}`);
        core.info(`preset: ${plan.preset}`);
        core.info(`working-directory: ${plan.workingDirectory}`);
        core.info(`cache-tag: ${plan.cacheTagPrefix || '(none)'}`);
        core.info(`runtime-cache-tag: ${plan.runtimeTag || '(none)'}`);
        core.info(`resolved-entries: ${plan.archiveEntries || '(none)'}`);
        core.info(`resolved-tags: ${resolvedTags.join(',') || '(none)'}`);
        core.info(`cache-hit: ${String(overallHit)}`);
        core.info(`runtime-cache-hit: ${String(runtimeHit)}`);
        core.info(`verify-mode: ${inputs.verify}`);
        core.info(`token-capabilities: restore=${String((0, core_1.hasRestoreToken)())} save=${String((0, core_1.hasSaveToken)())} legacy-api-only=${String((0, core_1.isUsingLegacyApiTokenOnly)())}`);
        if (diagnostics.includeLogs) {
            const proxyLogPath = core.getState('proxy-log-path');
            if (proxyLogPath) {
                const logTail = (0, utils_1.readLogTail)(proxyLogPath, diagnostics.logLines);
                core.info(`proxy-log-path: ${proxyLogPath}`);
                if (logTail.length > 0) {
                    core.info(`proxy-log-tail (${logTail.length} lines):`);
                    for (const line of logTail) {
                        core.info(line);
                    }
                }
            }
        }
    });
}
async function restoreEntries(workspace, entriesString, flagArgs, restoreCandidates = []) {
    if (!entriesString.trim()) {
        return { hit: false, saveEntries: '' };
    }
    const parsedEntries = (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false });
    if (parsedEntries.length === 0) {
        return { hit: false, saveEntries: '' };
    }
    const restoreEntriesArg = parsedEntries.map((entry) => `${entry.tag}:${entry.restorePath}`).join(',');
    const saveEntries = parsedEntries.map((entry) => `${entry.tag}:${entry.savePath}`).join(',');
    const restoreMissShouldFail = flagArgs.includes('--fail-on-cache-miss');
    const primaryHit = await checkEntries(workspace, parsedEntries.map((entry) => entry.tag), flagArgs);
    let selectedRestoreEntries = restoreEntriesArg;
    let hit = primaryHit;
    if (!hit) {
        for (const candidate of restoreCandidates) {
            if (!candidate.entries.trim()) {
                continue;
            }
            const candidateEntries = (0, utils_1.parseEntries)(candidate.entries, 'restore', { resolvePaths: false });
            const candidateHit = await checkEntries(workspace, candidateEntries.map((entry) => entry.tag), flagArgs);
            if (candidateHit) {
                core.info(`Cache hit with restore key ${candidate.tagPrefix}`);
                selectedRestoreEntries = candidate.entries;
                hit = true;
                break;
            }
        }
    }
    if (!hit && restoreMissShouldFail) {
        throw new Error(`Cache restore failed for ${restoreEntriesArg}`);
    }
    const restoreFlagArgs = hit ? flagArgs : flagArgs.filter((arg) => arg !== '--fail-on-cache-miss');
    const restoreExitCode = await (0, utils_1.execBoringCache)(['restore', workspace, selectedRestoreEntries, ...restoreFlagArgs], { ignoreReturnCode: true });
    if (restoreExitCode !== 0) {
        throw new Error(`Cache restore failed for ${selectedRestoreEntries}`);
    }
    return {
        hit,
        saveEntries,
    };
}
async function checkEntries(workspace, tags, restoreFlagArgs) {
    const checkTags = tags.map((tag) => tag.trim()).filter(Boolean);
    if (checkTags.length === 0) {
        return false;
    }
    let stdout = '';
    const args = ['check', workspace, checkTags.join(','), ...checkFlagArgs(restoreFlagArgs), '--json'];
    const exitCode = await (0, utils_1.execBoringCache)(args, {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data) => {
                stdout += data.toString();
            },
        },
    });
    if (!stdout.trim()) {
        if (exitCode !== 0) {
            core.warning(`Cache check failed for ${checkTags.join(',')}; treating as a miss.`);
        }
        else {
            core.warning(`boringcache check --json produced no output for ${checkTags.join(',')}; treating as a miss.`);
        }
        return false;
    }
    let summary;
    try {
        summary = JSON.parse(stdout);
    }
    catch (error) {
        core.warning(`Failed to parse boringcache check JSON for ${checkTags.join(',')}: ${error instanceof Error ? error.message : String(error)}; treating as a miss.`);
        return false;
    }
    return (summary.results || []).some((result) => result.status === 'hit');
}
function checkFlagArgs(restoreFlagArgs) {
    const args = [];
    if (restoreFlagArgs.includes('--no-platform')) {
        args.push('--no-platform');
    }
    if (restoreFlagArgs.includes('--no-git')) {
        args.push('--no-git');
    }
    return args;
}
async function run() {
    var _a;
    const originalCwd = process.cwd();
    try {
        const inputs = (0, utils_1.getInputs)();
        const saveEnabled = (0, utils_1.saveConfigured)(inputs);
        delete process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST;
        const saveAllowed = saveEnabled ? (0, utils_1.applySaveTokenPolicy)(inputs) : false;
        const cliPlatform = inputs.cliPlatform || undefined;
        if (inputs.cliVersion.toLowerCase() !== 'skip') {
            await (0, utils_1.ensureBoringCache)(buildCliSetupOptions(inputs, cliPlatform));
        }
        const plan = await (0, utils_1.buildPlan)(inputs);
        process.chdir(plan.workingDirectory);
        await (0, utils_1.applyPresetCacheEnv)(plan);
        const runtimeRestore = await restoreEntries(plan.workspace, plan.runtimeEntry || '', buildRuntimeRestoreFlagArgs(inputs));
        const archiveRestore = await restoreEntries(plan.workspace, plan.archiveEntries, (0, utils_1.buildFlagArgs)(inputs), plan.archiveRestoreCandidates);
        let usedMiseRuntime = false;
        if (plan.setup === 'mise') {
            usedMiseRuntime = await (0, utils_1.applyMiseSetup)(plan.runtimeTools, runtimeRestore.hit, plan.workingDirectory);
        }
        const modeRestore = await (0, mode_handlers_1.runModeRestore)(plan, inputs);
        const genericSaveEntries = [usedMiseRuntime ? runtimeRestore.saveEntries : '', archiveRestore.saveEntries]
            .filter(Boolean)
            .join(',');
        const verificationSpecs = [
            ...(0, utils_1.buildGenericVerificationSpecs)(plan, inputs, usedMiseRuntime),
            ...(modeRestore.verificationSpecs || []),
        ];
        const resolvedTags = (0, utils_1.resolveVerificationTags)(verificationSpecs, plan.workingDirectory);
        const saveCapable = saveEnabled && (0, core_1.hasSaveToken)();
        const saveExpectedSpecs = verificationSpecs.filter((spec) => spec.saveExpected);
        const deferredVerifySpecs = saveCapable ? saveExpectedSpecs : [];
        const immediateVerifySpecs = verificationSpecs.filter((spec) => !spec.saveExpected);
        const deferredVerifyTags = (0, utils_1.resolveVerificationTags)(deferredVerifySpecs, plan.workingDirectory);
        const overallHit = (_a = modeRestore.cacheHit) !== null && _a !== void 0 ? _a : (runtimeRestore.hit || archiveRestore.hit);
        const diagnostics = (0, utils_1.loadDiagnosticsConfig)(inputs);
        core.setOutput('cache-hit', String(overallHit));
        core.setOutput('runtime-cache-hit', String(runtimeRestore.hit));
        core.setOutput('diagnostics-level', diagnostics.level);
        core.setOutput('resolved-mode', plan.mode);
        core.setOutput('resolved-tools', (0, utils_1.serializeTools)(plan.runtimeTools));
        core.setOutput('workspace', plan.workspace);
        core.setOutput('cache-tag', modeRestore.cacheTag || plan.cacheTagPrefix);
        core.setOutput('runtime-cache-tag', plan.runtimeTag || '');
        core.setOutput('resolved-entries', plan.archiveEntries);
        core.setOutput('resolved-tags', resolvedTags.join(','));
        core.saveState('resolved-mode', plan.mode);
        core.saveState('cli-version', inputs.cliVersion);
        core.saveState('cli-platform', cliPlatform || '');
        core.saveState('working-directory', plan.workingDirectory);
        core.saveState('generic-cache-entries', genericSaveEntries);
        core.saveState('generic-cache-workspace', plan.workspace);
        core.saveState('runtime-mise-used', String(usedMiseRuntime));
        core.saveState('generic-cache-exclude', inputs.exclude);
        core.saveState('no-platform', String(inputs.noPlatform));
        core.saveState('enableCrossOsArchive', String(inputs.enableCrossOsArchive));
        core.saveState('force', String(inputs.force));
        core.saveState('verbose', String(inputs.verbose));
        core.saveState('diagnostics-level', diagnostics.level);
        core.saveState('diagnostics-log-lines', String(diagnostics.logLines));
        core.saveState('resolved-tags', resolvedTags.join(','));
        core.saveState('verify-save-specs', JSON.stringify(deferredVerifySpecs));
        core.saveState('verify-save-tags', deferredVerifyTags.join(','));
        core.saveState('verify-mode', inputs.verify);
        core.saveState('verify-timeout-seconds', String(inputs.verifyTimeoutSeconds));
        core.saveState('verify-require-server-signature', String(inputs.verifyRequireServerSignature));
        core.saveState('save-configured', String(saveEnabled));
        core.saveState('save-allowed', String(saveAllowed));
        if (!saveCapable && inputs.verify !== 'none' && saveExpectedSpecs.length > 0) {
            core.info('Skipping save-expected tag verification in restore step: no save-capable token is available.');
        }
        if (inputs.verify !== 'none' && immediateVerifySpecs.length > 0) {
            await (0, utils_1.verifyVerificationSpecs)(plan.workspace, immediateVerifySpecs, {
                mode: inputs.verify,
                timeoutSeconds: inputs.verifyTimeoutSeconds,
                requireServerSignature: inputs.verifyRequireServerSignature,
                verbose: inputs.verbose,
            });
        }
        await emitRestoreDiagnostics(plan, inputs, resolvedTags, overallHit, runtimeRestore.hit);
        if (!saveEnabled) {
            core.info('Post step save is disabled by save-policy: off.');
        }
        if (saveEnabled && (0, utils_1.isPullRequestEvent)() && !saveAllowed) {
            core.info('Post step will stay restore-only unless save-on-pull-request: true is set.');
        }
    }
    catch (error) {
        core.setFailed(`boringcache/one restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        process.chdir(originalCwd);
    }
}
if (require.main === module) {
    void run();
}
