import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

export function isNonEmpty(value) {
  return Boolean(String(value || '').trim());
}

export function getArgValue(name) {
  const inlineArg = process.argv.find((entry) => entry.startsWith(`${name}=`));
  if (inlineArg) {
    return inlineArg.slice(name.length + 1);
  }

  const flagIndex = process.argv.indexOf(name);
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1];
  }

  return '';
}

function parseEnvContent(content) {
  const values = {};
  const lines = String(content || '').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function loadEnvFiles(filePaths = []) {
  return filePaths.reduce((accumulator, filePath) => {
    if (!filePath || !existsSync(filePath)) {
      return accumulator;
    }

    return {
      ...accumulator,
      ...parseEnvContent(readFileSync(filePath, 'utf8')),
    };
  }, {});
}

export function mergeReleaseEnv(filePaths = []) {
  const fileValues = loadEnvFiles(filePaths);
  return {
    ...fileValues,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== undefined)
    ),
  };
}

export function resolveGitHubRepoSlug(explicitRepo = '') {
  if (isNonEmpty(explicitRepo)) {
    return explicitRepo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  }

  try {
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (remoteUrl.startsWith('https://github.com/')) {
      return remoteUrl.replace('https://github.com/', '').replace(/\.git$/, '');
    }

    if (remoteUrl.startsWith('git@github.com:')) {
      return remoteUrl.replace('git@github.com:', '').replace(/\.git$/, '');
    }
  } catch {
    return '';
  }

  return '';
}
