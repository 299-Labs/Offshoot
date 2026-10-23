import React from 'react';

export function Logo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Offshoot logo"
    >
      <g transform="translate(50 50) scale(1.15) translate(-62.8 -52.2)">
        <g fill="none" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 88V58" stroke="#B2675E" />
          <path d="M40 58V22" stroke="#B2675E" />
          <path d="M40 58C40 44 52 38 66 36" stroke="#B2675E" />
        </g>
        <g fill="#506c64">
          <path d="M66 36C59.6 31.2 59.6 20 66 13.6C72.4 20 72.4 31.2 66 36Z" />
          <path d="M66 36C67.6 26.4 77.2 23.2 88.4 26.4C86.8 36 77.2 39.2 66 36Z" />
        </g>
      </g>
    </svg>
  );
}