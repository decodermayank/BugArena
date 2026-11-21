import { useEffect, useRef, useCallback } from 'react';
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
const SPAWN_MS = 400;

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
 * Ambient background physics jar.
 * Doodles fall and pile up with realistic physics without intercepting
 * or distracting cursor movements, clicks, or text selections.
 */
export default function EmoteJar({ floorOffset = 40 }: { floorOffset?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodiesRef = useRef<Body[]>([]);
  const shakeRef = useRef<(() => void) | null>(null);
  const dropRef = useRef<(() => void) | null>(null);

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

    const maxBodies = () => Math.min(50, Math.max(14, Math.floor(w / 32)));

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

    // Physics step: realistic gravity, boundaries & collisions without cursor distraction
    const step = () => {
      const floor = h - floorOffset;

      // 1. Integration and boundary collisions
      for (const b of bodies) {
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

      // 2. Circle-circle collisions
      for (let pass = 0; pass < 2; pass++) {
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

              a.x -= nx * push;
              a.y -= ny * push;
              c.x += nx * push;
              c.y += ny * push;

              const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
              if (rel < 0) {
                const imp = rel * 0.55;
                a.vx += nx * imp;
                a.vy += ny * imp;
                c.vx -= nx * imp;
                c.vy -= ny * imp;
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
        const s = b.r * 2.2;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        if (b.img.complete) {
          ctx.drawImage(b.img, -s / 2, -s / 2, s, s);
        }
        ctx.restore();
      }
    };

    const loop = (t: number) => {
      if (t - lastSpawn > SPAWN_MS && bodies.length < maxBodies()) {
        spawn();
        lastSpawn = t;
      }
      step();
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
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
      {/* Background Physics Canvas - non-blocking and zero cursor interference */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 0 }}
        aria-hidden="true"
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
