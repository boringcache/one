import * as core from '@actions/core';
import { hasSaveToken } from '@boringcache/action-core';
import {
  applyPresetCacheEnv,
  applyMiseSetup,
  buildGenericVerificationSpecs,
  buildFlagArgs,
  buildPlan,
  ensureBoringCache,
  execBoringCache,
  getInputs,
  getPlatformSuffix,
  getRestoreKeyCandidates,
  parseEntries,
  resolveVerificationTags,
  serializeTools,
  verifyResolvedTags,
} from './utils';
import { runModeRestore } from './mode-handlers';

interface RestoreResult {
  hit: boolean;
  saveEntries: string;
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

  return {
    hit: lastExitCode === 0,
    saveEntries,
  };
}

export async function run(): Promise<void> {
  const originalCwd = process.cwd();
  try {
    const inputs = getInputs();
    const plan = await buildPlan(inputs);
    const cliPlatform = inputs.cliPlatform || undefined;

    if (inputs.cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache({ version: inputs.cliVersion, platform: cliPlatform });
    }

    process.chdir(plan.workingDirectory);
    await applyPresetCacheEnv(plan);

    const runtimeRestore = await restoreEntries(
      plan.workspace,
      plan.runtimeEntry || '',
      inputs.verbose ? ['--verbose'] : [],
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
    const deferredVerifyTags = hasSaveToken()
      ? resolveVerificationTags(verificationSpecs.filter((spec) => spec.saveExpected), plan.workingDirectory)
      : [];
    const immediateVerifyTags = hasSaveToken()
      ? resolveVerificationTags(verificationSpecs.filter((spec) => !spec.saveExpected), plan.workingDirectory)
      : resolvedTags;

    const overallHit = modeRestore.cacheHit ?? (runtimeRestore.hit || archiveRestore.hit);

    core.setOutput('cache-hit', String(overallHit));
    core.setOutput('runtime-cache-hit', String(runtimeRestore.hit));
    core.setOutput('resolved-mode', plan.mode);
    core.setOutput('resolved-tools', serializeTools(plan.runtimeTools));
    core.setOutput('workspace', plan.workspace);
    core.setOutput('cache-tag', plan.cacheTagPrefix);
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
    core.saveState('resolved-tags', resolvedTags.join(','));
    core.saveState('verify-save-tags', deferredVerifyTags.join(','));
    core.saveState('verify-mode', inputs.verify);
    core.saveState('verify-timeout-seconds', String(inputs.verifyTimeoutSeconds));
    core.saveState('verify-require-server-signature', String(inputs.verifyRequireServerSignature));

    if (inputs.verify !== 'none' && immediateVerifyTags.length > 0) {
      await verifyResolvedTags(plan.workspace, immediateVerifyTags, {
        mode: inputs.verify,
        timeoutSeconds: inputs.verifyTimeoutSeconds,
        requireServerSignature: inputs.verifyRequireServerSignature,
        verbose: inputs.verbose,
      });
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
