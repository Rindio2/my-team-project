const args = new Set(process.argv.slice(2));
const strictMode = args.has('--strict');

function isNonEmpty(value) {
  return Boolean(String(value || '').trim());
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isValidEmailLike(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^mailto:/, '')
    .replace(/^.+<([^>]+)>$/, '$1');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function isValidOriginList(value) {
  const origins = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return origins.length > 0 && origins.every((origin) => isValidUrl(origin));
}

const coreChecks = [
  {
    key: 'VITE_PUBLIC_APP_URL',
    required: true,
    validate: isValidUrl,
    message: 'Phải là URL hợp lệ để build public assets và redirect magic link.',
  },
  {
    key: 'PUBLIC_APP_URL',
    required: true,
    validate: isValidUrl,
    message: 'Phải là URL hợp lệ để khóa origin cho Pages Functions.',
  },
  {
    key: 'PUBLIC_SECURITY_CONTACT',
    required: true,
    validate: isValidEmailLike,
    message: 'Phải là mailto hoặc email hợp lệ cho security.txt.',
  },
];

const optionalChecks = [
  {
    key: 'ALLOWED_ORIGINS',
    validate: isValidOriginList,
    message: 'Phải là danh sách URL hợp lệ, phân tách bằng dấu phẩy nếu có nhiều origin.',
  },
];

const optionalCapabilityChecks = [
  {
    name: 'frontend-cloud',
    fields: [
      {
        key: 'VITE_SUPABASE_URL',
        validate: isValidUrl,
        message: 'Phải là URL Supabase hợp lệ cho frontend.',
      },
      {
        key: 'VITE_SUPABASE_ANON_KEY',
        validate: isNonEmpty,
        message: 'Thiếu Supabase anon key cho frontend.',
      },
    ],
    description: 'Mở Supabase auth + cloud save trực tiếp từ frontend.',
  },
  {
    name: 'server-logging',
    fields: [
      {
        key: 'SUPABASE_URL',
        validate: isValidUrl,
        message: 'Phải là URL Supabase hợp lệ cho Pages Functions.',
      },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        validate: isNonEmpty,
        message: 'Thiếu Supabase service role key cho Pages Functions.',
      },
    ],
    description: 'Mở logging CRM/report ở Pages Functions.',
  },
  {
    name: 'email-workflow',
    fields: [
      {
        key: 'RESEND_API_KEY',
        validate: isNonEmpty,
        message: 'Thiếu Resend API key.',
      },
      {
        key: 'RESEND_FROM_EMAIL',
        validate: isValidEmailLike,
        message: 'Phải là email hoặc dạng Name <email> hợp lệ cho Resend.',
      },
    ],
    description: 'Mở gửi executive report qua email.',
  },
  {
    name: 'crm-notify',
    fields: [
      {
        key: 'CRM_RECIPIENT_EMAIL',
        validate: isValidEmailLike,
        message: 'Phải là email hợp lệ để nhận notify lead.',
      },
    ],
    description: 'Mở notify lead nội bộ cho sales/ops.',
  },
];

const errors = [];
const warnings = [];

coreChecks.forEach((check) => {
  const value = process.env[check.key];
  if (!isNonEmpty(value) || !check.validate(value)) {
    errors.push(`${check.key}: ${check.message}`);
  }
});

optionalChecks.forEach((check) => {
  const value = process.env[check.key];
  if (isNonEmpty(value) && !check.validate(value)) {
    errors.push(`${check.key}: ${check.message}`);
  }
});

optionalCapabilityChecks.forEach((check) => {
  const populated = check.fields.filter((field) => isNonEmpty(process.env[field.key]));
  if (populated.length > 0 && populated.length < check.fields.length) {
    errors.push(
      `${check.name}: cấu hình chưa đầy đủ. Cần điền đủ ${check.fields
        .map((field) => field.key)
        .join(', ')}.`
    );
    return;
  }

  if (populated.length === 0) {
    warnings.push(`${check.name}: chưa bật. ${check.description}`);
    return;
  }

  check.fields.forEach((field) => {
    if (!field.validate(process.env[field.key])) {
      errors.push(`${field.key}: ${field.message}`);
    }
  });
});

if (strictMode) {
  optionalCapabilityChecks.forEach((check) => {
    const missing = check.fields
      .map((field) => field.key)
      .filter((field) => !isNonEmpty(process.env[field]));
    if (missing.length > 0) {
      errors.push(`${check.name}: strict release yêu cầu thêm ${missing.join(', ')}.`);
    }
  });
}

const summary = {
  ok: errors.length === 0,
  strictMode,
  core: Object.fromEntries(coreChecks.map((check) => [check.key, Boolean(process.env[check.key])])),
  routing: {
    ALLOWED_ORIGINS: Boolean(process.env.ALLOWED_ORIGINS),
  },
  capabilities: Object.fromEntries(
    optionalCapabilityChecks.map((check) => [
      check.name,
      check.fields.every((field) => isNonEmpty(process.env[field.key])),
    ])
  ),
  errors,
  warnings,
};

console.log(JSON.stringify(summary, null, 2));

if (errors.length > 0) {
  process.exit(1);
}
