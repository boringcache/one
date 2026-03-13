import * as core from '@actions/core';
import * as fs from 'fs';
import { hasSaveToken, missingSaveTokenMessage } from '@boringcache/action-core';
import {
  buildPlan,
  ensureBoringCache,
  execBoringCache,
  getInputs,
  resolveVerificationTags,
  type TagVerificationSpec,
  type VerifyMode,
  parseEntries,
  verifyResolvedTags,
} from './utils';
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

function resolveGenericEntryVerificationTags(
  entriesString: string,
  workingDirectory: string,
  noPlatform: boolean,
  onlyExistingPaths: boolean,
): string[] {
  const specs: TagVerificationSpec[] = parseEntries(entriesString, 'restore', { resolvePaths: false })
    .filter((entry) => !onlyExistingPaths || fs.existsSync(entry.savePath))
    .map((entry) => ({
      tag: entry.tag,
      noPlatform,
      noGit: false,
      pathHint: entry.savePath,
      saveExpected: true,
    }));

  return resolveVerificationTags(specs, workingDirectory);
}

function filterVerifiableGenericTags(
  entriesString: string,
  verifyTags: string[],
  workingDirectory: string,
  noPlatform: boolean,
): string[] {
  if (!entriesString.trim() || verifyTags.length === 0) {
    return verifyTags;
  }

  const existingGenericTags = new Set(
    resolveGenericEntryVerificationTags(entriesString, workingDirectory, noPlatform, true),
  );
  const declaredGenericTags = new Set(
    resolveGenericEntryVerificationTags(entriesString, workingDirectory, noPlatform, false),
  );

  return verifyTags.filter((tag) => !declaredGenericTags.has(tag) || existingGenericTags.has(tag));
}

export async function run(): Promise<void> {
  const originalCwd = process.cwd();
  try {
    const inputs = getInputs();
    const cliVersion = core.getState('cli-version') || inputs.cliVersion;
    const cliPlatform = core.getState('cli-platform') || inputs.cliPlatform || undefined;
    let resolvedMode = core.getState('resolved-mode') as ResolvedMode | '';
    let workingDirectory = core.getState('working-directory');

    let genericEntries = core.getState('generic-cache-entries');
    let genericWorkspace = core.getState('generic-cache-workspace');
    let exclude = core.getState('generic-cache-exclude');
    let noPlatform = core.getState('no-platform') === 'true';
    let enableCrossOsArchive = core.getState('enableCrossOsArchive') === 'true';
    let force = core.getState('force') === 'true';
    let verbose = core.getState('verbose') === 'true';
    const verifyMode = (core.getState('verify-mode') || inputs.verify) as VerifyMode;
    const verifyTimeoutSeconds = Number.parseInt(
      core.getState('verify-timeout-seconds') || String(inputs.verifyTimeoutSeconds),
      10,
    );
    const verifyRequireServerSignature =
      core.getState('verify-require-server-signature') === 'true' || inputs.verifyRequireServerSignature;
    const verifySaveTags = core.getState('verify-save-tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!resolvedMode || (!genericEntries && !genericWorkspace)) {
      const plan = await buildPlan(inputs);
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
      if (verifyMode !== 'none' && verifySaveTags.length > 0 && genericWorkspace) {
        await verifyResolvedTags(genericWorkspace, verifySaveTags, {
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

    await execBoringCache(args);

    const verifiableSaveTags = filterVerifiableGenericTags(
      genericEntries,
      verifySaveTags,
      workingDirectory || process.cwd(),
      enableCrossOsArchive || noPlatform,
    );

    if (verifyMode !== 'none' && verifiableSaveTags.length > 0) {
      await verifyResolvedTags(genericWorkspace, verifiableSaveTags, {
        mode: verifyMode,
        timeoutSeconds: verifyTimeoutSeconds,
        requireServerSignature: verifyRequireServerSignature,
        verbose,
      });
    }
  } catch (error) {
    core.setFailed(`boringcache/one save failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    process.chdir(originalCwd);
  }
}

if (require.main === module) {
  void run();
}
