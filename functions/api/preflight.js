import { runCommercialPreflight } from '../../src/utils/commercialHub.js';
import { handleOptions, json, rejectDisallowedOrigin, readJsonBody } from './_shared.js';

export function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  try {
    const blocked = rejectDisallowedOrigin(context.request, context.env);
    if (blocked) return blocked;

    const payload = await readJsonBody(context.request);
    const result = runCommercialPreflight({
      items: Array.isArray(payload?.items) ? payload.items : [],
      container: payload?.container || {},
      maxWeight: payload?.maxWeight,
      floorLoadLimit: payload?.floorLoadLimit,
      settings: payload?.settings || {},
    });

    return json({
      ok: true,
      result,
    }, { request: context.request, env: context.env });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid preflight payload.',
      },
      { status: 400, request: context.request, env: context.env }
    );
  }
}
