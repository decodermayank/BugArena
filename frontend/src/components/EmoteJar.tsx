import { useEffect, useRef, useState, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DoodleBug,
  DoodlePlayer1,
  DoodlePlayer2,
  DoodleSpectatorA,
  DoodleSpectatorB,
  DoodleSpectatorC,
} from './Doodles';
import { soundFx } from '../utils/soundFx';

interface Body {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  img: HTMLImageElement;
}

const GRAVITY = 0.55;
const SPAWN_MS = 380;

function makeImages(): HTMLImageElement[] {
  const nodes = [
    <DoodlePlayer1 key="1" size={96} />,
    <DoodlePlayer2 key="2" size={96} />,
    <DoodleSpectatorA key="3" size={96} />,
    <DoodleSpectatorB key="4" size={96} />,
    <DoodleSpectatorC key="5" size={96} />,
    <DoodleBug key="6" size={96} />,
  ];
  return nodes.map((n) => {
    const svg = renderToStaticMarkup(n).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return img;
  });
}

/**
 * Interactive full-screen physics jar.
 * Doodles fall and pile up, and players can interact with them using the cursor:
 * move cursor through them for gentle stirring/parting, drag and fling them,
 * or shake the jar!
 */
export default function EmoteJar({ floorOffset = 40 }: { floorOffset?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodiesRef = useRef<Body[]>([]);
  const shakeRef = useRef<(() => void) | null>(null);
  const dropRef = useRef<(() => void) | null>(null);
  const clearRef = useRef<(() => void) | null>(null);
  const [hoveringBody, setHoveringBody] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const images = makeImages();
    const bodies = bodiesRef.current;
    let nextId = 1;
    let w = 0;
    let h = 0;
    let raf = 0;
    let lastSpawn = performance.now();

    // Interaction tracking
    let draggedBody: Body | null = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let lastDragX = 0;
    let lastDragY = 0;
    let lastDragTime = 0;
    let dragVx = 0;
    let dragVy = 0;
    let mouseX = -10000;
    let mouseY = -10000;
    let mouseVx = 0;
    let mouseVy = 0;
    let lastMoveTime = performance.now();
    let mouseActive = false;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const maxBodies = () => Math.min(65, Math.max(16, Math.floor(w / 28)));

    const spawn = (x?: number, y?: number, vx?: number, vy?: number) => {
      const r = 20 + Math.random() * 10;
      const posX = x !== undefined ? x : r + Math.random() * Math.max(1, w - 2 * r);
      const posY = y !== undefined ? y : -r;
      bodies.push({
        id: nextId++,
        x: posX,
        y: posY,
        vx: vx !== undefined ? vx : (Math.random() - 0.5) * 2.5,
        vy: vy !== undefined ? vy : 0,
        r,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.12,
        img: images[Math.floor(Math.random() * images.length)],
      });
    };

    // Expose control triggers
    shakeRef.current = () => {
      for (const b of bodies) {
        b.vy = -(14 + Math.random() * 12);
        b.vx = (Math.random() - 0.5) * 22;
        b.vr = (Math.random() - 0.5) * 0.4;
      }
    };

    dropRef.current = () => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => spawn(), i * 80);
      }
    };

    clearRef.current = () => {
      bodies.length = 0;
    };

    // Find body at coordinate
    const findBodyAt = (px: number, py: number): Body | null => {
      for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        const dx = px - b.x;
        const dy = py - b.y;
        if (dx * dx + dy * dy <= (b.r * 1.35) * (b.r * 1.35)) {
          return b;
        }
      }
      return null;
    };

    // Pointer events tracked at window level so interactions work across the viewport
    const onWindowPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const now = performance.now();
      const dt = Math.max(8, Math.min(100, now - lastMoveTime));

      // Calculate instantaneous mouse velocity for dynamic pushing
      const instantVx = ((px - mouseX) / dt) * 16.67;
      const instantVy = ((py - mouseY) / dt) * 16.67;
      mouseVx = mouseVx * 0.35 + instantVx * 0.65;
      mouseVy = mouseVy * 0.35 + instantVy * 0.65;

      mouseX = px;
      mouseY = py;
      lastMoveTime = now;
      mouseActive = true;

      if (draggedBody) {
        draggedBody.x = mouseX + dragOffsetX;
        draggedBody.y = mouseY + dragOffsetY;

        const dragDt = Math.max(1, now - lastDragTime);
        dragVx = ((px - lastDragX) / dragDt) * 16;
        dragVy = ((py - lastDragY) / dragDt) * 16;
        lastDragX = px;
        lastDragY = py;
        lastDragTime = now;
      } else {
        const hovered = findBodyAt(px, py);
        setHoveringBody(Boolean(hovered));
      }
    };

    const onPointerLeave = () => {
      mouseActive = false;
      mouseX = -10000;
      mouseY = -10000;
      mouseVx = 0;
      mouseVy = 0;
      setHoveringBody(false);
    };

    const onWindowPointerDown = (e: PointerEvent) => {
      // Don't intercept clicks inside actual form elements or buttons
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea, a, [role="button"], label')) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const body = findBodyAt(px, py);

      if (body) {
        draggedBody = body;
        dragOffsetX = body.x - px;
        dragOffsetY = body.y - py;
        lastDragX = px;
        lastDragY = py;
        lastDragTime = performance.now();
        dragVx = 0;
        dragVy = 0;
        body.vx = 0;
        body.vy = 0;
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
        soundFx.playEmotePop();
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else if (e.target === canvas || (target && target.tagName === 'MAIN')) {
        // Empty space clicked - fling a new doodle from click point!
        spawn(px, py, (Math.random() - 0.5) * 6, -(6 + Math.random() * 6));
        soundFx.playEmotePop();
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      if (draggedBody) {
        draggedBody.vx = Math.max(-28, Math.min(28, dragVx));
        draggedBody.vy = Math.max(-28, Math.min(28, dragVy));
        draggedBody.vr = (Math.random() - 0.5) * 0.35;
        draggedBody = null;
        setIsDragging(false);
        document.body.style.cursor = '';
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    };

    const onWindowPointerCancel = () => {
      draggedBody = null;
      setIsDragging(false);
      document.body.style.cursor = '';
    };

    // Forward mouse wheel over canvas to main scroll container if needed
    const onWheel = (e: WheelEvent) => {
      const main = document.querySelector('main');
      if (main && e.deltaY) {
        main.scrollBy({ top: e.deltaY, behavior: 'auto' });
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerdown', onWindowPointerDown);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerCancel);
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('wheel', onWheel, { passive: true });

    // Physics step
    const step = (t: number) => {
      const floor = h - floorOffset;

      // 1. Continuous cursor influence: gentle repulsion, momentum transfer & alive wiggle
      if (mouseActive && !draggedBody) {
        const mouseSpeed = Math.hypot(mouseVx, mouseVy);

        for (const b of bodies) {
          const dx = b.x - mouseX;
          const dy = b.y - mouseY;
          const dist = Math.hypot(dx, dy);
          const reach = b.r + 58; // gentle interaction perimeter

          if (dist < reach) {
            const proximity = 1 - dist / reach; // 0 at perimeter to 1 at cursor center
            const nx = dist > 0.001 ? dx / dist : (Math.random() - 0.5) * 2;
            const ny = dist > 0.001 ? dy / dist : -1;

            // Soft radial repellent force: pushes bugs away gently
            const push = Math.pow(proximity, 1.25) * 2.5;

            // If bug is resting near floor and cursor pushes from above,
            // deflect into horizontal slide and give a slight upward hop so it glides smoothly
            if (b.y >= floor - b.r - 14 && ny > 0) {
              const hDir = nx !== 0 ? Math.sign(nx) : (Math.random() > 0.5 ? 1 : -1);
              b.vx += hDir * push * 1.6;
              b.vy -= proximity * 1.5; // slight lift to escape floor friction
            } else {
              b.vx += nx * push;
              b.vy += ny * push;
            }

            // Momentum transfer: moving cursor sweeps / stirs the bugs along
            if (mouseSpeed > 0.25) {
              const transfer = Math.min(mouseSpeed, 22) * 0.34 * proximity;
              b.vx += (mouseVx / mouseSpeed) * transfer;
              b.vy += (mouseVy / mouseSpeed) * transfer;
              b.vr += (nx * mouseVy - ny * mouseVx) * 0.004 * proximity;
            }

            // Lively squirm / breathing wiggle when cursor is close
            const wiggle = Math.sin(t * 0.012 + b.id * 2.1) * 0.3 * proximity;
            b.vx += -ny * wiggle;
            b.vy += nx * wiggle;
            b.vr += wiggle * 0.012;

            // Physical boundary so cursor never gets lost under body
            if (dist < b.r + 14) {
              const overlap = (b.r + 14) - dist;
              b.x += nx * overlap * 0.2;
              b.y += ny * overlap * 0.2;
            }
          }
        }
      }

      // Smooth decay of cursor velocity
      mouseVx *= 0.88;
      mouseVy *= 0.88;

      // 2. Integration and boundary collisions
      for (const b of bodies) {
        if (b === draggedBody) continue; // dragged body follows pointer directly

        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;

        // Air damping
        b.vx *= 0.992;
        b.vr *= 0.985;

        // Wall collisions
        if (b.x < b.r) {
          b.x = b.r;
          b.vx *= -0.45;
        } else if (b.x > w - b.r) {
          b.x = w - b.r;
          b.vx *= -0.45;
        }

        // Floor collision: smooth rolling friction
        if (b.y > floor - b.r) {
          b.y = floor - b.r;
          b.vy *= -0.32;
          if (Math.abs(b.vy) < 0.8) b.vy = 0;
          b.vx *= 0.93; // smooth slide across the floor
          b.vr *= 0.93;
        }

        // Velocity limits to maintain stability
        b.vx = Math.max(-26, Math.min(26, b.vx));
        b.vy = Math.max(-26, Math.min(26, b.vy));
      }

      // 3. Circle-circle collisions
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const c = bodies[j];
            const dx = c.x - a.x;
            const dy = c.y - a.y;
            const min = (a.r + c.r) * 0.94;
            const d2 = dx * dx + dy * dy;

            if (d2 < min * min && d2 > 0.0001) {
              const d = Math.sqrt(d2);
              const nx = dx / d;
              const ny = dy / d;
              const push = (min - d) / 2;

              if (a !== draggedBody) {
                a.x -= nx * push;
                a.y -= ny * push;
              }
              if (c !== draggedBody) {
                c.x += nx * push;
                c.y += ny * push;
              }

              const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
              if (rel < 0) {
                const imp = rel * 0.55;
                if (a !== draggedBody) {
                  a.vx += nx * imp;
                  a.vy += ny * imp;
                }
                if (c !== draggedBody) {
                  c.vx -= nx * imp;
                  c.vy -= ny * imp;
                }
              }

              a.vx *= 0.98;
              c.vx *= 0.98;
            }
          }
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const b of bodies) {
        const isDragged = b === draggedBody;
        const scale = isDragged ? 1.18 : 1.0;
        const s = b.r * 2.2 * scale;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        if (isDragged) {
          ctx.shadowColor = '#00000045';
          ctx.shadowBlur = 16;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 6;
        }
        if (b.img.complete) ctx.drawImage(b.img, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    };

    const loop = (t: number) => {
      if (t - lastSpawn > SPAWN_MS && bodies.length < maxBodies() && !draggedBody) {
        spawn();
        lastSpawn = t;
      }
      step(t);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerdown', onWindowPointerDown);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerCancel);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('wheel', onWheel);
      document.body.style.cursor = '';
    };
  }, [floorOffset]);

  const handleShake = useCallback(() => {
    shakeRef.current?.();
    soundFx.playThump();
  }, []);

  const handleDrop = useCallback(() => {
    dropRef.current?.();
    soundFx.playEmotePop();
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-0 pointer-events-auto ${
          isDragging ? 'touch-none cursor-grabbing' : hoveringBody ? 'touch-none cursor-grab' : 'touch-pan-y cursor-default'
        }`}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 0 }}
        aria-hidden
      />

      {/* Playful Jar Controls Bar */}
      <div
        className="fixed bottom-12 right-3 sm:right-6 z-20 flex items-center gap-1 sm:gap-2 bg-white/95 backdrop-blur-xs border-[1.5px] border-black p-1 text-[11px] font-bold shadow-[2px_2px_0px_#000] pointer-events-auto select-none"
        title="Interactive Doodle Physics"
      >
        <span className="font-hand px-1 text-black/60 hidden sm:inline">physics jar:</span>
        <button
          type="button"
          onClick={handleShake}
          className="btn-paper px-2 py-1 text-[10px] sm:text-[11px] font-bold hover:bg-black hover:text-white transition-colors cursor-pointer"
        >
          🫨 SHAKE
        </button>
        <button
          type="button"
          onClick={handleDrop}
          className="btn-paper px-2 py-1 text-[10px] sm:text-[11px] font-bold hover:bg-black hover:text-white transition-colors cursor-pointer"
        >
          ➕ DROP
        </button>
      </div>
    </>
  );
}
