import React, { useState, useEffect } from 'react';

const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const win = (window as any).electronAPI?.window;

  useEffect(() => {
    if (!win) return;
    win.isMaximized().then((v: boolean) => setIsMaximized(v));
    const cleanup = win.onMaximized((v: boolean) => setIsMaximized(v));
    return cleanup;
  }, []);

  if (!win) return null;

  const isMac = win.osPlatform === 'darwin';

  const handleMaximize = async () => {
    await win.maximize();
    const v = await win.isMaximized();
    setIsMaximized(v);
  };

  const btnBase: React.CSSProperties = {
    width: '46px',
    height: '100%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.1s',
    padding: 0,
    color: 'rgba(255,255,255,0.85)',
  };

  const btnHover = (id: string): React.CSSProperties => ({
    ...btnBase,
    backgroundColor:
      hoveredBtn === id
        ? id === 'close'
          ? '#e81123'
          : 'rgba(255,255,255,0.15)'
        : 'transparent',
    color: 'rgba(255,255,255,0.9)',
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '38px',
        backgroundColor: '#3880ff',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 99999,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Draggable region with app name */}
      <div
        onDoubleClick={handleMaximize}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: isMac ? '76px' : '14px',
          WebkitAppRegion: 'drag',
        } as any}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            letterSpacing: '0.2px',
            opacity: 0.92,
          }}
        >
          EdgeBilling
        </span>
      </div>

      {/* Window controls — Windows/Linux only */}
      {!isMac && (
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            WebkitAppRegion: 'no-drag',
          } as any}
        >
          {/* Minimize */}
          <button
            style={btnHover('minimize')}
            onMouseEnter={() => setHoveredBtn('minimize')}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={() => win.minimize()}
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>

          {/* Maximize / Restore */}
          <button
            style={btnHover('maximize')}
            onMouseEnter={() => setHoveredBtn('maximize')}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={handleMaximize}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 0H10V8" stroke="currentColor" strokeWidth="1" />
                <rect x="0" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="transparent" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>

          {/* Close */}
          <button
            style={btnHover('close')}
            onMouseEnter={() => setHoveredBtn('close')}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={() => win.close()}
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default TitleBar;
