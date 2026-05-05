import * as http from 'http';
import { AddressInfo } from 'net';
import * as core from '@actions/core';
import {
  assertOciImportReady,
  logOciImportReadiness,
  waitForOciImportReadiness,
  waitForOciRefsReadable,
} from '../lib/core/proxy';

type RefState = 'readable' | 'missing';

interface TestProxyState {
  status: {
    phase?: string;
    publish_state?: string;
    publish_settled?: boolean;
    tags_visible?: boolean;
  };
  refs: Record<string, RefState>;
}

async function withProxyServer<T>(
  initialState: TestProxyState,
  fn: (context: { host: string; port: number; state: TestProxyState }) => Promise<T>,
): Promise<T> {
  const state = initialState;
  const server = http.createServer((request, response) => {
    const url = request.url || '/';

    if (url === '/_boringcache/status') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(state.status));
      return;
    }

    const manifestMatch = url.match(/^\/v2\/cache\/manifests\/(.+)$/);
    if (manifestMatch) {
      const ref = decodeURIComponent(manifestMatch[1]);
      const refState = state.refs[ref] || 'missing';
      if (refState === 'readable') {
        response.writeHead(200, {
          'content-type': 'application/vnd.oci.image.manifest.v1+json',
        });
        response.end();
        return;
      }

      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ errors: [{ code: 'MANIFEST_UNKNOWN' }] }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;

  try {
    return await fn({ host: '127.0.0.1', port: address.port, state });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

describe('proxy OCI import readiness', () => {
  it('returns ready when every requested manifest is readable', async () => {
    await withProxyServer({
      status: {
        phase: 'ready',
        publish_state: 'published',
        publish_settled: true,
        tags_visible: true,
      },
      refs: {
        'branch-main': 'readable',
        'default': 'readable',
      },
    }, async ({ host, port }) => {
      const readiness = await waitForOciImportReadiness(host, port, ['branch-main', 'default'], 100);

      expect(readiness).toEqual({
        requestedRefs: ['branch-main', 'default'],
        readableRefs: ['branch-main', 'default'],
        unreadableRefs: [],
        ready: true,
        phase: 'ready',
        publishState: 'published',
        publishSettled: true,
        tagsVisible: true,
      });
    });
  });

  it('returns once the first usable planned ref is readable', async () => {
    await withProxyServer({
      status: {
        phase: 'ready',
        publish_state: 'published',
        publish_settled: true,
        tags_visible: true,
      },
      refs: {
        'branch-main': 'missing',
        'default': 'readable',
      },
    }, async ({ host, port }) => {
      const readiness = await waitForOciImportReadiness(host, port, ['branch-main', 'default'], 100);

      expect(readiness.ready).toBe(false);
      expect(readiness.readableRefs).toEqual(['default']);
      expect(readiness.unreadableRefs).toEqual(['branch-main']);
      expect(readiness.phase).toBe('ready');
      expect(readiness.publishSettled).toBe(true);
      expect(readiness.tagsVisible).toBe(true);
    });
  });

  it('waits while no planned manifest is readable', async () => {
    await withProxyServer({
      status: {
        phase: 'ready',
        publish_state: 'published',
        publish_settled: true,
        tags_visible: true,
      },
      refs: {
        'branch-main': 'missing',
        'default': 'missing',
      },
    }, async ({ host, port, state }) => {
      setTimeout(() => {
        state.refs.default = 'readable';
      }, 150);

      const readiness = await waitForOciImportReadiness(host, port, ['branch-main', 'default'], 1500);

      expect(readiness.ready).toBe(false);
      expect(readiness.readableRefs).toEqual(['default']);
      expect(readiness.unreadableRefs).toEqual(['branch-main']);
    });
  });

  it('waits until every requested promotion ref is readable', async () => {
    await withProxyServer({
      status: {
        phase: 'ready',
        publish_state: 'published',
        publish_settled: true,
        tags_visible: true,
      },
      refs: {
        default: 'missing',
        'branch-main': 'readable',
      },
    }, async ({ host, port, state }) => {
      setTimeout(() => {
        state.refs.default = 'readable';
      }, 150);

      const readiness = await waitForOciRefsReadable(host, port, ['default', 'branch-main'], 1500);

      expect(readiness).toEqual({
        requestedRefs: ['default', 'branch-main'],
        readableRefs: ['default', 'branch-main'],
        unreadableRefs: [],
        ready: true,
        phase: 'ready',
        publishState: 'published',
        publishSettled: true,
        tagsVisible: true,
      });
    });
  });

  it('reports unreadable promotion refs after timeout', async () => {
    await withProxyServer({
      status: {
        phase: 'ready',
        publish_state: 'published',
        publish_settled: true,
        tags_visible: true,
      },
      refs: {
        default: 'missing',
        'branch-main': 'readable',
      },
    }, async ({ host, port }) => {
      const readiness = await waitForOciRefsReadable(host, port, ['default', 'branch-main'], 100);

      expect(readiness.ready).toBe(false);
      expect(readiness.readableRefs).toEqual(['branch-main']);
      expect(readiness.unreadableRefs).toEqual(['default']);
    });
  });

  it('notices cold starts when no planned OCI import ref is readable', () => {
    logOciImportReadiness({
      requestedRefs: ['branch-main', 'default'],
      readableRefs: [],
      unreadableRefs: ['branch-main', 'default'],
      ready: false,
      phase: 'ready',
      publishState: 'settled',
      publishSettled: true,
      tagsVisible: true,
    });

    expect(core.notice).toHaveBeenCalledWith(
      'BoringCache proxy became ready before OCI import refs were fully readable. readable=[] unreadable=[branch-main, default] phase=ready publish=settled publish_settled=true tags_visible=true. Continuing without registry imports; this is expected for cold seed jobs.',
    );
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('warns when only some planned OCI import refs are readable', () => {
    logOciImportReadiness({
      requestedRefs: ['branch-main', 'default'],
      readableRefs: ['default'],
      unreadableRefs: ['branch-main'],
      ready: false,
      phase: 'ready',
      publishState: 'settled',
      publishSettled: true,
      tagsVisible: true,
    });

    expect(core.warning).toHaveBeenCalledWith(
      'BoringCache proxy became ready before OCI import refs were fully readable. readable=[default] unreadable=[branch-main] phase=ready publish=settled publish_settled=true tags_visible=true',
    );
    expect(core.notice).not.toHaveBeenCalled();
  });

  it('fails strict readiness when no planned OCI import ref is readable', () => {
    expect(() => assertOciImportReady({
      requestedRefs: ['branch-main', 'default'],
      readableRefs: [],
      unreadableRefs: ['branch-main', 'default'],
      ready: false,
    })).toThrow(
      'No OCI cache import refs were readable. requested=[branch-main, default]',
    );
  });

  it('fails strict readiness when only some planned OCI import refs are readable', () => {
    expect(() => assertOciImportReady({
      requestedRefs: ['branch-main', 'default'],
      readableRefs: ['default'],
      unreadableRefs: ['branch-main'],
      ready: false,
    })).toThrow(
      'Some OCI cache import refs were unreadable. readable=[default] unreadable=[branch-main]',
    );
  });
});
