import { spawnSync } from 'node:child_process';
import { getArgValue, mergeReleaseEnv } from './release-env.mjs';

const fileArgs = process.argv
  .filter((entry) => entry.startsWith('--config-env-file='))
  .map((entry) => entry.slice('--config-env-file='.length));
const envFiles = fileArgs.length > 0 ? fileArgs : ['.env.local', '.dev.vars'];
const releaseEnv = mergeReleaseEnv(envFiles);

const projectName =
  getArgValue('--project-name') ||
  releaseEnv.CLOUDFLARE_PAGES_PROJECT_NAME ||
  'packet-opt-control-tower';
const productionBranch =
  getArgValue('--production-branch') ||
  releaseEnv.CLOUDFLARE_PAGES_BRANCH ||
  'main';

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npxCommand,
  [
    'wrangler',
    'pages',
    'project',
    'create',
    projectName,
    '--production-branch',
    productionBranch,
  ],
  {
    env: {
      ...process.env,
      ...releaseEnv,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

const combinedOutput = `${result.stdout || ''}${result.stderr || ''}`;

if (combinedOutput.trim()) {
  process.stdout.write(combinedOutput);
}

if (
  result.status === 0 ||
  /already exists|A project with this name/i.test(combinedOutput)
) {
  process.exit(0);
}

process.exit(result.status ?? 1);
