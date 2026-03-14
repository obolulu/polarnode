// src/components/BatteryUsageIndicator.tsx

interface BatteryUsageIndicatorProps {
  fan: number;
  heater: number;
}

const SEGMENT_COLORS = ["#4ade80", "#a3e635", "#facc15", "#f97316", "#ef4444"];
const USAGE_LABELS = ["Off", "Low", "Medium", "High", "Max"];

export function BatteryUsageIndicator({ fan, heater }: BatteryUsageIndicatorProps) {
  const usageScore = Math.min(fan + heater, 4);
  const activeColor = SEGMENT_COLORS[usageScore];

  // SVG layout constants
  const segW = 18;
  const segH = 28;
  const gap = 4;
  const padX = 6;
  const padY = 6;
  const numSegments = 4;
  const bodyW = padX * 2 + numSegments * segW + (numSegments - 1) * gap;
  const bodyH = padY * 2 + segH;
  const termW = 5;
  const termH = 12;
  const totalW = bodyW + termW;
  const totalH = bodyH;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <span style={{ fontSize: "0.75rem", opacity: 0.6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Power Draw
      </span>
      <svg
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        aria-label={`Power draw: ${USAGE_LABELS[usageScore]}`}
      >
        {/* Battery body outline */}
        <rect
          x={0.5}
          y={0.5}
          width={bodyW - 1}
          height={bodyH - 1}
          rx={5}
          ry={5}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1.5}
        />
        {/* Battery terminal nub */}
        <rect
          x={bodyW}
          y={(bodyH - termH) / 2}
          width={termW}
          height={termH}
          rx={2}
          ry={2}
          fill="rgba(255,255,255,0.3)"
        />
        {/* Segments */}
        {Array.from({ length: numSegments }).map((_, i) => {
          const filled = i < usageScore;
          const x = padX + i * (segW + gap);
          const y = padY;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={segW}
              height={segH}
              rx={3}
              ry={3}
              fill={filled ? activeColor : "rgba(255,255,255,0.1)"}
              style={{ transition: "fill 0.3s ease" }}
            />
          );
        })}
      </svg>
      <span style={{ fontSize: "0.85rem", fontWeight: 500, color: activeColor, transition: "color 0.3s ease" }}>
        {USAGE_LABELS[usageScore]}
      </span>
    </div>
  );
}
