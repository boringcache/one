import { execBoringCache } from './core';
import { resolveTrustDecision as resolveCliTrustDecision, } from './core/trust';
export function resolveTrustDecision(requested) {
    return resolveCliTrustDecision(requested, execBoringCache);
}
export { ensureBoringCache, execBoringCache, getActionState, saveActionState, parseEntries, } from './core';
export { buildFlagArgs, getInputs, DEFAULT_OCI_HYDRATION_POLICY, } from './core/action-inputs';
export { applyCliPlanEnv, buildArchiveEntries, buildPlan, getCacheTagPrefix, resolveCliCapabilityVersion, validateOneInputs, } from './core/plan';
export { requireCliVerificationTags, resolveVerificationTags, } from './core/tags';
export { actionErrorMessage, actionEvidenceProductRefs, postPhaseSummary, restorePhaseSummary, writeActionEvidence, writeActionFailureEvidence, } from './core/evidence';
export { loadDiagnosticsConfig, normalizeDiagnosticsLogLines, normalizeDiagnosticsMode, readLogTail, resolveDiagnosticsConfig, runDiagnosticsGroup, MAX_DIAGNOSTICS_LOG_BYTES, MAX_DIAGNOSTICS_LOG_LINES, } from './core/diagnostics';
export { CANDIDATE_RECEIPT_FILE_ENV, prepareCandidateReceiptFile, publishCandidateOutputs, readCandidateReceipts, useCandidateReceiptFile, } from './core/candidates';
export { applyTrustEnvPolicy, buildActionTrustState, isPullRequestEvent, normalizeTrustPolicy, parseSavedTrustDecision, } from './core/trust';
