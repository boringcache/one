import * as core from '@actions/core';
import { hasRestoreToken, hasSaveToken, isUsingLegacyApiTokenOnly } from './core';
import {
  applySaveTokenPolicy,
  applyPresetCacheEnv,
  applyMiseSetup,
  type ArchiveRestoreCandidate,
  buildGenericVerificationSpecs,
  buildFlagArgs,
  buildPlan,
  ensureBoringCache,
  execBoringCache,
  getInputs,
  isPullRequestEvent,
  saveConfigured,
  loadDiagnosticsConfig,
  parseEntries,
  readLogTail,
  resolveVerificationTags,
  runDiagnosticsGroup,
  serializeTools,
  verifyVerificationSpecs,
} from './utils';
import { runModeRestore } from './mode-handlers';

interface RestoreResult {
  hit: boolean;
  saveEntries: string;
}

interface CheckSummary {
  results?: CheckResult[];
}

interface CheckResult {
  status?: string;
}

function buildRuntimeRestoreFlagArgs(
  inputs: Pick<ReturnType<typeof getInputs>, 'enableCrossOsArchive' | 'noPlatform' | 'verbose'>,
): string[] {
  const flagArgs: string[] = [];

  if (inputs.enableCrossOsArchive || inputs.noPlatform) {
    flagArgs.push('--no-platform');
  }
  if (inputs.verbose) {
    flagArgs.push('--verbose');
  }

  return flagArgs;
}

function buildCliSetupOptions(inputs: ReturnType<typeof getInputs>, cliPlatform: string | undefined) {
  return {
    version: inputs.cliVersion,
    platform: cliPlatform,
    ...(inputs.trustedWorkspaceSigningKeyFingerprint
      ? { trustedWorkspaceSigningKeyFingerprint: inputs.trustedWorkspaceSigningKeyFingerprint }
      : {}),
  };
}

