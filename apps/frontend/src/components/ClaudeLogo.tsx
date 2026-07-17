/**
 * ClaudeLogo — «солнышко» Claude (Anthropic): 12 лучей переменной длины,
 * фирменный терракотовый #D97757. Инлайн-SVG, без внешних ассетов.
 * Используется в Настройках (MCP-коннектор) и на лендинге (секция Claude).
 */

const RAYS = [10.2, 7.4, 9.2, 7.0, 10.2, 7.4, 9.2, 7.0, 10.2, 7.4, 9.2, 7.0];

export function ClaudeLogo({ size = 20, color = '#D97757' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {RAYS.map((r, i) => (
        <line
          key={i}
          x1="12" y1={12 - 3.3}
          x2="12" y2={12 - r}
          stroke={color}
          strokeWidth="2.05"
          strokeLinecap="round"
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
    </svg>
  );
}

export default ClaudeLogo;
