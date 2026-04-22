const DEPLOYMENT_MODE_FREE = 'free';
const DEPLOYMENT_MODE_MANAGED = 'managed';

function normalizeDeploymentMode(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === DEPLOYMENT_MODE_MANAGED) {
    return DEPLOYMENT_MODE_MANAGED;
  }

  return DEPLOYMENT_MODE_FREE;
}

export function getDeploymentMode() {
  return normalizeDeploymentMode(import.meta.env.VITE_DEPLOYMENT_MODE);
}

export function isFreeDeploymentMode() {
  return getDeploymentMode() === DEPLOYMENT_MODE_FREE;
}

export function isManagedDeploymentMode() {
  return getDeploymentMode() === DEPLOYMENT_MODE_MANAGED;
}

export const DEPLOYMENT_MODES = {
  FREE: DEPLOYMENT_MODE_FREE,
  MANAGED: DEPLOYMENT_MODE_MANAGED,
};
