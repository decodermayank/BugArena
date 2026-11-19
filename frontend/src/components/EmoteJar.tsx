import { useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DoodleBug,
  DoodlePlayer1,
  DoodlePlayer2,
  DoodleSpectatorA,
  DoodleSpectatorB,
  DoodleSpectatorC,
} from './Doodles';

interface Body {
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
const SPAWN_MS = 350;

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
 * Full-screen canvas behind the page. Doodle emotes fall from the top and pile up
 * on a floor just above the footer bar. pointer-events:none so it never blocks the UI.
 */
export default function EmoteJar({ floorOffset = 40 }: { floorOffset?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const images = makeImages();
    const bodies: Body[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let lastSpawn = 0;

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

    const maxBodies = () => Math.min(70, Math.max(14, Math.floor(w / 26)));

    const spawn = () => {
      const r = 22 + Math.random() * 10;
      bodies.push({
        x: r + Math.random() * Math.max(1, w - 2 * r),
        y: -r,
        vx: (Math.random() - 0.5) * 2,
        vy: 0,
        r,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.12,
        img: images[Math.floor(Math.random() * images.length)],
      });
    };

    const step = () => {
      const floor = h - floorOffset;
      for (const b of bodies) {
        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        if (b.x < b.r) {
          b.x = b.r;
          b.vx *= -0.4;
        } else if (b.x > w - b.r) {
          b.x = w - b.r;
          b.vx *= -0.4;
        }
        if (b.y > floor - b.r) {
          b.y = floor - b.r;
          b.vy *= -0.3;
          if (Math.abs(b.vy) < 1) b.vy = 0;
          b.vx *= 0.85;
          b.vr *= 0.85;
        }
      }
      // circle-circle collisions
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const c = bodies[j];
            const dx = c.x - a.x;
            const dy = c.y - a.y;
            const min = (a.r + c.r) * 0.92;
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
                const imp = rel * 0.5;
                a.vx += nx * imp;
                a.vy += ny * imp;
                c.vx -= nx * imp;
                c.vy -= ny * imp;
              }
              // friction so piles settle
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
        if (b.img.complete) ctx.drawImage(b.img, -s / 2, -s / 2, s, s);
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

  return <canvas ref={ref} className="fixed inset-0 z-0 pointer-events-none" style={{ position: 'fixed', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }} aria-hidden />;
}
