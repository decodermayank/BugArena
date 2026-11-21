import { useEffect, useRef, useState, useCallback } from 'react';

export type CursorColor = 'lime' | 'cyan' | 'amber' | 'crimson' | 'mono';

export interface CursorPalette {
  id: CursorColor;
  name: string;
  label: string;
  hex: string;
  glow: string;
  badgeBg: string;
}

export const CURSOR_PALETTES: Record<CursorColor, CursorPalette> = {
  lime: {
    id: 'lime',
    name: 'Lime',
    label: 'CYBER LIME',
    hex: '#00FF66',
    glow: 'rgba(0, 255, 102, 0.5)',
    badgeBg: '#00FF66',
  },
  cyan: {
    id: 'cyan',
    name: 'Cyan',
    label: 'LASER CYAN',
    hex: '#00F5FF',
    glow: 'rgba(0, 245, 255, 0.5)',
    badgeBg: '#00F5FF',
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    label: 'ARCADE AMBER',
    hex: '#FFB800',
    glow: 'rgba(255, 184, 0, 0.5)',
    badgeBg: '#FFB800',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    label: 'GLITCH CRIMSON',
    hex: '#FF2A55',
    glow: 'rgba(255, 42, 85, 0.5)',
    badgeBg: '#FF2A55',
  },
  mono: {
    id: 'mono',
    name: 'Invert',
    label: 'STARK MONO',
    hex: '#000000',
    glow: 'rgba(0, 0, 0, 0.25)',
    badgeBg: '#000000',
  },
};

const COLOR_KEYS: CursorColor[] = ['lime', 'cyan', 'amber', 'crimson', 'mono'];

type CursorMode = 'default' | 'interactive' | 'text' | 'disabled';

// Global event bus so any CursorToggle button can trigger updates instantly
const CURSOR_CHANGE_EVENT = 'bugarena:cursor-change';

export function setGlobalCursorColor(color: CursorColor) {
  try {
    localStorage.setItem('bugarena_cursor_color', color);
    window.dispatchEvent(new CustomEvent(CURSOR_CHANGE_EVENT, { detail: { color } }));
  } catch {
    // ignore
  }
}

export function setGlobalCursorEnabled(enabled: boolean) {
  try {
    localStorage.setItem('bugarena_cursor_enabled', enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(CURSOR_CHANGE_EVENT, { detail: { enabled } }));
  } catch {
    // ignore
  }
}

/**
 * Custom Cursor Component
 * Designed specifically for BugArena's black & white theme:
 * - High-contrast zero-latency center point with precision crosshair
 * - Smooth trailing reticle that adapts cleanly (interactive target, terminal I-beam, click ripple)
 * - Safe for mobile/touch screens (auto-disabled)
 * - Never blocks clicks or text selection (pointer-events: none)
 */
