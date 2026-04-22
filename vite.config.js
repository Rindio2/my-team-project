import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

function resolveManualChunk(id) {
  const normalizedId = id.replace(/\\/g, '/');

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/')
  ) {
    return 'react-vendor';
  }

  if (normalizedId.includes('/node_modules/@supabase/')) {
    return 'supabase-vendor';
  }

  if (normalizedId.includes('/node_modules/three/examples/')) {
    return 'three-examples';
  }

  if (normalizedId.includes('/node_modules/three/')) {
    return 'three-core';
  }

  if (
    normalizedId.includes('/src/three/') ||
    normalizedId.includes('/src/runtime/WorkspaceController.jsx')
  ) {
    return 'workspace-3d';
  }

  if (normalizedId.includes('/src/utils/projectWorkflow.js')) {
    return 'workspace-workflows';
  }

  if (normalizedId.includes('/src/utils/platformApi.js')) {
    return 'workspace-crm';
  }

  if (
    normalizedId.includes('/src/utils/cloudPlanHub.js') ||
    normalizedId.includes('/src/utils/commercialHub.js') ||
    normalizedId.includes('/src/utils/projectHub.js') ||
    normalizedId.includes('/src/utils/projectShared.js') ||
    normalizedId.includes('/src/utils/sceneState.js') ||
    normalizedId.includes('/src/utils/supabaseClient.js') ||
    normalizedId.includes('/src/utils/uiHelpers.js')
  ) {
    return 'workspace-services';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
});
