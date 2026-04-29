import * as core from '@actions/core';
import * as fs from 'fs';
import { hasSaveToken, missingSaveTokenMessage } from './core';
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
  verifyVerificationSpecs,
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

function parseSavedVerificationSpecs(raw: string): TagVerificationSpec[] {
  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((spec): spec is TagVerificationSpec => {
        return spec && typeof spec.tag === 'string' && typeof spec.noPlatform === 'boolean' && typeof spec.noGit === 'boolean';
      })
      .map((spec) => ({
        tag: spec.tag,
        noPlatform: spec.noPlatform,
        noGit: spec.noGit,
        pathHint: spec.pathHint,
        saveExpected: spec.saveExpected,
      }));
  } catch {
    return [];
  }
}

function filterVerifiableSpecs(specs: TagVerificationSpec[]): TagVerificationSpec[] {
  return specs.filter((spec) => !spec.pathHint || fs.existsSync(spec.pathHint));
}

function buildCliSetupOptions(inputs: ReturnType<typeof getInputs>, cliVersion: string, cliPlatform: string | undefined) {
  return {
    version: cliVersion,
    platform: cliPlatform,
    ...(inputs.trustedWorkspaceSigningKeyFingerprint
      ? { trustedWorkspaceSigningKeyFingerprint: inputs.trustedWorkspaceSigningKeyFingerprint }
      : {}),
  };
}

function parseSavedTagList(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function buildLegacyVerificationSpecs(
  verifySaveTags: string[],
  entriesString: string,
  workingDirectory: string,
  noPlatform: boolean,
): TagVerificationSpec[] {
  if (!entriesString.trim()) {
    return verifySaveTags.map((tag) => ({
      tag,
      noPlatform: true,
      noGit: true,
    }));
  }

  const entrySpecs: TagVerificationSpec[] = parseEntries(entriesString, 'restore', { resolvePaths: false })
    .map((entry) => ({
      tag: entry.tag,
      noPlatform,
      noGit: false,
      pathHint: entry.savePath,
      saveExpected: true,
    }));
  const resolvedEntryTags = resolveVerificationTags(entrySpecs, workingDirectory);
  const pathHintsByResolvedTag = new Map<string, string>();
  resolvedEntryTags.forEach((resolvedTag, index) => {
    const pathHint = entrySpecs[index]?.pathHint;
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
    let verifySaveTags = core.getState('verify-save-tags')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    let verifySaveSpecs = parseSavedVerificationSpecs(core.getState('verify-save-specs'));

    if (cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache(buildCliSetupOptions(inputs, cliVersion, cliPlatform));
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

    if (verifySaveSpecs.length === 0 && verifySaveTags.length > 0) {
      verifySaveSpecs = buildLegacyVerificationSpecs(
        verifySaveTags,
        genericEntries || '',
        workingDirectory || process.cwd(),
        enableCrossOsArchive || noPlatform,
      );
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
      const skippedModeVerifyTags = parseSavedTagList(core.getState('mode-skipped-verify-tags'));
      if (skippedModeVerifyTags.size > 0) {
        verifySaveTags = verifySaveTags.filter((tag) => !skippedModeVerifyTags.has(tag));
        verifySaveSpecs = verifySaveSpecs.filter((spec) => !skippedModeVerifyTags.has(spec.tag));
      }
    }

    if (!genericEntries || !genericWorkspace) {
      if (verifyMode !== 'none' && verifySaveSpecs.length > 0 && genericWorkspace) {
        await verifyVerificationSpecs(genericWorkspace, verifySaveSpecs, {
          mode: verifyMode,
          timeoutSeconds: verifyTimeoutSeconds,
          requireServerSignature: verifyRequireServerSignature,
          verbose,
          acceptPendingSaveExpected: true,
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
    args.push('--fail-on-cache-error');

    await execBoringCache(args);

    const verifiableSaveSpecs = filterVerifiableSpecs(verifySaveSpecs);

    if (verifyMode !== 'none' && verifiableSaveSpecs.length > 0) {
      await verifyVerificationSpecs(genericWorkspace, verifiableSaveSpecs, {
        mode: verifyMode,
        timeoutSeconds: verifyTimeoutSeconds,
        requireServerSignature: verifyRequireServerSignature,
        verbose,
        acceptPendingSaveExpected: true,
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
