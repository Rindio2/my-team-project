import { getBackendCapabilitySnapshot, json } from './_shared.js';

export function onRequestOptions(context) {
  return json({ ok: true }, { request: context.request, env: context.env, methods: 'GET,OPTIONS' });
}

export function onRequestGet(context) {
  const backend = getBackendCapabilitySnapshot(context.env);

  return json({
    service: 'packet-opt-control-tower',
    status: 'ok',
    region: context.cf?.colo || 'unknown',
    runtime: 'cloudflare-pages-functions',
    timestamp: new Date().toISOString(),
    version: 'release-mvp',
    endpoints: ['/api/status', '/api/preflight', '/api/leads', '/api/report-email'],
    capabilities: backend.capabilities,
    release: backend.release,
    allowedOrigins: backend.allowedOrigins,
  }, { request: context.request, env: context.env, methods: 'GET,OPTIONS' });
}
