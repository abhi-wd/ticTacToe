import React from 'react';

interface WinLineProps {
  cells: number[]
}

const col = (i: number) => (i % 3) * 33.33 + 16.67
const row = (i: number) => Math.floor(i / 3) * 33.33 + 16.67

export default function WinLine({ cells }: WinLineProps) {
  if (cells.length !== 3) return null

  const [a, , c] = cells
  const x1 = col(a)
  const y1 = row(a)
  const x2 = col(c)
  const y2 = row(c)

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        stroke="#ffd700"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{
          animation: 'draw-line 400ms ease forwards 100ms',
        }}
      />
      <style>{`
        @keyframes draw-line {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  )
}
