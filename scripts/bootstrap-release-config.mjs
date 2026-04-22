import { spawnSync } from 'node:child_process';
import { getArgValue, mergeReleaseEnv } from './release-env.mjs';

const dryRun = process.argv.includes('--dry-run');
const fileArgs = process.argv
  .filter((entry) => entry.startsWith('--config-env-file='))
  .map((entry) => entry.slice('--config-env-file='.length));

const envFiles = fileArgs.length > 0 ? fileArgs : ['.env.local', '.dev.vars'];
const releaseEnv = mergeReleaseEnv(envFiles);
const repoSlug = getArgValue('--repo');
const projectName =
  getArgValue('--project-name') ||
  releaseEnv.CLOUDFLARE_PAGES_PROJECT_NAME ||
  'packet-opt-control-tower';

function runNodeScript(scriptPath, args = []) {
  const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
  const result = spawnSync(nodeCommand, [scriptPath, ...args], {
    env: {
      ...process.env,
      ...releaseEnv,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runNodeScript('scripts/release-check.mjs', ['--strict']);
runNodeScript('scripts/sync-github-actions-config.mjs', [
  ...(repoSlug ? ['--repo', repoSlug] : []),
  ...(dryRun ? ['--dry-run'] : []),
  ...envFiles.flatMap((file) => ['--config-env-file=' + file]),
]);
runNodeScript('scripts/sync-cloudflare-pages-secrets.mjs', [
  '--project-name',
  projectName,
  ...(dryRun ? ['--dry-run'] : []),
]);
