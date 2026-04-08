import * as core from '@actions/core';
import { hasRestoreToken, hasSaveToken, isUsingLegacyApiTokenOnly } from '@boringcache/action-core';
import {
  applySaveTokenPolicy,
  applyPresetCacheEnv,
  applyMiseSetup,
  buildGenericVerificationSpecs,
  buildFlagArgs,
  buildPlan,
  convertCacheFormatToEntries,
  ensureBoringCache,
  execBoringCache,
  getInputs,
  isPullRequestEvent,
  saveConfigured,
  loadDiagnosticsConfig,
  getPlatformSuffix,
  getRestoreKeyCandidates,
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
  allowRestoreKeys = false,
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

  let lastExitCode = await execBoringCache(
    ['restore', workspace, restoreEntriesArg, ...flagArgs],
    { ignoreReturnCode: true },
  );

  if (lastExitCode !== 0 && allowRestoreKeys) {
    const inputs = getInputs();
    const restoreKeys = getRestoreKeyCandidates(inputs);
    if (inputs.path && inputs.key) {
      for (const restoreKey of restoreKeys) {
        const fallbackEntries = convertCacheFormatToEntries(inputs, 'restore', restoreKey);
        lastExitCode = await execBoringCache(
          ['restore', workspace, fallbackEntries, ...flagArgs],
          { ignoreReturnCode: true },
        );
        if (lastExitCode === 0) {
          core.info(`Cache hit with restore key ${restoreKey}`);
          break;
        }
      }
    } else {
      const suffix = getPlatformSuffix(inputs.noPlatform, inputs.enableCrossOsArchive);

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

        lastExitCode = await execBoringCache(
          ['restore', workspace, fallbackEntries, ...flagArgs],
          { ignoreReturnCode: true },
        );
        if (lastExitCode === 0) {
          core.info(`Cache hit with restore key ${candidateKey}`);
          break;
        }
      }
    }
  }

  return {
    hit: lastExitCode === 0,
    saveEntries,
  };
}

export async function run(): Promise<void> {
  const originalCwd = process.cwd();
  try {
    const inputs = getInputs();
    const saveEnabled = saveConfigured(inputs);
    const saveAllowed = saveEnabled ? applySaveTokenPolicy(inputs) : false;
    const cliPlatform = inputs.cliPlatform || undefined;

    if (inputs.cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache({ version: inputs.cliVersion, platform: cliPlatform });
    }

    const plan = await buildPlan(inputs);

    process.chdir(plan.workingDirectory);
    await applyPresetCacheEnv(plan);

    const runtimeRestore = await restoreEntries(
      plan.workspace,
      plan.runtimeEntry || '',
      buildRuntimeRestoreFlagArgs(inputs),
      false,
    );

    let usedMiseRuntime = false;
    if (plan.setup === 'mise') {
      usedMiseRuntime = await applyMiseSetup(plan.runtimeTools, runtimeRestore.hit, plan.workingDirectory);
    }

    const archiveRestore = await restoreEntries(
      plan.workspace,
      plan.archiveEntries,
      buildFlagArgs(inputs),
      plan.usesCacheFormat,
    );

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
    const deferredVerifySpecs = saveCapable
      ? verificationSpecs.filter((spec) => spec.saveExpected)
      : [];
    const immediateVerifySpecs = saveCapable
      ? verificationSpecs.filter((spec) => !spec.saveExpected)
      : verificationSpecs;
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
