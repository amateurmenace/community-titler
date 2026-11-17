import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';

/**
 * A labelled range slider with a number box beside it: drag for the rough
 * value, type or spin the box for the exact one. The arrow keys move a slider
 * by one step and Shift + arrow by ten. `scale` maps the stored value to the
 * number shown (100 shows a 0.85 multiplier as 85 %).
 */
export function Slider(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** shown after the number box, e.g. '%' or 'px' */
  unit?: string;
  /** shown = stored × scale */
  scale?: number;
  /** digits shown after the point */
  decimals?: number;
}) {
  const { label, value, onChange, min, max, step = 1, unit = '', scale = 1, decimals = 0 } = props;
  const snap = (v: number) => Math.round(v / step) * step;
  const shown = snap(value * scale);
  const fmt = (v: number) => v.toFixed(decimals);
  const [text, setText] = useState(fmt(shown));
  const [editing, setEditing] = useState(false);
  // while the box is being typed in, it keeps what was typed
  useEffect(() => { if (!editing) setText(fmt(shown)); }, [shown, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  /** clamps, snaps to the step, stores; returns what was stored (as shown) */
  const commit = (v: number): number | undefined => {
    if (!Number.isFinite(v)) return undefined;
    const c = snap(Math.min(max, Math.max(min, v)));
    onChange(+(c / scale).toFixed(6));
    return c;
  };
  const nudge = (e: KeyboardEvent<HTMLInputElement>, keys: string[]) => {
    if (!e.shiftKey) return;
    const dir = e.key === keys[0] ? 1 : (e.key === keys[1] ? -1 : 0);
    if (!dir) return;
    e.preventDefault();
    const c = commit(shown + dir * step * 10);
    if (c !== undefined) setText(fmt(c));
  };

  return (
    <div className="fld">
      <span className="fldlabel">
        {label}
        <span className="num">
          <input
            type="number" min={min} max={max} step={step} value={text} aria-label={label}
            onFocus={() => setEditing(true)}
            onBlur={() => { setEditing(false); const c = commit(parseFloat(text)); setText(fmt(c ?? shown)); }}
            onChange={(e) => {
              setText(e.target.value);
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v >= min && v <= max) commit(v);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else nudge(e, ['ArrowUp', 'ArrowDown']); }}
          />
          {unit && <span className="unit">{unit}</span>}
        </span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={shown} aria-label={label}
        onChange={(e) => commit(+e.target.value)}
        onKeyDown={(e) => { nudge(e, ['ArrowUp', 'ArrowDown']); nudge(e, ['ArrowRight', 'ArrowLeft']); }}
      />
    </div>
  );
}
