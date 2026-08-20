import { resolveGitHubCacheIdentity, startGhaAdapter, } from '../core';
import { resolvePreferredPort, saveModeState, setProxyOutputs, } from './shared';
export async function runGhaRestore(plan, inputs) {
    const requestedPort = await resolvePreferredPort(inputs.proxyPort, 'proxy-port');
    const identity = resolveGitHubCacheIdentity();
    const adapter = await startGhaAdapter({
        workspace: plan.workspace,
        repositoryId: identity.repositoryId,
        workflowRunBackendId: identity.workflowRunBackendId,
        workflowJobRunBackendId: identity.workflowJobRunBackendId,
        scope: identity.scope,
        readScopes: identity.readScopes,
        port: requestedPort,
        readOnly: inputs.readOnly,
        verbose: inputs.verbose,
    });
    saveModeState('proxy-pid', String(adapter.pid));
    saveModeState('proxy-port', String(adapter.port));
    saveModeState('proxy-log-path', adapter.logPath);
    saveModeState('workspace', plan.workspace);
    setProxyOutputs(adapter.port);
    return {
        resolvedEntries: '',
        evidence: {
            adapter: 'gha',
            repository_id: identity.repositoryId,
            readable_scope_count: identity.readScopes.length + 1,
            fallback_scope_count: identity.readScopes.length,
            results_url: adapter.resultsUrl,
            read_only: adapter.readOnly,
        },
    };
}
