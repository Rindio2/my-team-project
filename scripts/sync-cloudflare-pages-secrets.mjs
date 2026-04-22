import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getArgValue, isNonEmpty, mergeReleaseEnv } from './release-env.mjs';

const dryRun = process.argv.includes('--dry-run');
const fileArgs = process.argv
  .filter((entry) => entry.startsWith('--config-env-file='))
  .map((entry) => entry.slice('--config-env-file='.length));
const envFiles = fileArgs.length > 0 ? fileArgs : ['.dev.vars', '.env.local'];
const releaseEnv = mergeReleaseEnv(envFiles);
const projectName =
  getArgValue('--project-name') ||
  releaseEnv.CLOUDFLARE_PAGES_PROJECT_NAME ||
  'packet-opt-control-tower';

const runtimeSecrets = {
  PUBLIC_APP_URL: releaseEnv.PUBLIC_APP_URL,
  ALLOWED_ORIGINS: releaseEnv.ALLOWED_ORIGINS || releaseEnv.PUBLIC_APP_URL,
  PUBLIC_SECURITY_CONTACT: releaseEnv.PUBLIC_SECURITY_CONTACT,
  SUPABASE_URL: releaseEnv.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: releaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY: releaseEnv.RESEND_API_KEY,
  RESEND_FROM_EMAIL: releaseEnv.RESEND_FROM_EMAIL,
  CRM_RECIPIENT_EMAIL: releaseEnv.CRM_RECIPIENT_EMAIL,
};

const requiredKeys = ['PUBLIC_APP_URL', 'ALLOWED_ORIGINS', 'PUBLIC_SECURITY_CONTACT'];
const missingKeys = requiredKeys.filter((key) => !isNonEmpty(runtimeSecrets[key]));

if (!projectName) {
  console.error('Thiếu --project-name hoặc CLOUDFLARE_PAGES_PROJECT_NAME.');
  process.exit(1);
}

if (missingKeys.length > 0) {
  console.error(`Thiếu runtime secrets tối thiểu: ${missingKeys.join(', ')}`);
  process.exit(1);
}

const payload = Object.fromEntries(
  Object.entries(runtimeSecrets)
    .filter(([, value]) => isNonEmpty(value))
    .map(([key, value]) => [key, String(value).trim()])
);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        projectName,
        syncedKeys: Object.keys(payload),
      },
      null,
      2
    )
  );
  process.exit(0);
}

const tempDir = mkdtempSync(join(tmpdir(), 'packet-opt-pages-secrets-'));
const payloadPath = join(tempDir, 'pages-secrets.json');

writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npxCommand,
  ['wrangler', 'pages', 'secret', 'bulk', payloadPath, '--project-name', projectName],
  {
    env: {
      ...process.env,
      ...releaseEnv,
    },
    stdio: 'inherit',
  }
);

rmSync(tempDir, { recursive: true, force: true });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      projectName,
      syncedKeys: Object.keys(payload),
    },
    null,
    2
  )
);
