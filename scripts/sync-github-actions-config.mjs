import { spawnSync } from 'node:child_process';
import {
  getArgValue,
  isNonEmpty,
  mergeReleaseEnv,
  resolveDeploymentMode,
  resolveGitHubRepoSlug,
} from './release-env.mjs';

const dryRun = process.argv.includes('--dry-run');
const fileArgs = process.argv
  .filter((entry) => entry.startsWith('--config-env-file='))
  .map((entry) => entry.slice('--config-env-file='.length));

const envFiles = fileArgs.length > 0 ? fileArgs : ['.env.local', '.dev.vars'];
const releaseEnv = mergeReleaseEnv(envFiles);
const repoSlug = resolveGitHubRepoSlug(getArgValue('--repo'));
const deploymentMode = resolveDeploymentMode(releaseEnv);

const coreSecretKeys = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'VITE_PUBLIC_APP_URL',
  'PUBLIC_APP_URL',
  'ALLOWED_ORIGINS',
  'PUBLIC_SECURITY_CONTACT',
];

const managedOnlySecretKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CRM_RECIPIENT_EMAIL',
];

const optionalFreeModeSecretKeys = managedOnlySecretKeys.filter((key) => isNonEmpty(releaseEnv[key]));
const secretKeys =
  deploymentMode === 'managed'
    ? [...coreSecretKeys, ...managedOnlySecretKeys]
    : [...coreSecretKeys, ...optionalFreeModeSecretKeys];

const variableEntries = {
  CLOUDFLARE_PAGES_PROJECT_NAME:
    releaseEnv.CLOUDFLARE_PAGES_PROJECT_NAME || 'packet-opt-control-tower',
  CLOUDFLARE_PAGES_BRANCH: releaseEnv.CLOUDFLARE_PAGES_BRANCH || 'main',
};

if (!isNonEmpty(repoSlug)) {
  console.error('Không resolve được GitHub repo slug. Dùng --repo owner/repo hoặc kiểm tra git remote.');
  process.exit(1);
}

const missingSecrets = secretKeys.filter((key) => !isNonEmpty(releaseEnv[key]));
if (missingSecrets.length > 0) {
  console.error(`Thiếu GitHub secrets cần thiết: ${missingSecrets.join(', ')}`);
  process.exit(1);
}

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        deploymentMode,
        repoSlug,
        envFiles,
        secretKeys,
        variableEntries: Object.keys(variableEntries),
      },
      null,
      2
    )
  );
  process.exit(0);
}

function runGh(args, value) {
  const ghCommand = process.platform === 'win32' ? 'gh.exe' : 'gh';
  const result = spawnSync(ghCommand, args, {
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
    input: value,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const key of secretKeys) {
  runGh(['secret', 'set', key, '--repo', repoSlug, '--body', String(releaseEnv[key])], '');
}

for (const [key, value] of Object.entries(variableEntries)) {
  runGh(['variable', 'set', key, '--repo', repoSlug, '--body', String(value)], '');
}

console.log(
  JSON.stringify(
    {
      ok: true,
      deploymentMode,
      repoSlug,
      secretKeys,
      variableEntries: Object.keys(variableEntries),
    },
    null,
    2
  )
);
