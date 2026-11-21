import type { CSSProperties, ReactElement } from 'react';

interface DoodleProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const base = {
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: '#000',
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Tiny ink bug for the logo. */
export function DoodleBug({ size = 28, className, style }: DoodleProps) {
  return (
    <svg {...base} width={size} height={size} className={className} style={style} aria-hidden>
      <ellipse cx="32" cy="38" rx="13" ry="16" fill="#FAFAFA" />
      <circle cx="32" cy="18" r="7" fill="#FAFAFA" />
      <path d="M32 24v28M19 32h26" />
      <path d="M20 30l-9-7M44 30l9-7M19 42l-10 2M45 42l10 2M22 52l-7 7M42 52l7 7" />
      <path d="M28 11l-5-7M36 11l5-7" />
      <circle cx="29.5" cy="17" r="1.2" fill="#000" />
      <circle cx="34.5" cy="17" r="1.2" fill="#000" />
    </svg>
  );
}

/** Player 1: spiky hair, grin, glasses. */
export function DoodlePlayer1({ size = 56, className, style }: DoodleProps) {
  return (
    <svg {...base} width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="32" cy="34" r="19" fill="#FAFAFA" />
      <path d="M16 24l4-12 6 8 6-12 6 12 6-8 4 12" />
      <rect x="19" y="30" width="11" height="8" fill="#FAFAFA" />
      <rect x="34" y="30" width="11" height="8" fill="#FAFAFA" />
      <path d="M30 34h4" />
      <circle cx="24.5" cy="34" r="1.3" fill="#000" />
      <circle cx="39.5" cy="34" r="1.3" fill="#000" />
      <path d="M23 46q9 7 18 0" />
    </svg>
  );
}

/** Player 2: bob cut, determined mouth, sweat drop. */
export function DoodlePlayer2({ size = 56, className, style }: DoodleProps) {
  return (
    <svg {...base} width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="32" cy="34" r="19" fill="#FAFAFA" />
      <path d="M13 36c-2-18 8-26 19-26s21 8 19 26" />
      <path d="M18 24q14-3 28 0" />
      <path d="M22 33l7 2M42 33l-7 2" />
      <circle cx="26" cy="38" r="1.4" fill="#000" />
      <circle cx="38" cy="38" r="1.4" fill="#000" />
      <path d="M26 48h12" />
      <path d="M52 20q3 4 0 7q-3-3 0-7z" fill="#000" />
    </svg>
  );
}

/** Spectator: cheering, mouth open. */
export function DoodleSpectatorA({ size = 40, className, style }: DoodleProps) {
  return (
    <svg {...base} width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="32" cy="36" r="16" fill="#FAFAFA" />
      <path d="M26 33v2M38 33v2" />
      <ellipse cx="32" cy="44" rx="5" ry="4" fill="#000" />
      <path d="M12 26l-4-12M52 26l4-12" />
    </svg>
  );
}

/** Spectator: beanie hat, smile. */
export function DoodleSpectatorB({ size = 40, className, style }: DoodleProps) {
  return (
    <svg {...base} width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="32" cy="38" r="15" fill="#FAFAFA" />
      <path d="M17 30q15-20 30 0z" fill="#000" />
      <circle cx="32" cy="14" r="3" fill="#FAFAFA" />
      <circle cx="26" cy="38" r="1.3" fill="#000" />
      <circle cx="38" cy="38" r="1.3" fill="#000" />
      <path d="M26 45q6 5 12 0" />
    </svg>
  );
}

/** Spectator: round face with antenna curl, tongue out. */
export function DoodleSpectatorC({ size = 40, className, style }: DoodleProps) {
  return (
    <svg {...base} width={size} height={size} className={className} style={style} aria-hidden>
      <circle cx="32" cy="38" r="15" fill="#FAFAFA" />
      <path d="M32 23q-2-10 6-9q4 1 2 5" />
      <path d="M24 35l4 2-4 2M40 35l-4 2 4 2" />
      <path d="M25 45h14" />
      <path d="M33 45v5q0 3 3 0v-5" fill="#FAFAFA" />
    </svg>
  );
}

export const CROWD = [DoodleSpectatorA, DoodleSpectatorB, DoodleSpectatorC];

export type AvatarPresetId = 'hacker' | 'hunter' | 'script' | 'speed' | 'glitch';

export interface AvatarPreset {
  id: AvatarPresetId;
  name: string;
  tag: string;
  Component: (props: DoodleProps) => ReactElement;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'hacker', name: 'The Hacker', tag: '👓', Component: DoodlePlayer1 },
  { id: 'hunter', name: 'Bug Hunter', tag: '🐛', Component: DoodleBug },
  { id: 'script', name: 'Script Kid', tag: '🧢', Component: DoodleSpectatorB },
  { id: 'speed', name: 'Speedrunner', tag: '⚡', Component: DoodlePlayer2 },
  { id: 'glitch', name: 'Bot / Glitch', tag: '🤖', Component: DoodleSpectatorC },
];

export function AvatarIcon({
  id,
  size = 40,
  className,
}: {
  id: AvatarPresetId | string;
  size?: number;
  className?: string;
}) {
  const match = AVATAR_PRESETS.find((a) => a.id === id) || AVATAR_PRESETS[0];
  const Comp = match.Component;
  return <Comp size={size} className={className} />;
}

/** A row of N monochrome spectator faces. */
export function Crowd({ count, size = 40, className }: { count: number; size?: number; className?: string }) {
  return (
    <div className={`flex items-end ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => {
        const Face = CROWD[i % CROWD.length];
        return <Face key={i} size={size} style={{ marginLeft: i === 0 ? 0 : -size * 0.12 }} />;
      })}
    </div>
  );
}

/** Hand-drawn ink arrow. Points right by default. */
export function InkArrow({
  width = 110,
  className,
  style,
}: {
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 50"
      width={width}
      height={(width * 50) / 120}
      fill="none"
      stroke="#000"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d="M4 30C22 8 44 40 64 24S92 18 112 26" />
      <path d="M96 10l16 16-18 12" />
    </svg>
  );
}
