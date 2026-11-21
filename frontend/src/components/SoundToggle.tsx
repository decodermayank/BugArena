import { useState } from 'react';
import { soundFx } from '../utils/soundFx';

export default function SoundToggle({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState(soundFx.isEnabled());

  const handleToggle = () => {
    const next = soundFx.toggle();
    setEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`border border-black px-2 py-1 text-xs font-bold transition-colors cursor-pointer select-none inline-flex items-center gap-1 shrink-0 ${
        enabled ? 'bg-white text-black hover:bg-black hover:text-white' : 'bg-black text-white hover:bg-white hover:text-black'
      } ${className ?? ''}`}
      title={enabled ? 'Mute Sound FX' : 'Enable Sound FX'}
    >
      <span className="text-xs leading-none">{enabled ? '🔊' : '🔇'}</span>
      <span className="hidden sm:inline text-[11px] font-mono leading-none">
        SFX: {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
