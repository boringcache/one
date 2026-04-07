import * as core from '@actions/core';
import * as fs from 'fs';
import { hasSaveToken, missingSaveTokenMessage } from '@boringcache/action-core';
import {
  buildPlan,
  ensureBoringCache,
  execBoringCache,
  getInputs,
  loadDiagnosticsConfig,
  readLogTail,
  readSavedSaveAllowance,
  readSavedSaveConfiguration,
  resolveVerificationTags,
  runDiagnosticsGroup,
  parseEntries,
  saveSkippedByConfigurationMessage,
  saveSkippedByPolicyMessage,
  type TagVerificationSpec,
  type VerifyMode,
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

async function emitPostStepDiagnostics(
  inputs: ReturnType<typeof getInputs>,
  resolvedMode: ResolvedMode | '',
  workingDirectory: string,
  genericWorkspace: string,
  genericEntries: string,
  verifyMode: VerifyMode,
  verifySaveTags: string[],
): Promise<void> {
  const diagnostics = loadDiagnosticsConfig(inputs);

  await runDiagnosticsGroup(diagnostics, 'BoringCache Post-Step Diagnostics', async () => {
    core.info(`resolved-mode: ${resolvedMode || '(none)'}`);
    core.info(`working-directory: ${workingDirectory || process.cwd()}`);
    core.info(`workspace: ${genericWorkspace || '(none)'}`);
    core.info(`generic-entries: ${genericEntries || '(none)'}`);
    core.info(`verify-mode: ${verifyMode}`);
    core.info(`verify-save-tags: ${verifySaveTags.join(',') || '(none)'}`);

    if (diagnostics.includeLogs) {
      const proxyLogPath = core.getState('proxy-log-path') || core.getState('mode-proxy-log-path');
      if (proxyLogPath) {
        const logTail = readLogTail(proxyLogPath, diagnostics.logLines);
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
    const saveConfigured = readSavedSaveConfiguration(inputs, core.getState('save-configured'));
    const saveAllowed = readSavedSaveAllowance(inputs, core.getState('save-allowed'));
    const verifySaveTags = core.getState('verify-save-tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache({ version: cliVersion, platform: cliPlatform });
    }

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

    if (!saveConfigured) {
      if (resolvedMode && resolvedMode !== 'archive') {
        await runModeSave(resolvedMode);
      } else if (genericEntries) {
        core.info(saveSkippedByConfigurationMessage());
      }
      await emitPostStepDiagnostics(
        inputs,
        resolvedMode,
        workingDirectory || process.cwd(),
        genericWorkspace,
        genericEntries,
        verifyMode,
        verifySaveTags,
      );
      return;
    }

    if (!saveAllowed) {
      if (resolvedMode && resolvedMode !== 'archive') {
        await runModeSave(resolvedMode);
      } else if (genericEntries) {
        core.notice(saveSkippedByPolicyMessage());
      }
      await emitPostStepDiagnostics(
        inputs,
        resolvedMode,
        workingDirectory || process.cwd(),
        genericWorkspace,
        genericEntries,
        verifyMode,
        verifySaveTags,
      );
      return;
    }

    if (!hasSaveToken()) {
      if (resolvedMode && resolvedMode !== 'archive') {
        await runModeSave(resolvedMode);
      } else if (genericEntries) {
        core.notice(`Save skipped: ${missingSaveTokenMessage()}`);
      }
      await emitPostStepDiagnostics(
        inputs,
        resolvedMode,
        workingDirectory || process.cwd(),
        genericWorkspace,
        genericEntries,
        verifyMode,
        verifySaveTags,
      );
      return;
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
      await emitPostStepDiagnostics(
        inputs,
        resolvedMode,
        workingDirectory || process.cwd(),
        genericWorkspace,
        genericEntries,
        verifyMode,
        verifySaveTags,
      );
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

    await emitPostStepDiagnostics(
      inputs,
      resolvedMode,
      workingDirectory || process.cwd(),
      genericWorkspace,
      genericEntries,
      verifyMode,
      verifySaveTags,
    );
  } catch (error) {
    core.setFailed(`boringcache/one save failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    process.chdir(originalCwd);
  }
}

if (require.main === module) {
  void run();
}
