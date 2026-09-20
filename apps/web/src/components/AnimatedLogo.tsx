import { useState } from 'react';

export interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'default' | 'inverted' | 'hero';
  withText?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 36, icon: 22, text: 'text-xl' },
  md: { box: 44, icon: 28, text: 'text-2xl' },
  lg: { box: 60, icon: 38, text: 'text-3xl' },
  xl: { box: 84, icon: 54, text: 'text-4xl' },
  '2xl': { box: 120, icon: 76, text: 'text-5xl' },
};

export function AnimatedLogo({
  size = 'md',
  variant = 'default',
  withText = false,
  className = '',
}: AnimatedLogoProps) {
  const [isHovered, setIsHovered] = useState(false);
  const s = SIZE_MAP[size];

  // Color theming
  const isDark = variant === 'inverted';
  const isHero = variant === 'hero';

  const containerBg = isHero
    ? 'bg-positivus-green border-2 border-positivus-dark shadow-positivus'
    : isDark
      ? 'bg-positivus-green text-positivus-dark border-2 border-positivus-green shadow-[0px_4px_0px_#B9FF66]'
      : 'bg-positivus-dark text-positivus-green border-2 border-positivus-dark shadow-positivus-sm';

  return (
    <div
      className={`inline-flex items-center gap-3 select-none cursor-pointer group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated SVG Emblem */}
      <div
        className={`relative rounded-2xl flex items-center justify-center transition-all duration-300 ${containerBg} ${
          isHovered ? 'scale-105 shadow-positivus' : ''
        }`}
        style={{ width: s.box, height: s.box }}
      >
        {/* SVG Graphic Layers */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full p-1.5 overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Layer 1: Outer Rotating Positivus 4-Point Vertex Star */}
          <g
            className={`origin-center ${
              isHovered ? 'animate-vertex-spin-fast' : 'animate-vertex-spin'
            }`}
          >
            {/* 4 Star Petals */}
            <path
              d="M 50,6 Q 50,40 84,40 Q 50,40 50,74 Q 50,40 16,40 Q 50,40 50,6 Z"
              fill={isDark || isHero ? '#191A23' : '#B9FF66'}
              stroke="#191A23"
              strokeWidth="2.5"
              strokeLinejoin="round"
              opacity="0.9"
            />
            {/* 4 Orbiting Corner Spark Nodes */}
            <circle cx="50" cy="8" r="3.5" fill="#191A23" stroke="#B9FF66" strokeWidth="1.5" />
            <circle cx="84" cy="40" r="3.5" fill="#191A23" stroke="#B9FF66" strokeWidth="1.5" />
            <circle cx="50" cy="72" r="3.5" fill="#191A23" stroke="#B9FF66" strokeWidth="1.5" />
            <circle cx="16" cy="40" r="3.5" fill="#191A23" stroke="#B9FF66" strokeWidth="1.5" />
          </g>

          {/* Layer 2: Counter-Rotating Secondary Compass Grid */}
          <g className="origin-center animate-vertex-spin-reverse opacity-70">
            <circle
              cx="50"
              cy="40"
              r="28"
              stroke={isDark || isHero ? '#191A23' : '#B9FF66'}
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
            <circle cx="28" cy="22" r="2.5" fill={isDark || isHero ? '#191A23' : '#B9FF66'} />
            <circle cx="72" cy="58" r="2.5" fill={isDark || isHero ? '#191A23' : '#B9FF66'} />
          </g>

          {/* Layer 3: Central Guardian Shield Armor */}
          <g className="origin-center animate-vertex-pulse">
            {/* Hexagonal Shield Background */}
            <path
              d="M 50,18 L 72,28 L 72,50 Q 72,68 50,78 Q 28,68 28,50 L 28,28 Z"
              fill={isDark || isHero ? '#B9FF66' : '#191A23'}
              stroke="#191A23"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* Inner Shield Bevel Accent */}
            <path
              d="M 50,24 L 66,32 L 66,48 Q 66,62 50,70 Q 34,62 34,48 L 34,32 Z"
              fill={isDark || isHero ? '#191A23' : '#B9FF66'}
              opacity="0.25"
            />

            {/* Verification Checkmark / Data Vertex Core */}
            <path
              d="M 40,48 L 47,55 L 61,38"
              stroke={isDark || isHero ? '#191A23' : '#B9FF66'}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isHovered ? 'animate-vertex-glow' : ''}
            />
          </g>

          {/* Layer 4: Scanning Radar Beam Effect */}
          <g className="origin-center animate-vertex-beam opacity-40 mix-blend-overlay">
            <line
              x1="50"
              y1="40"
              x2="78"
              y2="18"
              stroke={isDark || isHero ? '#191A23' : '#B9FF66'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </svg>

        {/* Outer Live Status Pulse Dot */}
        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positivus-green opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-positivus-green border-2 border-positivus-dark" />
        </span>
      </div>

      {/* Optional Brand Wordmark */}
      {withText && (
        <div className="flex flex-col">
          <div className={`font-bold tracking-tight leading-none ${s.text} ${isDark ? 'text-white' : 'text-positivus-dark'}`}>
            Vertex<span className={isDark ? 'text-positivus-green' : 'text-zinc-600'}>Guard</span>
          </div>
          <div className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            <span>Positivus Data Shield</span>
            <span className="w-1.5 h-1.5 rounded-full bg-positivus-green inline-block" />
          </div>
        </div>
      )}
    </div>
  );
}
