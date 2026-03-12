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
async function run() {
    try {
        const inputs = (0, utils_1.getInputs)();
        const cliVersion = core.getState('cli-version') || inputs.cliVersion;
        let resolvedMode = core.getState('resolved-mode');
        let genericEntries = core.getState('generic-cache-entries');
        let genericWorkspace = core.getState('generic-cache-workspace');
        let exclude = core.getState('generic-cache-exclude');
        let noPlatform = core.getState('no-platform') === 'true';
        let enableCrossOsArchive = core.getState('enableCrossOsArchive') === 'true';
        let force = core.getState('force') === 'true';
        let verbose = core.getState('verbose') === 'true';
        if (!resolvedMode || (!genericEntries && !genericWorkspace)) {
            const plan = await (0, utils_1.buildPlan)(inputs);
            resolvedMode = plan.mode;
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
            await (0, utils_1.ensureBoringCache)({ version: cliVersion });
        }
        if (resolvedMode && resolvedMode !== 'archive') {
            await (0, mode_handlers_1.runModeSave)(resolvedMode);
        }
        if (!genericEntries || !genericWorkspace) {
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
        await (0, utils_1.execBoringCache)(args);
    }
    catch (error) {
        core.setFailed(`boringcache/one save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
if (require.main === module) {
    void run();
}
