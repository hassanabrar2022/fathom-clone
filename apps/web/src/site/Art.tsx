/** Original vector illustrations for the marketing site (space theme). */

const ink = '#0b0b0f';

export function Ship({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 288 134" aria-hidden="true">
      <defs>
        <linearGradient id="ship-flame" x1="1" x2="0">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.45" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#ff3d2e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ship-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe8f2" />
        </linearGradient>
      </defs>
      <path d="M8 74 C40 58 64 60 86 66 L86 86 C62 92 40 92 8 74Z" fill="url(#ship-flame)" />
      <path
        d="M78 60 C120 40 190 34 246 52 C268 59 280 66 282 72 C280 78 268 85 246 92 C190 110 120 104 78 84 Z"
        fill="url(#ship-body)"
        stroke={ink}
        strokeWidth="3"
      />
      <path d="M246 52 C268 59 280 66 282 72 C280 78 268 85 246 92 C252 80 252 64 246 52Z" fill="#1fa6ff" stroke={ink} strokeWidth="3" />
      <path d="M108 50 L84 20 L124 22 L150 44 Z" fill="#ff7a2f" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M108 94 L82 120 L124 118 L152 98 Z" fill="#ff7a2f" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M96 72 L230 72" stroke="#1fa6ff" strokeWidth="6" strokeLinecap="round" />
      <path d="M100 62 L214 56 M100 82 L214 88" stroke={ink} strokeWidth="1.5" opacity="0.45" />
      <circle cx="198" cy="66" r="12" fill="#bfe8ff" stroke={ink} strokeWidth="3" />
      <circle cx="198" cy="66" r="5" fill="#ffffff" opacity="0.9" />
      <circle cx="166" cy="70" r="8" fill="#bfe8ff" stroke={ink} strokeWidth="2.5" />
      <rect x="120" y="64" width="22" height="14" rx="3" fill="#1fa6ff" stroke={ink} strokeWidth="2" />
      <path d="M150 36 L160 26 M164 38 L176 30" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function SwirlPlanet({ className }: { className?: string }) {
  const stripes = Array.from({ length: 14 }, (_, index) => index);
  return (
    <svg className={className} viewBox="0 0 480 480" aria-hidden="true">
      <defs>
        <radialGradient id="swirl-base" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffc2d3" />
          <stop offset="0.55" stopColor="#c45cff" />
          <stop offset="1" stopColor="#6b11d9" />
        </radialGradient>
        <clipPath id="swirl-clip">
          <circle cx="240" cy="240" r="236" />
        </clipPath>
      </defs>
      <circle cx="240" cy="240" r="236" fill="url(#swirl-base)" />
      <g clipPath="url(#swirl-clip)" fill="none" strokeLinecap="round">
        {stripes.map((index) => (
          <path
            key={index}
            d={`M-20 ${40 + index * 32} C 120 ${10 + index * 32}, 300 ${80 + index * 32}, 520 ${30 + index * 32}`}
            stroke={index % 2 ? '#8e1dff' : '#ffb0c8'}
            strokeWidth={index % 3 ? 7 : 12}
            strokeDasharray={index % 2 ? '60 18 22 14' : '90 24 30 20'}
            opacity="0.85"
          />
        ))}
        <ellipse cx="300" cy="330" rx="54" ry="34" stroke="#ffd2de" strokeWidth="6" />
        <ellipse cx="300" cy="330" rx="30" ry="18" stroke="#7a10e8" strokeWidth="5" />
      </g>
      <circle cx="240" cy="240" r="236" fill="none" stroke="#2a0050" strokeOpacity="0.35" strokeWidth="4" />
    </svg>
  );
}

function Glow({ color }: { color: string }) {
  return <ellipse cx="240" cy="380" rx="200" ry="110" fill={color} opacity="0.32" filter="url(#role-blur)" />;
}

function RoleFrame({ children, glow }: { children: React.ReactNode; glow: string }) {
  return (
    <svg viewBox="0 0 480 486" aria-hidden="true" className="role-art">
      <defs>
        <filter id="role-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>
      <Glow color={glow} />
      <g fill="none" stroke="#faf5f5" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}

export const roleArt = {
  rocket: (
    <RoleFrame glow="#ff6a2b">
      <path d="M240 210 C270 240 282 300 270 350 L210 350 C198 300 210 240 240 210Z" fill="#f2efe9" />
      <circle cx="240" cy="280" r="16" fill="#3a8ef0" />
      <path d="M210 330 L182 366 L212 360 Z M270 330 L298 366 L268 360 Z" fill="#ff7a2f" />
      <path d="M222 352 C226 390 254 390 258 352" fill="#ffb347" />
      <path d="M140 420 C170 392 200 396 220 410 C240 392 270 392 290 410 C312 396 338 400 352 420" fill="#c9c1b8" stroke="#faf5f5" />
    </RoleFrame>
  ),
  compass: (
    <RoleFrame glow="#3a8ef0">
      <circle cx="240" cy="330" r="96" fill="#101828" />
      <path d="M240 210 L258 312 L360 330 L258 348 L240 450 L222 348 L120 330 L222 312 Z" fill="#ffb347" />
      <path d="M240 260 L250 322 L240 400 L230 322 Z" fill="#3a8ef0" />
      <circle cx="240" cy="330" r="10" fill="#faf5f5" />
    </RoleFrame>
  ),
  satellite: (
    <RoleFrame glow="#5c7cff">
      <path d="M150 300 C190 230 300 230 340 300 C300 330 190 330 150 300Z" fill="#26324d" />
      <path d="M245 290 L300 220" />
      <circle cx="305" cy="214" r="10" fill="#ff7a2f" />
      <path d="M220 330 L200 430 L290 430 L270 330" fill="#3b4561" />
      <path d="M170 430 L320 430" />
      <path d="M330 170 C350 180 360 196 362 214 M344 152 C374 168 388 192 390 222" stroke="#ffb347" />
    </RoleFrame>
  ),
  users: (
    <RoleFrame glow="#ff4fa1">
      <circle cx="240" cy="290" r="62" fill="#f2efe9" />
      <rect x="198" y="262" width="84" height="52" rx="22" fill="#1e2a44" />
      <path d="M210 278 C224 270 238 270 250 276" stroke="#7fd8ff" />
      <path d="M160 440 C164 380 196 352 240 352 C284 352 316 380 320 440 Z" fill="#e7e2da" />
      <rect x="218" y="384" width="44" height="26" rx="5" fill="#3a8ef0" />
    </RoleFrame>
  ),
} as const;
