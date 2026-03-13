import * as core from '@actions/core';
import { hasSaveToken, missingSaveTokenMessage } from '@boringcache/action-core';
import { buildPlan, ensureBoringCache, execBoringCache, getInputs, parseEntries } from './utils';
import { runModeSave } from './mode-handlers';
import type { ResolvedMode } from './modes';

function toSaveEntries(entriesString: string): string {
  if (!entriesString.trim()) {
    return '';
  }

  return parseEntries(entriesString, 'restore', { resolvePaths: false })
    .map((entry) => `${entry.tag}:${entry.savePath}`)
    .join(',');
}

export async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const cliVersion = core.getState('cli-version') || inputs.cliVersion;
    const cliPlatform = core.getState('cli-platform') || inputs.cliPlatform || undefined;
    let resolvedMode = core.getState('resolved-mode') as ResolvedMode | '';

    let genericEntries = core.getState('generic-cache-entries');
    let genericWorkspace = core.getState('generic-cache-workspace');
    let exclude = core.getState('generic-cache-exclude');
    let noPlatform = core.getState('no-platform') === 'true';
    let enableCrossOsArchive = core.getState('enableCrossOsArchive') === 'true';
    let force = core.getState('force') === 'true';
    let verbose = core.getState('verbose') === 'true';

    if (!resolvedMode || (!genericEntries && !genericWorkspace)) {
      const plan = await buildPlan(inputs);
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

    if (!hasSaveToken()) {
      if (resolvedMode && resolvedMode !== 'archive') {
        await runModeSave(resolvedMode);
      } else if (genericEntries) {
        core.notice(`Save skipped: ${missingSaveTokenMessage()}`);
      }
      return;
    }

    if (cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache({ version: cliVersion, platform: cliPlatform });
    }

    if (resolvedMode && resolvedMode !== 'archive') {
      await runModeSave(resolvedMode);
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

    await execBoringCache(args);
  } catch (error) {
    core.setFailed(`boringcache/one save failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (require.main === module) {
  void run();
}