export default function CustomCursor() {
  const [currentColor, setCurrentColor] = useState<CursorColor>(() => {
    try {
      const saved = localStorage.getItem('bugarena_cursor_color') as CursorColor | null;
      return saved && CURSOR_PALETTES[saved] ? saved : 'lime';
    } catch {
      return 'lime';
    }
  });

  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bugarena_cursor_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<CursorMode>('default');
  const [isMouseDown, setIsMouseDown] = useState(false);

  // References for direct DOM manipulation to maintain 120hz+ buttery smooth performance
  const dotRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);

  const pos = useRef({ x: -100, y: -100 });
  const reticlePos = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number>(0);

  // Listen for global custom cursor changes from toggles
  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.color && CURSOR_PALETTES[detail.color as CursorColor]) {
        setCurrentColor(detail.color as CursorColor);
      }
      if (detail?.enabled !== undefined) {
        setEnabled(detail.enabled);
      }
    };
    window.addEventListener(CURSOR_CHANGE_EVENT, handleCustomChange);
    return () => window.removeEventListener(CURSOR_CHANGE_EVENT, handleCustomChange);
  }, []);

  // Sync active CSS variables with the document
  useEffect(() => {
    const palette = CURSOR_PALETTES[currentColor];
    document.documentElement.style.setProperty('--cursor-accent', palette.hex);
    document.documentElement.style.setProperty('--cursor-glow', palette.glow);

    // Apply or remove class on html so index.css can hide native cursor safely
    if (enabled && !isTouchDevice) {
      document.documentElement.classList.add('custom-cursor-active');
    } else {
      document.documentElement.classList.remove('custom-cursor-active');
    }

    return () => {
      document.documentElement.classList.remove('custom-cursor-active');
    };
  }, [currentColor, enabled, isTouchDevice]);

  // Touch screen detection
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsTouchDevice(true);
    }

    const onTouchStart = () => {
      setIsTouchDevice(true);
      document.documentElement.classList.remove('custom-cursor-active');
    };

    window.addEventListener('touchstart', onTouchStart, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', onTouchStart);
  }, []);

  // Mouse tracking and physics loop
  useEffect(() => {
    if (isTouchDevice || !enabled) {
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;

      if (!visible) setVisible(true);

      // Instantly position center dot without frame delay
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }

      // Detect hover target
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isText = Boolean(
        target.closest(
          'input[type="text"], input[type="password"], input[type="search"], input:not([type]), textarea, [contenteditable="true"], .monaco-editor'
        )
      );

      const isInteractive = Boolean(
        target.closest(
          'button, a, [role="button"], summary, select, input[type="submit"], input[type="button"], input[type="checkbox"], label, .btn-ink, .btn-paper, [tabindex="0"]'
        )
      );

      const isDisabled = Boolean(target.closest(':disabled, [aria-disabled="true"]'));

      if (isDisabled) {
        setMode('disabled');
      } else if (isText) {
        setMode('text');
      } else if (isInteractive) {
        setMode('interactive');
      } else {
        setMode('default');
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      setIsMouseDown(true);
      if (rippleRef.current) {
        rippleRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%) scale(0.2)`;
        rippleRef.current.style.opacity = '0.9';
        rippleRef.current.style.transition = 'none';

        // Trigger ripple shockwave
        requestAnimationFrame(() => {
          if (rippleRef.current) {
            rippleRef.current.style.transition = 'transform 0.28s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.28s ease-out';
            rippleRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%) scale(2.2)`;
            rippleRef.current.style.opacity = '0';
          }
        });
      }
    };

    const onMouseUp = () => {
      setIsMouseDown(false);
    };

    const onMouseLeave = () => {
      setVisible(false);
    };

    const onMouseEnter = () => {
      setVisible(true);
    };

    // Smooth lerp loop for the outer reticle
    const renderLoop = () => {
      const targetX = pos.current.x;
      const targetY = pos.current.y;

      // Silky smooth spring interpolation (24% lerp factor per frame)
      reticlePos.current.x += (targetX - reticlePos.current.x) * 0.26;
      reticlePos.current.y += (targetY - reticlePos.current.y) * 0.26;

      if (reticleRef.current) {
        reticleRef.current.style.transform = `translate3d(${reticlePos.current.x}px, ${reticlePos.current.y}px, 0) translate(-50%, -50%)`;
      }

      rafRef.current = requestAnimationFrame(renderLoop);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isTouchDevice, enabled, visible]);

  if (isTouchDevice || !enabled) {
    return null;
  }

  const palette = CURSOR_PALETTES[currentColor];

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[999999] overflow-hidden select-none transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden="true"
    >
      {/* 1. Tactical Click Ripple */}
      <div
        ref={rippleRef}
        className="fixed top-0 left-0 w-8 h-8 rounded-none border-[1.5px] border-black pointer-events-none will-change-transform"
        style={{
          boxShadow: `0 0 12px ${palette.glow}`,
          backgroundColor: palette.hex,
        }}
      />

      {/* 2. Outer Smooth Reticle / Brackets */}
      <div
        ref={reticleRef}
        className="fixed top-0 left-0 will-change-transform flex items-center justify-center transition-[width,height,border-color,background-color] duration-150 ease-out"
        style={{
          width: mode === 'interactive' ? '40px' : mode === 'text' ? '12px' : isMouseDown ? '18px' : '26px',
          height: mode === 'interactive' ? '40px' : mode === 'text' ? '24px' : isMouseDown ? '18px' : '26px',
        }}
      >
        {mode === 'interactive' && (
          /* Interactive Mode: 4 Framing Brackets with subtle rotation */
          <div
            className="w-full h-full relative border-[1.5px] border-black transition-transform duration-200"
            style={{
              boxShadow: `0 0 10px ${palette.glow}, inset 0 0 6px ${palette.glow}`,
              backgroundColor: 'rgba(255, 255, 255, 0.45)',
            }}
          >
            {/* Corner crosshair accents */}
            <span
              className="absolute -top-1 -left-1 w-1.5 h-1.5 border-t-2 border-l-2 border-black"
              style={{ borderColor: palette.id === 'mono' ? '#000' : palette.hex }}
            />
            <span
              className="absolute -top-1 -right-1 w-1.5 h-1.5 border-t-2 border-r-2 border-black"
              style={{ borderColor: palette.id === 'mono' ? '#000' : palette.hex }}
            />
            <span
              className="absolute -bottom-1 -left-1 w-1.5 h-1.5 border-b-2 border-l-2 border-black"
              style={{ borderColor: palette.id === 'mono' ? '#000' : palette.hex }}
            />
            <span
              className="absolute -bottom-1 -right-1 w-1.5 h-1.5 border-b-2 border-r-2 border-black"
              style={{ borderColor: palette.id === 'mono' ? '#000' : palette.hex }}
            />
          </div>
        )}

        {mode === 'text' && (
          /* Text Mode: Vertical Terminal Insertion Caret Brackets */
          <div
            className="w-1.5 h-full border-x border-black animate-pulse"
            style={{
              backgroundColor: palette.hex,
              boxShadow: `0 0 8px ${palette.glow}`,
            }}
          />
        )}

        {mode === 'disabled' && (
          /* Disabled / Not Allowed Mode */
          <div className="w-full h-full border border-black bg-white/70 flex items-center justify-center">
            <span className="w-full h-0.5 bg-black rotate-45" />
          </div>
        )}

        {mode === 'default' && (
          /* Default Precision Reticle: Minimal 26px square ring with tick marks */
          <div
            className="w-full h-full border-[1.5px] border-black bg-white/30 backdrop-blur-[0.5px] relative transition-transform duration-100"
            style={{
              transform: isMouseDown ? 'scale(0.85)' : 'scale(1)',
              boxShadow: isMouseDown ? `0 0 8px ${palette.glow}` : 'none',
            }}
          >
            {/* Top tick */}
            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-0.5 h-1 bg-black" />
            {/* Bottom tick */}
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-0.5 h-1 bg-black" />
            {/* Left tick */}
            <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-1 h-0.5 bg-black" />
            {/* Right tick */}
            <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-1 h-0.5 bg-black" />
          </div>
        )}
      </div>

      {/* 3. Center Target Dot (Zero Latency Tracking) */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-2 h-2 border border-black will-change-transform"
        style={{
          backgroundColor: palette.id === 'mono' ? '#000000' : palette.hex,
          boxShadow: palette.id === 'mono' ? 'none' : `0 0 6px ${palette.hex}`,
        }}
      />
    </div>
  );
}

