import React, { useState } from 'react';
import { cantonFlagSrc } from './canton-flags.ts';

/**
 * Flag of a Swiss canton, shown next to its 2-letter code so cantons are
 * recognisable at a glance. Small and consistent everywhere (20px by
 * default — pass `size` where the surrounding text is smaller).
 *
 * The flag is a visual aid only: the canton code is always shown next to
 * it, so the image is decorative for screen readers (alt=""). If the flag
 * image fails to load, falls back to a small navy badge with the canton
 * code, so the canton stays identifiable.
 */
export const CantonIcon: React.FC<{ code: string; size?: number }> = ({
  code,
  size = 20,
}) => {
  const [failed, setFailed] = useState(false);
  const upper = (code || '').trim().toUpperCase();
  const src = cantonFlagSrc(upper);

  if (failed || !src) {
    return (
      <span
        aria-hidden="true"
        title={`Canton ${upper}`}
        className="inline-flex shrink-0 items-center justify-center rounded-[4px] bg-[#0B2240] font-mono font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: Math.max(8, Math.round(size * 0.45)),
        }}
      >
        {upper.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-[4px] border border-slate-200/70 object-cover"
      style={{ width: size, height: size }}
    />
  );
};
