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
const action_core_1 = require("@boringcache/action-core");
const utils_1 = require("./utils");
const mode_handlers_1 = require("./mode-handlers");
function toSaveEntries(entriesString) {
    if (!entriesString.trim()) {
        return '';
    }
    return (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false })
        .map((entry) => `${entry.tag}:${entry.savePath}`)
        .join(',');
}
function resolveGenericEntryVerificationTags(entriesString, workingDirectory, noPlatform, onlyExistingPaths) {
    const specs = (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false })
        .filter((entry) => !onlyExistingPaths || fs.existsSync(entry.savePath))
        .map((entry) => ({
        tag: entry.tag,
        noPlatform,
        noGit: false,
        pathHint: entry.savePath,
        saveExpected: true,
    }));
    return (0, utils_1.resolveVerificationTags)(specs, workingDirectory);
}
function filterVerifiableGenericTags(entriesString, verifyTags, workingDirectory, noPlatform) {
    if (!entriesString.trim() || verifyTags.length === 0) {
        return verifyTags;
    }
    const existingGenericTags = new Set(resolveGenericEntryVerificationTags(entriesString, workingDirectory, noPlatform, true));
    const declaredGenericTags = new Set(resolveGenericEntryVerificationTags(entriesString, workingDirectory, noPlatform, false));
    return verifyTags.filter((tag) => !declaredGenericTags.has(tag) || existingGenericTags.has(tag));
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
        const verifyTimeoutSeconds = Number.parseInt(core.getState('verify-timeout-seconds') || String(inputs.verifyTimeoutSeconds), 10);
        const verifyRequireServerSignature = core.getState('verify-require-server-signature') === 'true' || inputs.verifyRequireServerSignature;
        const verifySaveTags = core.getState('verify-save-tags')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
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
        if (workingDirectory) {
            process.chdir(workingDirectory);
        }
        if (!(0, action_core_1.hasSaveToken)()) {
            if (resolvedMode && resolvedMode !== 'archive') {
                await (0, mode_handlers_1.runModeSave)(resolvedMode);
            }
            else if (genericEntries) {
                core.notice(`Save skipped: ${(0, action_core_1.missingSaveTokenMessage)()}`);
            }
            return;
        }
        if (cliVersion.toLowerCase() !== 'skip') {
            await (0, utils_1.ensureBoringCache)({ version: cliVersion, platform: cliPlatform });
        }
        if (resolvedMode && resolvedMode !== 'archive') {
            await (0, mode_handlers_1.runModeSave)(resolvedMode);
        }
        if (!genericEntries || !genericWorkspace) {
            if (verifyMode !== 'none' && verifySaveTags.length > 0 && genericWorkspace) {
                await (0, utils_1.verifyResolvedTags)(genericWorkspace, verifySaveTags, {
                    mode: verifyMode,
                    timeoutSeconds: verifyTimeoutSeconds,
                    requireServerSignature: verifyRequireServerSignature,
                    verbose,
                });
            }
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
        const verifiableSaveTags = filterVerifiableGenericTags(genericEntries, verifySaveTags, workingDirectory || process.cwd(), enableCrossOsArchive || noPlatform);
        if (verifyMode !== 'none' && verifiableSaveTags.length > 0) {
            await (0, utils_1.verifyResolvedTags)(genericWorkspace, verifiableSaveTags, {
                mode: verifyMode,
                timeoutSeconds: verifyTimeoutSeconds,
                requireServerSignature: verifyRequireServerSignature,
                verbose,
            });
        }
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
