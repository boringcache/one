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
const utils_1 = require("./utils");
const mode_handlers_1 = require("./mode-handlers");
async function restoreEntries(workspace, entriesString, flagArgs, allowRestoreKeys = false) {
    if (!entriesString.trim()) {
        return { hit: false, saveEntries: '' };
    }
    const parsedEntries = (0, utils_1.parseEntries)(entriesString, 'restore', { resolvePaths: false });
    if (parsedEntries.length === 0) {
        return { hit: false, saveEntries: '' };
    }
    const restoreEntriesArg = parsedEntries.map((entry) => `${entry.tag}:${entry.restorePath}`).join(',');
    const saveEntries = parsedEntries.map((entry) => `${entry.tag}:${entry.savePath}`).join(',');
    let lastExitCode = await (0, utils_1.execBoringCache)(['restore', workspace, restoreEntriesArg, ...flagArgs], { ignoreReturnCode: true });
    if (lastExitCode !== 0 && allowRestoreKeys) {
        const inputs = (0, utils_1.getInputs)();
        const restoreKeys = (0, utils_1.getRestoreKeyCandidates)(inputs);
        const suffix = (0, utils_1.getPlatformSuffix)(inputs.noPlatform, inputs.enableCrossOsArchive);
        for (const restoreKey of restoreKeys) {
            const candidateKey = suffix && !restoreKey.endsWith(suffix)
                ? `${restoreKey}${suffix}`
                : restoreKey;
            const fallbackEntries = parsedEntries.map((entry) => {
                if (inputs.key && entry.tag === `${inputs.key}${suffix}`) {
                    return `${candidateKey}:${entry.restorePath}`;
                }
                return `${entry.tag}:${entry.restorePath}`;
            }).join(',');
            lastExitCode = await (0, utils_1.execBoringCache)(['restore', workspace, fallbackEntries, ...flagArgs], { ignoreReturnCode: true });
            if (lastExitCode === 0) {
                core.info(`Cache hit with restore key ${candidateKey}`);
                break;
            }
        }
    }
    return {
        hit: lastExitCode === 0,
        saveEntries,
    };
}
async function run() {
    var _a;
    const originalCwd = process.cwd();
    try {
        const inputs = (0, utils_1.getInputs)();
        const plan = await (0, utils_1.buildPlan)(inputs);
        const cliPlatform = inputs.cliPlatform || undefined;
        if (inputs.cliVersion.toLowerCase() !== 'skip') {
            await (0, utils_1.ensureBoringCache)({ version: inputs.cliVersion, platform: cliPlatform });
        }
        process.chdir(plan.workingDirectory);
        const runtimeRestore = await restoreEntries(plan.workspace, plan.runtimeEntry || '', inputs.verbose ? ['--verbose'] : [], false);
        if (plan.setup === 'mise') {
            await (0, utils_1.applyMiseSetup)(plan.runtimeTools, runtimeRestore.hit);
        }
        const archiveRestore = await restoreEntries(plan.workspace, plan.archiveEntries, (0, utils_1.buildFlagArgs)(inputs), plan.usesCacheFormat);
        const modeRestore = await (0, mode_handlers_1.runModeRestore)(plan, inputs);
        const genericSaveEntries = [runtimeRestore.saveEntries, archiveRestore.saveEntries]
            .filter(Boolean)
            .join(',');
        const overallHit = (_a = modeRestore.cacheHit) !== null && _a !== void 0 ? _a : (runtimeRestore.hit || archiveRestore.hit);
        core.setOutput('cache-hit', String(overallHit));
        core.setOutput('runtime-cache-hit', String(runtimeRestore.hit));
        core.setOutput('resolved-mode', plan.mode);
        core.setOutput('resolved-tools', (0, utils_1.serializeTools)(plan.runtimeTools));
        core.setOutput('workspace', plan.workspace);
        core.setOutput('cache-tag', plan.cacheTagPrefix);
        core.setOutput('runtime-cache-tag', plan.runtimeTag || '');
        core.setOutput('resolved-entries', plan.archiveEntries);
        core.saveState('resolved-mode', plan.mode);
        core.saveState('cli-version', inputs.cliVersion);
        core.saveState('cli-platform', cliPlatform || '');
        core.saveState('generic-cache-entries', genericSaveEntries);
        core.saveState('generic-cache-workspace', plan.workspace);
        core.saveState('generic-cache-exclude', inputs.exclude);
        core.saveState('no-platform', String(inputs.noPlatform));
        core.saveState('enableCrossOsArchive', String(inputs.enableCrossOsArchive));
        core.saveState('force', String(inputs.force));
        core.saveState('verbose', String(inputs.verbose));
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
