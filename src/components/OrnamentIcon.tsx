import type { OrnamentId } from '../types/card';

export function OrnamentIcon({ id }: { id: OrnamentId }) {
  switch (id) {
    case 'espresso-martini':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path d="M8 10h20l-10 11z" fill="#e6b889" stroke="#5b3421" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.5 11.5h17l-8.5 8.5z" fill="#5b3421" />
          <ellipse cx="18" cy="11.2" rx="8.5" ry="2.2" fill="#edd1ab" stroke="#d4a030" strokeWidth="1.2" />
          <circle cx="15.5" cy="11" r="1.1" fill="#3b2013" />
          <circle cx="18" cy="11.8" r="1.1" fill="#3b2013" />
          <circle cx="20.5" cy="11" r="1.1" fill="#3b2013" />
          <path d="M18 21v9M13 30h10" stroke="#7c98ad" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'kirby':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <ellipse cx="12.5" cy="29" rx="4.5" ry="2.6" fill="#d1325b" />
          <ellipse cx="23.5" cy="29" rx="4.5" ry="2.6" fill="#d1325b" />
          <circle cx="8" cy="18.5" r="3.4" fill="#ff9ac0" />
          <circle cx="28" cy="18.5" r="3.4" fill="#ff9ac0" />
          <circle cx="18" cy="18.5" r="10" fill="#ff9ec2" stroke="#e26e9b" strokeWidth="1.2" />
          <ellipse cx="15" cy="16.5" rx="1.3" ry="2.4" fill="#1e243b" />
          <ellipse cx="21" cy="16.5" rx="1.3" ry="2.4" fill="#1e243b" />
          <circle cx="15" cy="15.3" r="0.6" fill="#fff" />
          <circle cx="21" cy="15.3" r="0.6" fill="#fff" />
          <ellipse cx="12" cy="19.5" rx="1.8" ry="1.1" fill="#ff5e92" />
          <ellipse cx="24" cy="19.5" rx="1.8" ry="1.1" fill="#ff5e92" />
          <circle cx="18" cy="20.5" r="1.3" fill="#b8244b" />
        </svg>
      );
    case 'rubber-duck':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <ellipse cx="18" cy="25" rx="9" ry="6.2" fill="#ffe047" stroke="#dba123" strokeWidth="1.2" />
          <circle cx="17" cy="15.5" r="6" fill="#ffe047" stroke="#dba123" strokeWidth="1.2" />
          <path d="M13 10.5l5-5 4 5z" fill="#d4333d" />
          <rect x="12" y="10" width="11" height="2.4" rx="1.2" fill="#ffffff" />
          <circle cx="18.5" cy="5.5" r="1.6" fill="#ffffff" />
          <ellipse cx="23.5" cy="16.8" rx="4" ry="2" fill="#ff8630" />
          <circle cx="19" cy="14.5" r="1.1" fill="#23283a" />
        </svg>
      );
    case 'cinnamoroll':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <ellipse cx="7.5" cy="20" rx="5.5" ry="2.8" transform="rotate(-24 7.5 20)" fill="#fffdf8" stroke="#cfc8df" strokeWidth="1.2" />
          <ellipse cx="28.5" cy="20" rx="5.5" ry="2.8" transform="rotate(24 28.5 20)" fill="#fffdf8" stroke="#cfc8df" strokeWidth="1.2" />
          <ellipse cx="18" cy="17.5" rx="8.2" ry="6.4" fill="#fffdf8" stroke="#cfc8df" strokeWidth="1.2" />
          <ellipse cx="18" cy="26.5" rx="5.5" ry="4.5" fill="#fffdf8" stroke="#cfc8df" strokeWidth="1.2" />
          <ellipse cx="14.5" cy="17" rx="1.2" ry="1.6" fill="#59a4e6" />
          <ellipse cx="21.5" cy="17" rx="1.2" ry="1.6" fill="#59a4e6" />
          <ellipse cx="12" cy="19" rx="1.6" ry="1" fill="#ffb0ca" />
          <ellipse cx="24" cy="19" rx="1.6" ry="1" fill="#ffb0ca" />
          <path d="M21 9.5l3 1.8-3 1.8zM27 9.5l-3 1.8 3 1.8z" fill="#d4333d" />
        </svg>
      );
    case 'lord-farquaad':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path d="M10 31l2.5-9h11l2.5 9z" fill="#cf2935" stroke="#981d28" strokeWidth="1.2" />
          <rect x="16.5" y="22" width="3" height="9" fill="#f0c34a" />
          <path d="M10.5 21.5L12 10.5h12l1.5 11-2-.5v-6H12.5v6z" fill="#2a2733" />
          <rect x="13" y="13" width="10" height="9" rx="2" fill="#f9ceb4" />
          <path d="M12.5 10.5h11v2.8h-11z" fill="#2a2733" />
          <path d="M14 10l1.5-3 2.5 2 2.5-2L22 10z" fill="#f2c854" />
          <circle cx="16" cy="16.5" r="0.9" fill="#222" />
          <circle cx="20" cy="16.5" r="0.9" fill="#222" />
        </svg>
      );
    case 'french-fries':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <rect x="11" y="9.5" width="2.4" height="10" rx="0.8" transform="rotate(-10 11 9.5)" fill="#ffe05c" stroke="#d99f26" strokeWidth="0.7" />
          <rect x="14.5" y="8" width="2.5" height="11" rx="0.8" fill="#ffe05c" stroke="#d99f26" strokeWidth="0.7" />
          <rect x="18" y="7.5" width="2.5" height="11.5" rx="0.8" fill="#ffd247" stroke="#d99f26" strokeWidth="0.7" />
          <rect x="21.5" y="8.5" width="2.4" height="10.5" rx="0.8" transform="rotate(8 21.5 8.5)" fill="#ffe05c" stroke="#d99f26" strokeWidth="0.7" />
          <path d="M10 16.5h16l-2.2 14H12.2z" fill="#d8323c" stroke="#9e1f2a" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M13 21.5q5 3.5 10 0" fill="none" stroke="#f2c854" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'kiwi':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="20" r="10.8" fill="#8c623d" />
          <circle cx="18" cy="20" r="9.2" fill="#82dc48" />
          <circle cx="18" cy="20" r="3.4" fill="#eef8bd" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle
                key={deg}
                cx={18 + Math.cos(rad) * 5.4}
                cy={20 + Math.sin(rad) * 5.4}
                r="0.9"
                fill="#2b2521"
              />
            );
          })}
        </svg>
      );
    case 'empanada':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path
            d="M6.5 17.5a11.5 11.5 0 0 0 23 0z"
            fill="#ebb054"
            stroke="#c27a2c"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 19.5c2 5.5 7 8.5 10.5 8.5s8.5-3 10.5-8.5"
            fill="none"
            stroke="#d48932"
            strokeWidth="2.4"
            strokeDasharray="2.5 2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'volleyball':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="20" r="10.2" fill="#faf7f0" stroke="#c8bfb2" strokeWidth="1.2" />
          <path d="M8.5 17q9.5-5 19 0" fill="none" stroke="#d4333d" strokeWidth="2.6" />
          <path d="M12 28q5-8 13-15" fill="none" stroke="#2d8052" strokeWidth="2.6" />
          <path d="M11 12q7 8 13 16" fill="none" stroke="#ebb942" strokeWidth="2.4" />
        </svg>
      );
    case 'cat':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path d="M10.5 14l2-6 4.5 4.2h2L23.5 8l2 6z" fill="#f6ad66" />
          <circle cx="18" cy="17.5" r="6.8" fill="#f6ad66" />
          <ellipse cx="18" cy="26.5" rx="6.2" ry="5" fill="#f6ad66" />
          <rect x="13" y="21.5" width="10" height="2" rx="1" fill="#d4333d" />
          <circle cx="18" cy="23.2" r="1.4" fill="#f2c854" />
          <circle cx="15.5" cy="16.5" r="1" fill="#23283a" />
          <circle cx="20.5" cy="16.5" r="1" fill="#23283a" />
          <polygon points="18,18 16.8,19.4 19.2,19.4" fill="#ff84a3" />
        </svg>
      );
    case 'dog':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <ellipse cx="10.5" cy="17.5" rx="2.8" ry="5.5" transform="rotate(14 10.5 17.5)" fill="#a86e3e" />
          <ellipse cx="25.5" cy="17.5" rx="2.8" ry="5.5" transform="rotate(-14 25.5 17.5)" fill="#a86e3e" />
          <circle cx="18" cy="17" r="6.8" fill="#ecc078" />
          <ellipse cx="18" cy="26.5" rx="6.2" ry="5" fill="#ecc078" />
          <rect x="12.5" y="21.5" width="11" height="2.4" rx="1.2" fill="#2d8254" />
          <ellipse cx="18" cy="18.6" rx="3.2" ry="2.2" fill="#fff6e6" />
          <circle cx="18" cy="17.8" r="1.2" fill="#2a2220" />
          <circle cx="15.5" cy="15.5" r="1" fill="#23283a" />
          <circle cx="20.5" cy="15.5" r="1" fill="#23283a" />
        </svg>
      );
    case 'wallet':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <rect x="9" y="10.5" width="14" height="8" rx="1" fill="#4ea868" transform="rotate(-6 9 10.5)" />
          <rect x="17" y="11" width="10" height="7" rx="1" fill="#63b4e8" transform="rotate(6 17 11)" />
          <rect x="7" y="14.5" width="22" height="15" rx="3" fill="#9c5f3c" stroke="#693c24" strokeWidth="1.3" />
          <rect x="9.5" y="17" width="17" height="10" rx="1.5" fill="none" stroke="#f2c854" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      );
    case 'laptop':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <rect x="8.5" y="10" width="19" height="12.5" rx="1.6" fill="#dce4ed" stroke="#8fa1b5" strokeWidth="1.2" />
          <rect x="10.5" y="11.8" width="15" height="9" rx="0.8" fill="#6ec4d9" />
          <polygon points="18,13 15.2,19 20.8,19" fill="#257d4e" />
          <polygon points="6.5,23.5 29.5,23.5 31.5,28.5 4.5,28.5" fill="#cfd9e3" stroke="#8fa1b5" strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="10" y="25" width="16" height="2" rx="0.5" fill="#343e4f" />
        </svg>
      );
    case 'daisy':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <ellipse
              key={deg}
              cx="18"
              cy="12.5"
              rx="2.6"
              ry="5.5"
              fill="#fffef9"
              stroke="#cfd7e3"
              strokeWidth="0.9"
              transform={`rotate(${deg} 18 20)`}
            />
          ))}
          <circle cx="18" cy="20" r="4.6" fill="#ffd242" stroke="#d99a22" strokeWidth="1" />
        </svg>
      );
    case 'hamster':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="11.5" cy="12.5" r="2.8" fill="#ebb075" />
          <circle cx="24.5" cy="12.5" r="2.8" fill="#ebb075" />
          <ellipse cx="18" cy="21" rx="9.5" ry="9" fill="#ebb075" stroke="#c47e45" strokeWidth="1" />
          <ellipse cx="13.5" cy="21.5" rx="3.4" ry="2.8" fill="#fff9ed" />
          <ellipse cx="22.5" cy="21.5" rx="3.4" ry="2.8" fill="#fff9ed" />
          <circle cx="15" cy="17.5" r="1.2" fill="#23283a" />
          <circle cx="21" cy="17.5" r="1.2" fill="#23283a" />
          <circle cx="18" cy="19.5" r="1.2" fill="#ff8da8" />
        </svg>
      );
    case 'fish':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <polygon points="24,20 31,14 31,26" fill="#ffb485" />
          <ellipse cx="16.5" cy="20" rx="9.2" ry="6.2" fill="#ff8552" />
          <rect x="14" y="14.2" width="3.5" height="11.6" rx="1" fill="#fff5e6" />
          <circle cx="11" cy="18.8" r="1.3" fill="#23283a" />
        </svg>
      );
    case 'eiffel-tower':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path
            d="M17.2 6h1.6l1.3 10.5L23 23.5l5 7H23.2l-1.3-3.2c-1.4-2.4-6.4-2.4-7.8 0L12.8 30.5H8l5-7 2.9-7z"
            fill="#d8a848"
            stroke="#8a5e18"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect x="13" y="22.8" width="10" height="2" rx="0.6" fill="#f5d982" stroke="#8a5e18" strokeWidth="0.8" />
          <rect x="15" y="16.2" width="6" height="1.8" rx="0.5" fill="#f5d982" stroke="#8a5e18" strokeWidth="0.8" />
          <line x1="18" y1="3.5" x2="18" y2="6" stroke="#8a5e18" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'mistletoe':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <ellipse cx="13" cy="21" rx="3.4" ry="7" transform="rotate(-24 13 21)" fill="#469662" />
          <ellipse cx="23" cy="21" rx="3.4" ry="7" transform="rotate(24 23 21)" fill="#469662" />
          <path d="M12.5 11.5l5.5 2.5-5.5 2.5zM23.5 11.5l-5.5 2.5 5.5 2.5z" fill="#d6333e" />
          <circle cx="18" cy="21.5" r="2" fill="#fffef8" stroke="#c8d4de" strokeWidth="0.8" />
          <circle cx="15.8" cy="24" r="1.9" fill="#fffef8" stroke="#c8d4de" strokeWidth="0.8" />
          <circle cx="20.2" cy="24" r="1.9" fill="#fffef8" stroke="#c8d4de" strokeWidth="0.8" />
        </svg>
      );
    case 'tequila-bottle':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <rect x="16" y="7.5" width="4" height="3.2" fill="#c9935b" />
          <rect x="15.5" y="10.5" width="5" height="5" fill="#88c996" />
          <rect x="11.5" y="15.5" width="13" height="15" rx="3.5" fill="#88c996" stroke="#48825a" strokeWidth="1.1" />
          <rect x="13" y="19.5" width="10" height="6.5" rx="1" fill="#fff9ec" />
          <rect x="15" y="13.5" width="6" height="2" fill="#d4333d" />
          <circle cx="25.5" cy="16.5" r="3" fill="#80db48" />
        </svg>
      );
    case 'film-slate':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <g transform="rotate(-14 9 14)">
            <rect x="7" y="9.5" width="21" height="4.4" rx="0.9" fill="#262c3a" stroke="#181c26" strokeWidth="0.9" />
            <polygon points="10.5,9.5 13.5,9.5 11.5,13.9 8.5,13.9" fill="#fffdf8" />
            <polygon points="16.5,9.5 19.5,9.5 17.5,13.9 14.5,13.9" fill="#fffdf8" />
            <polygon points="22.5,9.5 25.5,9.5 23.5,13.9 20.5,13.9" fill="#fffdf8" />
          </g>
          <rect x="7" y="14.5" width="22" height="14.5" rx="1.8" fill="#262c3a" stroke="#181c26" strokeWidth="1.1" />
          <rect x="7" y="14.5" width="22" height="4" fill="#323a4c" />
          <polygon points="10,14.5 13,14.5 15,18.5 12,18.5" fill="#fffdf8" />
          <polygon points="16.5,14.5 19.5,14.5 21.5,18.5 18.5,18.5" fill="#fffdf8" />
          <polygon points="23,14.5 26,14.5 28,18.5 25,18.5" fill="#fffdf8" />
          <line x1="10" y1="22" x2="26" y2="22" stroke="#eef3fa" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="10" y1="25.5" x2="21" y2="25.5" stroke="#eef3fa" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="9.2" cy="15.8" r="1.1" fill="#f2c854" />
        </svg>
      );
    case 'honey-bee':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <ellipse cx="15" cy="14" rx="4.5" ry="3" transform="rotate(-24 15 14)" fill="#f2faff" stroke="#b9d4e8" strokeWidth="1" />
          <ellipse cx="21" cy="14" rx="4.5" ry="3" transform="rotate(24 21 14)" fill="#f2faff" stroke="#b9d4e8" strokeWidth="1" />
          <ellipse cx="18" cy="22" rx="9" ry="6.2" fill="#ffda47" stroke="#c9911d" strokeWidth="1" />
          <rect x="14.5" y="16.2" width="2.4" height="11.5" fill="#4a3228" />
          <rect x="19.5" y="16.2" width="2.4" height="11.5" fill="#4a3228" />
          <circle cx="11.5" cy="20.5" r="1.1" fill="#23283a" />
        </svg>
      );
    case 'acrylic-paint':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path d="M11 9.5h14l-3 17H14z" fill="#ffb5d0" stroke="#db7ca0" strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="13" y="14" width="10" height="7" fill="#fffef9" />
          <rect x="15.5" y="26.5" width="5" height="3.5" rx="0.8" fill="#f5f2f7" stroke="#bbb4c2" strokeWidth="0.9" />
          <circle cx="24" cy="28.5" r="2.6" fill="#ffb5d0" />
        </svg>
      );
    case 'pizza-slice':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path d="M9 10q9-3.5 18 0l-9 20z" fill="#ffe169" stroke="#e09c2b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M8 9.5q10-4.2 20 0" fill="none" stroke="#d9873b" strokeWidth="3.8" strokeLinecap="round" />
          <circle cx="15.5" cy="15.5" r="2.1" fill="#d4333d" />
          <circle cx="20.5" cy="17.5" r="2" fill="#d4333d" />
          <circle cx="17.5" cy="22.5" r="1.8" fill="#d4333d" />
          <ellipse cx="18.5" cy="14" rx="1.4" ry="0.8" transform="rotate(-25 18.5 14)" fill="#2d8254" />
        </svg>
      );
    case 'banana':
      return (
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path
            d="M11 8.5c-1.5 8 3 18.5 16.5 18.5 1.8 0 2.6-2.4 0.8-3.6-7.8-3.4-11.2-9.5-12.5-15z"
            fill="#ffe047"
            stroke="#d6a520"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect x="10.5" y="6.5" width="3.2" height="3" rx="0.8" transform="rotate(-12 10.5 6.5)" fill="#7a532d" />
          <circle cx="27.8" cy="25.2" r="1.3" fill="#6b4826" />
        </svg>
      );
  }
}
