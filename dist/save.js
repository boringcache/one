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
const fs = __importStar(require("fs"));
const core_1 = require("./core");
const utils_1 = require("./utils");
const mode_handlers_1 = require("./mode-handlers");
const MIN_POST_SAVE_VERIFY_TIMEOUT_SECONDS = 180;
function toSaveEntries(entriesString) {
    if (!entriesString.trim()) {
        return '';
    }
    return (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false })
        .map((entry) => `${entry.tag}:${entry.savePath}`)
        .join(',');
}
function parseSavedVerificationSpecs(raw) {
    if (!raw.trim()) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((spec) => {
            return spec && typeof spec.tag === 'string' && typeof spec.noPlatform === 'boolean' && typeof spec.noGit === 'boolean';
        })
            .map((spec) => ({
            tag: spec.tag,
            noPlatform: spec.noPlatform,
            noGit: spec.noGit,
            pathHint: spec.pathHint,
            saveExpected: spec.saveExpected,
        }));
    }
    catch {
        return [];
    }
}
function filterVerifiableSpecs(specs) {
    return specs.filter((spec) => !spec.pathHint || fs.existsSync(spec.pathHint));
}
function parseSavedTagList(raw) {
    return new Set(raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean));
}
function buildLegacyVerificationSpecs(verifySaveTags, entriesString, workingDirectory, noPlatform) {
    if (!entriesString.trim()) {
        return verifySaveTags.map((tag) => ({
            tag,
            noPlatform: true,
            noGit: true,
        }));
    }
    const entrySpecs = (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false })
        .map((entry) => ({
        tag: entry.tag,
        noPlatform,
        noGit: false,
        pathHint: entry.savePath,
        saveExpected: true,
    }));
    const resolvedEntryTags = (0, utils_1.resolveVerificationTags)(entrySpecs, workingDirectory);
    const pathHintsByResolvedTag = new Map();
    resolvedEntryTags.forEach((resolvedTag, index) => {
        var _a;
        const pathHint = (_a = entrySpecs[index]) === null || _a === void 0 ? void 0 : _a.pathHint;
        if (pathHint) {
            pathHintsByResolvedTag.set(resolvedTag, pathHint);
        }
    });
    return verifySaveTags.map((tag) => ({
        tag,
        noPlatform: true,
        noGit: true,
        pathHint: pathHintsByResolvedTag.get(tag),
        saveExpected: true,
    }));
}
function resolvePostSaveVerifyMode(verifyMode) {
    return verifyMode === 'check' ? 'wait' : verifyMode;
}
function resolvePostSaveVerifyTimeoutSeconds(timeoutSeconds) {
    return Math.max(timeoutSeconds, MIN_POST_SAVE_VERIFY_TIMEOUT_SECONDS);
}
async function emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory, genericWorkspace, genericEntries, verifyMode, verifySaveTags) {
    const diagnostics = (0, utils_1.loadDiagnosticsConfig)(inputs);
    await (0, utils_1.runDiagnosticsGroup)(diagnostics, 'BoringCache Post-Step Diagnostics', async () => {
        core.info(`resolved-mode: ${resolvedMode || '(none)'}`);
        core.info(`working-directory: ${workingDirectory || process.cwd()}`);
        core.info(`workspace: ${genericWorkspace || '(none)'}`);
        core.info(`generic-entries: ${genericEntries || '(none)'}`);
        core.info(`verify-mode: ${verifyMode}`);
        core.info(`verify-save-tags: ${verifySaveTags.join(',') || '(none)'}`);
        if (diagnostics.includeLogs) {
            const proxyLogPath = core.getState('proxy-log-path') || core.getState('mode-proxy-log-path');
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
async function run() {
    const originalCwd = process.cwd();
    try {
        const inputs = (0, utils_1.getInputs)();
        const cliVersion = core.getState('cli-version') || inputs.cliVersion;
        const cliPlatform = core.getState('cli-platform') || inputs.cliPlatform || undefined;
        let resolvedMode = core.getState('resolved-mode');
        let workingDirectory = core.getState('working-directory');
        let genericEntries = core.getState('generic-cache-entries');
        let genericWorkspace = core.getState('generic-cache-workspace');
        let exclude = core.getState('generic-cache-exclude');
        let noPlatform = core.getState('no-platform') === 'true';
        let enableCrossOsArchive = core.getState('enableCrossOsArchive') === 'true';
        let force = core.getState('force') === 'true';
        let verbose = core.getState('verbose') === 'true';
        const verifyMode = (core.getState('verify-mode') || inputs.verify);
        const postSaveVerifyMode = resolvePostSaveVerifyMode(verifyMode);
        const verifyTimeoutSeconds = Number.parseInt(core.getState('verify-timeout-seconds') || String(inputs.verifyTimeoutSeconds), 10);
        const postSaveVerifyTimeoutSeconds = resolvePostSaveVerifyTimeoutSeconds(verifyTimeoutSeconds);
        const verifyRequireServerSignature = core.getState('verify-require-server-signature') === 'true' || inputs.verifyRequireServerSignature;
        const saveConfigured = (0, utils_1.readSavedSaveConfiguration)(inputs, core.getState('save-configured'));
        const saveAllowed = (0, utils_1.readSavedSaveAllowance)(inputs, core.getState('save-allowed'));
        let verifySaveTags = core.getState('verify-save-tags')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        let verifySaveSpecs = parseSavedVerificationSpecs(core.getState('verify-save-specs'));
        if (cliVersion.toLowerCase() !== 'skip') {
            await (0, utils_1.ensureBoringCache)({ version: cliVersion, platform: cliPlatform });
        }
        if (!resolvedMode || (!genericEntries && !genericWorkspace)) {
            const plan = await (0, utils_1.buildPlan)(inputs);
            resolvedMode = plan.mode;
            if (!workingDirectory) {
                workingDirectory = plan.workingDirectory;
            }
            if (!genericWorkspace) {
                genericWorkspace = plan.workspace;
            }
            if (!genericEntries) {
                genericEntries = [plan.runtimeEntry, toSaveEntries(plan.archiveEntries)]
                    .filter(Boolean)
                    .join(',');
            }
            exclude = inputs.exclude;
            noPlatform = inputs.noPlatform;
            enableCrossOsArchive = inputs.enableCrossOsArchive;
            force = inputs.force;
            verbose = inputs.verbose;
        }
        if (verifySaveSpecs.length === 0 && verifySaveTags.length > 0) {
            verifySaveSpecs = buildLegacyVerificationSpecs(verifySaveTags, genericEntries || '', workingDirectory || process.cwd(), enableCrossOsArchive || noPlatform);
        }
        if (workingDirectory) {
            process.chdir(workingDirectory);
        }
        if (!saveConfigured) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await (0, mode_handlers_1.runModeSave)(resolvedMode);
            }
            else if (genericEntries) {
                core.info((0, utils_1.saveSkippedByConfigurationMessage)());
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags);
            return;
        }
        if (!saveAllowed) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await (0, mode_handlers_1.runModeSave)(resolvedMode);
            }
            else if (genericEntries) {
                core.notice((0, utils_1.saveSkippedByPolicyMessage)());
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags);
            return;
        }
        if (!(0, core_1.hasSaveToken)()) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await (0, mode_handlers_1.runModeSave)(resolvedMode);
            }
            else if (genericEntries) {
                core.notice(`Save skipped: ${(0, core_1.missingSaveTokenMessage)()}`);
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags);
            return;
        }
        if (resolvedMode && resolvedMode !== 'archive') {
            await (0, mode_handlers_1.runModeSave)(resolvedMode);
            const skippedModeVerifyTags = parseSavedTagList(core.getState('mode-skipped-verify-tags'));
            if (skippedModeVerifyTags.size > 0) {
                verifySaveTags = verifySaveTags.filter((tag) => !skippedModeVerifyTags.has(tag));
                verifySaveSpecs = verifySaveSpecs.filter((spec) => !skippedModeVerifyTags.has(spec.tag));
            }
        }
        if (!genericEntries || !genericWorkspace) {
            if (verifyMode !== 'none' && verifySaveSpecs.length > 0 && genericWorkspace) {
                await (0, utils_1.verifyVerificationSpecs)(genericWorkspace, verifySaveSpecs, {
                    mode: postSaveVerifyMode,
                    timeoutSeconds: postSaveVerifyTimeoutSeconds,
                    requireServerSignature: verifyRequireServerSignature,
                    verbose,
                });
            }
            await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags);
            return;
        }
        const args = ['save', genericWorkspace, genericEntries];
        if (force) {
            args.push('--force');
        }
        if (enableCrossOsArchive || noPlatform) {
            args.push('--no-platform');
        }
        if (verbose) {
            args.push('--verbose');
        }
        if (exclude) {
            args.push('--exclude', exclude);
        }
        if (verifyMode !== 'none') {
            args.push('--fail-on-cache-error');
        }
        await (0, utils_1.execBoringCache)(args);
        const verifiableSaveSpecs = filterVerifiableSpecs(verifySaveSpecs);
        if (verifyMode !== 'none' && verifiableSaveSpecs.length > 0) {
            await (0, utils_1.verifyVerificationSpecs)(genericWorkspace, verifiableSaveSpecs, {
                mode: postSaveVerifyMode,
                timeoutSeconds: postSaveVerifyTimeoutSeconds,
                requireServerSignature: verifyRequireServerSignature,
                verbose,
            });
        }
        await emitPostStepDiagnostics(inputs, resolvedMode, workingDirectory || process.cwd(), genericWorkspace, genericEntries, verifyMode, verifySaveTags);
    }
    catch (error) {
        core.setFailed(`boringcache/one save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        process.chdir(originalCwd);
    }
}
if (require.main === module) {
    void run();
}
