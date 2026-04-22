const DEFAULT_ALLOWED_HEADERS = 'content-type';

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

function getConfiguredAllowedOrigins(env = {}) {
  const rawOrigins = [
    env.PUBLIC_APP_URL,
    env.VITE_PUBLIC_APP_URL,
    ...(String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)),
  ];

  return Array.from(new Set(rawOrigins.map(normalizeOrigin).filter(Boolean)));
}

function isLocalOrigin(origin) {
  if (!origin) return false;

  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin, env = {}) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;
  if (isLocalOrigin(normalizedOrigin)) return true;

  return getConfiguredAllowedOrigins(env).includes(normalizedOrigin);
}

function resolveCorsOrigin(request, env = {}) {
  const requestOrigin = normalizeOrigin(request?.headers?.get('origin'));
  const allowedOrigins = getConfiguredAllowedOrigins(env);

  if (!requestOrigin) {
    return allowedOrigins[0] || '*';
  }

  if (isAllowedOrigin(requestOrigin, env)) {
    return requestOrigin;
  }

  return allowedOrigins[0] || 'null';
}

function withCorsHeaders({ request, env, headers = {}, methods = 'POST,OPTIONS' } = {}) {
  return {
    'access-control-allow-origin': resolveCorsOrigin(request, env),
    'access-control-allow-methods': methods,
    'access-control-allow-headers': DEFAULT_ALLOWED_HEADERS,
    'cache-control': 'no-store',
    vary: 'origin',
    ...headers,
  };
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status: init.status || 200,
    headers: withCorsHeaders({
      request: init.request,
      env: init.env,
      methods: init.methods,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        ...init.headers,
      },
    }),
  });
}

export function handleOptions(request, env, methods = 'POST,OPTIONS') {
  const blocked = rejectDisallowedOrigin(request, env);
  if (blocked) return blocked;

  return json({ ok: true }, { request, env, methods });
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function getBackendCapabilitySnapshot(env = {}) {
  const hasSupabaseService = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const hasResend = Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
  const hasCrmRecipient = Boolean(String(env.CRM_RECIPIENT_EMAIL || '').trim());
  const allowedOrigins = getConfiguredAllowedOrigins(env);

  const capabilities = {
    crmLeadPersist: hasSupabaseService,
    crmLeadNotify: hasResend && hasCrmRecipient,
    reportEmail: hasResend,
    reportLog: hasSupabaseService,
    originLock: allowedOrigins.length > 0,
  };

  const issues = [];

  if (!capabilities.originLock) {
    issues.push('Thiếu PUBLIC_APP_URL hoặc ALLOWED_ORIGINS để khóa origin cho Pages Functions.');
  }

  if (!hasSupabaseService) {
    issues.push('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY cho logging server-side.');
  }

  if (!hasResend) {
    issues.push('Thiếu RESEND_API_KEY hoặc RESEND_FROM_EMAIL cho email workflow.');
  }

  if (hasResend && !hasCrmRecipient) {
    issues.push('Thiếu CRM_RECIPIENT_EMAIL cho notify lead nội bộ.');
  }

  return {
    allowedOrigins,
    capabilities,
    release: {
      ready:
        capabilities.originLock &&
        hasSupabaseService &&
        hasResend &&
        hasCrmRecipient,
      issues,
    },
  };
}

export function rejectDisallowedOrigin(request, env) {
  const requestOrigin = request?.headers?.get('origin');

  if (!requestOrigin || isAllowedOrigin(requestOrigin, env)) {
    return null;
  }

  return json(
    {
      ok: false,
      error: 'Origin không được phép gọi API này.',
    },
    {
      status: 403,
      request,
      env,
    }
  );
}

export async function insertSupabaseRow({ env, table, row }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { skipped: true, data: null };
  }

  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Supabase insert failed for ${table} with ${response.status}.`
    );
  }

  return { skipped: false, data };
}

export async function sendResendEmail({ env, to, subject, html, text, replyTo }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error('Resend chưa được cấu hình. Thiếu RESEND_API_KEY hoặc RESEND_FROM_EMAIL.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      reply_to: replyTo ? [replyTo] : undefined,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Resend email failed with status ${response.status}.`
    );
  }

  return data;
}

export function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
