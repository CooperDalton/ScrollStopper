'use client';

import React from 'react';

export default function AspectRatioPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] appearance-none text-center focus:outline-none ${className || ''}`}
    >
      <option value="9:16">9:16</option>
      <option value="1:1">1:1</option>
      <option value="4:5">4:5</option>
    </select>
  );
}


