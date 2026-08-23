import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className = '', ...props }: InputProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-navy" htmlFor={id}>
      {label}
      <input
        id={id}
        className={`rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-navy placeholder:text-navy/40 focus-visible:border-crew-blue ${className}`}
        {...props}
      />
    </label>
  );
}
