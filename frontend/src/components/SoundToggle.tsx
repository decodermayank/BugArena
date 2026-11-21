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
      className={`border border-black px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer select-none ${
        enabled ? 'bg-white text-black hover:bg-black hover:text-white' : 'bg-black text-white hover:bg-white hover:text-black'
      } ${className ?? ''}`}
      title={enabled ? 'Mute Sound FX' : 'Enable Sound FX'}
    >
      {enabled ? '🔊 SFX: ON' : '🔇 SFX: OFF'}
    </button>
  );
}
