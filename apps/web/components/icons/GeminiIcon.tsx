'use client';

type Props = {
  className?: string;
};

export function GeminiIcon({ className = "size-5" }: Props): JSX.Element {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gemini-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
        <linearGradient id="gemini-b" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="32" r="18" fill="url(#gemini-a)" opacity="0.9" />
      <circle cx="40" cy="32" r="18" fill="url(#gemini-b)" opacity="0.85" />
    </svg>
  );
}
