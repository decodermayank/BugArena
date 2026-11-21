import { useRef, useEffect } from 'react';

interface ArcadeCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function ArcadeCodeInput({ value, onChange, disabled }: ArcadeCodeInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Pad or trim value to 6 characters uppercase
  const chars = Array.from({ length: 6 }).map((_, i) => value[i] || '');

  const handleChange = (index: number, char: string) => {
    const clean = char.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return;

    const nextChars = [...chars];
    nextChars[index] = clean.slice(-1); // Take latest typed char
    const nextVal = nextChars.join('').trimEnd();
    onChange(nextVal);

    // Auto-advance to next input
    if (index < 5) {
      inputsRef.current[index + 1]?.focus();
      inputsRef.current[index + 1]?.select();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!chars[index] && index > 0) {
        // Current slot is empty, move back and clear previous
        const nextChars = [...chars];
        nextChars[index - 1] = '';
        onChange(nextChars.join('').trimEnd());
        inputsRef.current[index - 1]?.focus();
      } else {
        const nextChars = [...chars];
        nextChars[index] = '';
        onChange(nextChars.join('').trimEnd());
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
      inputsRef.current[index - 1]?.select();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
      inputsRef.current[index + 1]?.select();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (!paste) return;
    onChange(paste);
    const targetIdx = Math.min(paste.length, 5);
    inputsRef.current[targetIdx]?.focus();
  };

  const handleQuickPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const paste = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (paste) {
        onChange(paste);
        const targetIdx = Math.min(paste.length, 5);
        inputsRef.current[targetIdx]?.focus();
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-hand text-xs sm:text-sm">ROOM CODE (6 CHARS)</span>
        <div className="flex items-center gap-2">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                inputsRef.current[0]?.focus();
              }}
              className="font-hand text-[11px] text-black/60 hover:text-black cursor-pointer underline decoration-dotted"
            >
              clear
            </button>
          )}
          <button
            type="button"
            onClick={handleQuickPaste}
            className="font-hand text-[11px] text-black/75 hover:text-black cursor-pointer flex items-center gap-1 underline decoration-dotted"
          >
            📋 paste
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 sm:gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const char = chars[i];
          const isFilled = Boolean(char);

          return (
            <div key={i} className="relative aspect-square sm:aspect-auto sm:h-12 min-w-0">
              <input
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                maxLength={1}
                value={char}
                disabled={disabled}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                className={`w-full h-full min-w-0 text-center font-heading font-extrabold text-lg sm:text-2xl uppercase transition-all duration-100 select-all ${
                  isFilled
                    ? 'border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000]'
                    : 'border-2 border-black/40 bg-white/70 text-black/30 focus:border-black focus:border-2 focus:bg-white focus:text-black focus:shadow-[2px_2px_0px_#000]'
                }`}
                placeholder="·"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