/**
 * Header / Floating control to switch cursor color accent or toggle custom/native cursor.
 */
export function CursorToggle({ className }: { className?: string }) {
  const [currentColor, setCurrentColor] = useState<CursorColor>(() => {
    try {
      const saved = localStorage.getItem('bugarena_cursor_color') as CursorColor | null;
      return saved && CURSOR_PALETTES[saved] ? saved : 'lime';
    } catch {
      return 'lime';
    }
  });

  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bugarena_cursor_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.color) setCurrentColor(detail.color);
      if (detail?.enabled !== undefined) setEnabled(detail.enabled);
    };
    window.addEventListener(CURSOR_CHANGE_EVENT, handleCustomChange);
    return () => window.removeEventListener(CURSOR_CHANGE_EVENT, handleCustomChange);
  }, []);

  const handleCycleColor = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        const nextEnabled = !enabled;
        setEnabled(nextEnabled);
        setGlobalCursorEnabled(nextEnabled);
        return;
      }
      const idx = COLOR_KEYS.indexOf(currentColor);
      const nextColor = COLOR_KEYS[(idx + 1) % COLOR_KEYS.length];
      setCurrentColor(nextColor);
      setGlobalCursorColor(nextColor);
    },
    [currentColor, enabled]
  );

  const palette = CURSOR_PALETTES[currentColor];

  return (
    <button
      type="button"
      onClick={handleCycleColor}
      className={`border border-black px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 bg-white text-black hover:bg-black hover:text-white group ${
        className ?? ''
      }`}
      title={`Cursor: ${palette.label} (Click to cycle colors, Shift+Click to toggle Custom/Native)`}
    >
      <span
        className="w-2.5 h-2.5 border border-black inline-block shrink-0 transition-transform group-hover:scale-110"
        style={{
          backgroundColor: enabled ? palette.hex : '#888',
          boxShadow: enabled && palette.id !== 'mono' ? `0 0 5px ${palette.hex}` : 'none',
        }}
      />
      <span className="hidden sm:inline">CURSOR:</span> {enabled ? palette.name.toUpperCase() : 'OFF'}
    </button>
  );
}
