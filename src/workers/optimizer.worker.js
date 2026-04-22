import { optimizeMixedPacking } from '../utils/multiBoxPacking.js';

self.onmessage = (event) => {
  const { id, type, payload } = event.data || {};

  if (type !== 'optimize') return;

  try {
    const result = optimizeMixedPacking(payload);
    self.postMessage({
      id,
      status: 'success',
      result,
    });
  } catch (error) {
    self.postMessage({
      id,
      status: 'error',
      error: error instanceof Error ? error.message : 'Optimizer worker failed.',
    });
  }
};
