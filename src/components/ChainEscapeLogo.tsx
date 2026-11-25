import React from 'react';

interface ChainEscapeLogoProps {
  compact?: boolean;
}

export const ChainEscapeLogo: React.FC<ChainEscapeLogoProps> = ({ compact = false }) => {
  return (
    <svg
      viewBox="0 0 420 175"
      className={compact ? 'w-36 h-auto select-none' : 'w-64 sm:w-80 h-auto select-none drop-shadow-[0_10px_24px_rgba(0,0,0,0.65)]'}
      aria-label="CHAIN ESCAPE"
    >
      <defs>
        <linearGradient id="stoneGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="45%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="metalChain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>

      {/* Outer dark stone shield */}
      <path
        d="M36 28 L384 28 L402 92 L370 148 L210 166 L50 148 L18 92 Z"
        fill="#1e1b24"
        stroke="#475569"
        strokeWidth="6"
        strokeLinejoin="round"
      />

      {/* Decorative metallic chain links framing the emblem */}
      <g fill="none" stroke="url(#metalChain)" strokeWidth="8">
        <ellipse cx="44" cy="52" rx="18" ry="10" transform="rotate(-28 44 52)" />
        <ellipse cx="26" cy="84" rx="18" ry="10" transform="rotate(-70 26 84)" />
        <ellipse cx="376" cy="52" rx="18" ry="10" transform="rotate(28 376 52)" />
        <ellipse cx="394" cy="84" rx="18" ry="10" transform="rotate(70 394 84)" />
      </g>

      {/* CHAIN */}
      <text
        x="210"
        y="78"
        textAnchor="middle"
        fill="url(#stoneGrad)"
        stroke="#0f172a"
        strokeWidth="7"
        paintOrder="stroke"
        fontFamily="Outfit, Cairo, sans-serif"
        fontWeight="900"
        fontSize="56"
        letterSpacing="4"
      >
        CHAIN
      </text>

      {/* Center golden interlocking link */}
      <g fill="none" stroke="url(#goldGrad)" strokeWidth="6">
        <rect x="176" y="81" width="68" height="18" rx="9" />
      </g>

      {/* ESCAPE */}
      <text
        x="210"
        y="144"
        textAnchor="middle"
        fill="url(#goldGrad)"
        stroke="#451a03"
        strokeWidth="8"
        paintOrder="stroke"
        fontFamily="Outfit, Cairo, sans-serif"
        fontWeight="900"
        fontSize="52"
        letterSpacing="3"
      >
        ESCAPE
      </text>
    </svg>
  );
};
