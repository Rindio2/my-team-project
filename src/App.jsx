import { startTransition, useEffect, useState } from 'react';
import './App.css';

import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';

function BootstrapFallback({ error }) {
  const details =
    error instanceof Error && error.message
      ? error.message
      : 'Ứng dụng gặp lỗi khi khởi động workspace.';

  return (
    <div className="app-boot-error-shell">
      <div className="app-boot-error-card">
        <div className="app-boot-error-kicker">Packet Opt Recovery Mode</div>
        <h1 className="app-boot-error-title">Workspace chưa khởi động hoàn tất</h1>
        <p className="app-boot-error-copy">
          App đã chặn trạng thái trắng trang và giữ lại thông tin lỗi để dễ xử lý hơn.
        </p>
        <div className="app-boot-error-details">{details}</div>
        <div className="app-boot-error-actions">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Tải lại ứng dụng
          </button>
        </div>
      </div>
    </div>
  );
}

function RuntimeLoadingOverlay({ status }) {
  const title =
    status === 'loading'
      ? 'Đang nạp engine 3D và workflow vận hành'
      : 'Đang dựng shell để chuẩn bị tải workspace';
  const detail =
    status === 'loading'
      ? 'Three.js, optimizer, cloud workspace và các control đang được tải nền để giảm chi phí bundle đầu trang.'
      : 'Khung ứng dụng đã sẵn sàng. Engine 3D sẽ được gọi khi trình duyệt rảnh để first paint lên nhanh hơn.';

  return (
    <div className="canvas-loading-overlay" role="status" aria-live="polite">
      <div className="canvas-loading-card">
        <div className="canvas-loading-kicker">Lazy-loaded Workspace</div>
        <div className="canvas-loading-title">{title}</div>
        <div className="canvas-loading-copy">{detail}</div>
        <div className="canvas-loading-pulse" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [WorkspaceController, setWorkspaceController] = useState(null);
  const [runtimeStatus, setRuntimeStatus] = useState('idle');
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    let idleHandle = null;
    let timeoutHandle = null;

    const loadWorkspaceController = () => {
      if (isCancelled) return;

      startTransition(() => {
        setRuntimeStatus('loading');
      });

      import('./runtime/WorkspaceController.jsx')
        .then((module) => {
          if (isCancelled) return;

          startTransition(() => {
            setWorkspaceController(() => module.default);
          });
        })
        .catch((error) => {
          if (isCancelled) return;

          setRuntimeStatus('error');
          setBootError(
            error instanceof Error ? error : new Error('Không thể nạp workspace runtime.')
          );
        });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(loadWorkspaceController, { timeout: 1200 });
    } else {
      timeoutHandle = window.setTimeout(loadWorkspaceController, 120);
    }

    return () => {
      isCancelled = true;

      if (idleHandle !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  if (bootError) {
    return <BootstrapFallback error={bootError} />;
  }

  const showLoadingOverlay = runtimeStatus !== 'ready';

  return (
    <div className="app-shell">
      <Header />
      <div className="container-app">
        <Sidebar />
        <main
          className={`canvas-stage ${showLoadingOverlay ? 'canvas-stage-loading' : ''}`}
          data-runtime-status={runtimeStatus}
          aria-busy={showLoadingOverlay}
        >
          <div id="canvas"></div>
          {showLoadingOverlay ? <RuntimeLoadingOverlay status={runtimeStatus} /> : null}
        </main>
      </div>
      {WorkspaceController ? (
        <WorkspaceController
          onReady={() => setRuntimeStatus('ready')}
          onError={(error) => {
            setRuntimeStatus('error');
            setBootError(
              error instanceof Error
                ? error
                : new Error('Không thể khởi tạo Packet Opt workspace.')
            );
          }}
        />
      ) : null}
    </div>
  );
}