async function emitRestoreDiagnostics(
  plan: Awaited<ReturnType<typeof buildPlan>>,
  inputs: ReturnType<typeof getInputs>,
  resolvedTags: string[],
  overallHit: boolean,
  runtimeHit: boolean,
): Promise<void> {
  const diagnostics = loadDiagnosticsConfig(inputs);

  await runDiagnosticsGroup(diagnostics, 'BoringCache Diagnostics', async () => {
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
    core.info(
      `token-capabilities: restore=${String(hasRestoreToken())} save=${String(hasSaveToken())} legacy-api-only=${String(isUsingLegacyApiTokenOnly())}`,
    );

    if (diagnostics.includeLogs) {
      const proxyLogPath = core.getState('proxy-log-path');
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

async function restoreEntries(
  workspace: string,
  entriesString: string,
  flagArgs: string[],
  restoreCandidates: ArchiveRestoreCandidate[] = [],
): Promise<RestoreResult> {
  if (!entriesString.trim()) {
    return { hit: false, saveEntries: '' };
  }

  const parsedEntries = parseEntries(entriesString, 'restore', { resolvePaths: false });
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

      const candidateEntries = parseEntries(candidate.entries, 'restore', { resolvePaths: false });
      const candidateHit = await checkEntries(
        workspace,
        candidateEntries.map((entry) => entry.tag),
        flagArgs,
      );
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
  const restoreExitCode = await execBoringCache(
    ['restore', workspace, selectedRestoreEntries, ...restoreFlagArgs],
    { ignoreReturnCode: true },
  );

  if (restoreExitCode !== 0) {
    throw new Error(`Cache restore failed for ${selectedRestoreEntries}`);
  }

  return {
    hit,
    saveEntries,
  };
}

async function checkEntries(
  workspace: string,
  tags: string[],
  restoreFlagArgs: string[],
): Promise<boolean> {
  const checkTags = tags.map((tag) => tag.trim()).filter(Boolean);
  if (checkTags.length === 0) {
    return false;
  }

  let stdout = '';
  const args = ['check', workspace, checkTags.join(','), ...checkFlagArgs(restoreFlagArgs), '--json'];
  const exitCode = await execBoringCache(args, {
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
    },
  });

  if (exitCode !== 0 && !stdout.trim()) {
    throw new Error(`Cache check failed for ${checkTags.join(',')}`);
  }

  let summary: CheckSummary;
  try {
    summary = JSON.parse(stdout) as CheckSummary;
  } catch (error) {
    throw new Error(
      `Failed to parse boringcache check JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return (summary.results || []).some((result) => result.status === 'hit');
}

function checkFlagArgs(restoreFlagArgs: string[]): string[] {
  const args: string[] = [];
  if (restoreFlagArgs.includes('--no-platform')) {
    args.push('--no-platform');
  }
  if (restoreFlagArgs.includes('--no-git')) {
    args.push('--no-git');
  }
  return args;
}

export async function run(): Promise<void> {
  const originalCwd = process.cwd();
  try {
    const inputs = getInputs();
    const saveEnabled = saveConfigured(inputs);
    delete process.env.BORINGCACHE_SAVE_ON_PULL_REQUEST;
    const saveAllowed = saveEnabled ? applySaveTokenPolicy(inputs) : false;
    const cliPlatform = inputs.cliPlatform || undefined;

    if (inputs.cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache(buildCliSetupOptions(inputs, cliPlatform));
    }

    const plan = await buildPlan(inputs);

    process.chdir(plan.workingDirectory);
    await applyPresetCacheEnv(plan);

    const runtimeRestore = await restoreEntries(
      plan.workspace,
      plan.runtimeEntry || '',
      buildRuntimeRestoreFlagArgs(inputs),
    );

    const archiveRestore = await restoreEntries(
      plan.workspace,
      plan.archiveEntries,
      buildFlagArgs(inputs),
      plan.archiveRestoreCandidates,
    );

    let usedMiseRuntime = false;
    if (plan.setup === 'mise') {
      usedMiseRuntime = await applyMiseSetup(plan.runtimeTools, runtimeRestore.hit, plan.workingDirectory);
    }

    const modeRestore = await runModeRestore(plan, inputs);
    const genericSaveEntries = [usedMiseRuntime ? runtimeRestore.saveEntries : '', archiveRestore.saveEntries]
      .filter(Boolean)
      .join(',');
    const verificationSpecs = [
      ...buildGenericVerificationSpecs(plan, inputs, usedMiseRuntime),
      ...(modeRestore.verificationSpecs || []),
    ];
    const resolvedTags = resolveVerificationTags(verificationSpecs, plan.workingDirectory);
    const saveCapable = saveEnabled && hasSaveToken();
    const saveExpectedSpecs = verificationSpecs.filter((spec) => spec.saveExpected);
    const deferredVerifySpecs = saveCapable ? saveExpectedSpecs : [];
    const immediateVerifySpecs = verificationSpecs.filter((spec) => !spec.saveExpected);
    const deferredVerifyTags = resolveVerificationTags(deferredVerifySpecs, plan.workingDirectory);

    const overallHit = modeRestore.cacheHit ?? (runtimeRestore.hit || archiveRestore.hit);
    const diagnostics = loadDiagnosticsConfig(inputs);

    core.setOutput('cache-hit', String(overallHit));
    core.setOutput('runtime-cache-hit', String(runtimeRestore.hit));
    core.setOutput('diagnostics-level', diagnostics.level);
    core.setOutput('resolved-mode', plan.mode);
    core.setOutput('resolved-tools', serializeTools(plan.runtimeTools));
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
      core.info(
        'Skipping save-expected tag verification in restore step: no save-capable token is available.',
      );
    }

    if (inputs.verify !== 'none' && immediateVerifySpecs.length > 0) {
      await verifyVerificationSpecs(plan.workspace, immediateVerifySpecs, {
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
    if (saveEnabled && isPullRequestEvent() && !saveAllowed) {
      core.info('Post step will stay restore-only unless save-on-pull-request: true is set.');
    }
  } catch (error) {
    core.setFailed(`boringcache/one restore failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    process.chdir(originalCwd);
  }
}

if (require.main === module) {
  void run();
}
