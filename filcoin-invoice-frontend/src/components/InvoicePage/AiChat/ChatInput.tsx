import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AiMode } from '../../../types/ai';
import { TOOL_REGISTRY } from '../../../services/ai/tools/tool-registry';

const MAX_IMAGES = 3;

const MODES: AiMode[] = ['auto', 'summarize', 'edit', 'analyze', 'format'];

const MODE_META: Record<AiMode, { label: string; description: string; color: string; bg: string }> = {
  auto:      { label: 'Auto',      description: 'AI picks the right task automatically', color: '#4f46e5', bg: '#eef2ff' },
  summarize: { label: 'Summarize', description: 'Summarize invoice content',             color: '#0891b2', bg: '#ecfeff' },
  edit:      { label: 'Edit',      description: 'Insert or change cell values',          color: '#059669', bg: '#ecfdf5' },
  analyze:   { label: 'Analyze',   description: 'Find inconsistencies & errors',         color: '#d97706', bg: '#fffbeb' },
  format:    { label: 'Format',    description: 'Fix spelling & casing issues',          color: '#7c3aed', bg: '#f5f3ff' },
};

interface ChatInputProps {
  onSend: (text: string, images?: string[], mode?: AiMode, activeToolNames?: string[]) => void;
  onAbort?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  footerNames?: string[];
  editableCellCount?: number;
  activeToolNames?: Set<string>;
  onToggleTool?: (name: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onAbort,
  isLoading = false,
  disabled,
  footerNames = [],
  editableCellCount = 0,
  activeToolNames = new Set(),
  onToggleTool,
}) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [mode, setMode] = useState<AiMode>('auto');
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showToolMenu, setShowToolMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const toolMenuRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if ((!trimmed && images.length === 0) || disabled) return;
    onSend(
      trimmed,
      images.length > 0 ? images : undefined,
      mode,
      activeToolNames.size > 0 ? Array.from(activeToolNames) : undefined,
    );
    setText('');
    setImages([]);
    if (textareaRef.current) textareaRef.current.style.height = '40px';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  // Close mode/tool menus on outside click
  useEffect(() => {
    if (!showModeMenu && !showToolMenu) return;
    const handler = (e: MouseEvent) => {
      if (showModeMenu && modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
      if (showToolMenu && toolMenuRef.current && !toolMenuRef.current.contains(e.target as Node)) {
        setShowToolMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModeMenu, showToolMenu]);

  const addImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    // Read the file outside any state updater so FileReader is created exactly once.
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) setImages(cur => cur.length < MAX_IMAGES ? [...cur, dataUrl] : cur);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    // Respect the limit before iterating so we don't kick off extra readers.
    const slots = MAX_IMAGES - images.length;
    Array.from(e.target.files).slice(0, slots).forEach(addImageFile);
    e.target.value = '';
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        // Call addImageFile directly — no setImages wrapper here.
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }
    }
  }, [addImageFile]);

  const canSend = !disabled && (text.trim().length > 0 || images.length > 0);
  const atImageLimit = images.length >= MAX_IMAGES;
  const meta = MODE_META[mode];

  return (
    <div style={{ padding: '8px 12px 12px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div
        style={{
          border: `1.5px solid ${showModeMenu ? meta.color : '#e5e7eb'}`,
          borderRadius: '14px',
          backgroundColor: '#fff',
          overflow: 'visible',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Image previews */}
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', padding: '10px 12px 0', flexWrap: 'wrap' }}>
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img
                  src={src}
                  alt={`attachment ${i + 1}`}
                  style={{
                    width: '52px', height: '52px', objectFit: 'cover',
                    borderRadius: '8px', border: '1px solid #e5e7eb', display: 'block',
                  }}
                />
                <button
                  onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  style={{
                    position: 'absolute', top: '-5px', right: '-5px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: 'none', backgroundColor: '#6b7280', color: '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '10px', lineHeight: 1, padding: 0,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            disabled
              ? 'Waiting for response...'
              : mode === 'summarize' ? 'Ask for a summary...'
              : mode === 'analyze'  ? 'Ask to analyze the invoice...'
              : mode === 'format'   ? 'Ask to fix formatting...'
              : mode === 'edit'     ? 'Describe what to change...'
              : 'Ask about your invoice...'
          }
          disabled={disabled}
          rows={1}
          style={{
            width: '100%',
            padding: '12px 14px 6px',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            lineHeight: '1.5',
            resize: 'none',
            fontFamily: 'inherit',
            minHeight: '44px',
            maxHeight: '120px',
            backgroundColor: 'transparent',
            boxSizing: 'border-box',
            display: 'block',
            color: '#1f2937',
          }}
        />

        {/* ── Bottom toolbar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px 8px',
            gap: '6px',
            flexWrap: 'nowrap',
          }}
        >
          {/* Image upload (+) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || atImageLimit}
            title={atImageLimit ? 'Maximum 3 images' : 'Attach image'}
            style={{
              width: '28px', height: '28px', borderRadius: '8px',
              border: '1px solid #e5e7eb', flexShrink: 0,
              backgroundColor: (disabled || atImageLimit) ? '#f9fafb' : '#f9fafb',
              color: (disabled || atImageLimit) ? '#c4c9d4' : '#6b7280',
              cursor: (disabled || atImageLimit) ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Tool toggle button */}
          {TOOL_REGISTRY.length > 0 && (
            <div ref={toolMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => !disabled && setShowToolMenu(v => !v)}
                disabled={disabled}
                title="Toggle tools"
                style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  border: `1px solid ${activeToolNames.size > 0 ? '#4f46e5' : '#e5e7eb'}`,
                  backgroundColor: activeToolNames.size > 0 ? '#eef2ff' : '#f9fafb',
                  color: activeToolNames.size > 0 ? '#4f46e5' : '#9ca3af',
                  cursor: disabled ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {/* Wrench icon */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                {/* Active count badge */}
                {activeToolNames.size > 0 && (
                  <span style={{
                    position: 'absolute', top: '-5px', right: '-5px',
                    width: '14px', height: '14px', borderRadius: '50%',
                    backgroundColor: '#4f46e5', color: '#fff',
                    fontSize: '9px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {activeToolNames.size}
                  </span>
                )}
              </button>

              {/* Tool menu popover */}
              {showToolMenu && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
                  backgroundColor: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: '12px', overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  minWidth: '220px', zIndex: 200,
                }}>
                  <div style={{ padding: '8px 12px 6px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tools
                  </div>
                  {TOOL_REGISTRY.map(tool => {
                    const active = activeToolNames.has(tool.name);
                    return (
                      <div
                        key={tool.name}
                        onClick={() => onToggleTool?.(tool.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '8px 12px', cursor: 'pointer',
                          backgroundColor: active ? '#f5f3ff' : 'transparent',
                        }}
                      >
                        {/* Toggle pill */}
                        <div style={{
                          width: '32px', height: '18px', borderRadius: '9px', flexShrink: 0,
                          backgroundColor: active ? '#4f46e5' : '#d1d5db',
                          position: 'relative', transition: 'background-color 0.15s',
                        }}>
                          <div style={{
                            position: 'absolute', top: '2px',
                            left: active ? '16px' : '2px',
                            width: '14px', height: '14px', borderRadius: '50%',
                            backgroundColor: '#fff', transition: 'left 0.15s',
                          }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: active ? '#4f46e5' : '#374151' }}>
                            {tool.label}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                            {tool.category ?? 'General'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Current sheet badge */}
          {footerNames.length > 0 && (
            <span style={{
              fontSize: '11px', color: '#6b7280', backgroundColor: '#f3f4f6',
              borderRadius: '6px', padding: '3px 8px', fontWeight: 500,
              border: '1px solid #e5e7eb', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {footerNames[0]}
            </span>
          )}

          {/* Editable cells count */}
          {editableCellCount > 0 && (
            <span style={{
              fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {editableCellCount} editable cells
            </span>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Mode selector */}
          <div ref={modeMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => !disabled && setShowModeMenu(v => !v)}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 9px', borderRadius: '8px',
                border: `1px solid ${meta.color}33`,
                backgroundColor: meta.bg,
                color: meta.color,
                fontSize: '12px', fontWeight: 600,
                cursor: disabled ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {meta.label}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Mode dropdown */}
            {showModeMenu && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
                backgroundColor: '#fff', border: '1px solid #e5e7eb',
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: '200px', zIndex: 200,
              }}>
                {MODES.map(m => {
                  const mm = MODE_META[m];
                  const active = m === mode;
                  return (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setShowModeMenu(false); }}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        width: '100%', textAlign: 'left',
                        padding: '9px 12px', border: 'none',
                        backgroundColor: active ? mm.bg : 'transparent',
                        borderLeft: active ? `3px solid ${mm.color}` : '3px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600, color: active ? mm.color : '#374151' }}>
                        {mm.label}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                        {mm.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stop button (while loading) or Send button */}
          {isLoading ? (
            <button
              onClick={onAbort}
              title="Stop generation"
              style={{
                width: '30px', height: '30px', borderRadius: '9px',
                border: 'none', flexShrink: 0,
                backgroundColor: '#ef4444',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Filled square = stop */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                width: '30px', height: '30px', borderRadius: '9px',
                border: 'none', flexShrink: 0,
                backgroundColor: canSend ? meta.color : '#d1d5db',
                color: '#fff',
                cursor: canSend ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
