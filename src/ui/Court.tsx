import type { Spot } from "@/src/data/spots";
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";

export function Court({
  width = 850,
  height = 900,
  spots,
  selectedIds,
  onToggleSpot,
  highlightedSpotId,
}: {
  width?: number;
  height?: number;
  spots: Spot[];
  selectedIds: Set<string>;
  onToggleSpot: (id: string) => void;
  highlightedSpotId?: string;
}) {
  // "padding" interno del dibujo
  const padX = width * 0.04;
  const padTop = height * 0.03;
  const padBottom = height * 0.04;

  // límites de la media cancha
  const left = padX;
  const right = width - padX;
  const top = padTop;
  const bottom = height - padBottom;

  const courtW = right - left;
  const courtH = bottom - top;

  // aro / tablero
  const rimX = left + courtW * 0.5;
  const rimY = top + courtH * 0.11;

  // zona pintada / key
  const keyW = courtW * 0.40;
  const keyH = courtH * 0.36;
  const keyX = rimX - keyW / 2;
  const keyY = top;

  // línea tiro libre
  const ftY = keyY + keyH;

  // medialuna TL (hacia adentro / arriba)
  const ftArcR = keyW * 0.30;

  // triple: laterales + arco
  const cornerXLeft = left + courtW * 0.12;
  const cornerXRight = right - courtW * 0.12;
  const threeArcR = courtW * 0.382;
  const dxCorner = Math.abs(rimX - cornerXLeft);
  const cornerBreakY = Math.min(
    rimY + Math.sqrt(Math.max(threeArcR * threeArcR - dxCorner * dxCorner, 0)),
    bottom - courtH * 0.02,
  );
  const threeStartAngle = cartesianToAngle(rimX, rimY, cornerXLeft, cornerBreakY);
  const threeEndAngle = cartesianToAngle(rimX, rimY, cornerXRight, cornerBreakY);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <Svg width={width} height={height}>
        {/* Fondo */}
        <Rect x="0" y="0" width={width} height={height} fill="rgba(0,0,0,0.25)" />

        {/* Contorno media cancha */}
        <Rect
          x={left}
          y={top}
          width={courtW}
          height={courtH}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={2}
          rx={12}
        />

        {/* Key / pintura */}
        <Rect
          x={keyX}
          y={keyY}
          width={keyW}
          height={keyH}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={2}
        />

        {/* Línea de tiro libre */}
        <Line
          x1={keyX}
          y1={ftY}
          x2={keyX + keyW}
          y2={ftY}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={2}
        />

        {/* Medialuna del tiro libre (hacia ARRIBA / hacia el aro) */}
        <Path
          d={describeArc(rimX, ftY, ftArcR, 270, 90, true)}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={2}
        />

        {/* Tablero */}
        <Line
          x1={rimX - keyW * 0.20}
          y1={rimY - 12}
          x2={rimX + keyW * 0.20}
          y2={rimY - 12}
          stroke="rgba(255,255,255,0.24)"
          strokeWidth={3}
        />

        {/* Aro */}
        <Circle
          cx={rimX}
          cy={rimY}
          r={7}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
        />

        {/* Triple: líneas rectas de esquina */}
        <Line
          x1={cornerXLeft}
          y1={top}
          x2={cornerXLeft}
          y2={cornerBreakY}
          stroke="rgba(245,158,11,0.35)"
          strokeWidth={2}
        />
        <Line
          x1={cornerXRight}
          y1={top}
          x2={cornerXRight}
          y2={cornerBreakY}
          stroke="rgba(245,158,11,0.35)"
          strokeWidth={2}
        />

        {/* Triple: arco (centrado en el aro) */}
        <Path
          d={describeArc(rimX, rimY, threeArcR, threeStartAngle, threeEndAngle, true)}
          fill="none"
          stroke="rgba(245,158,11,0.35)"
          strokeWidth={2}
        />

        {/* Spots */}
        {spots.map((s) => {
          const cx = left + s.x * courtW;
          const cy = top + s.y * courtH;
          const selected = selectedIds.has(s.id);
          const highlighted = highlightedSpotId === s.id;

          const stroke =
            s.shotType === "3PT"
              ? "rgba(245,158,11,0.90)"
              : "rgba(34,197,94,0.90)";

          const fill = selected ? stroke : "rgba(255,255,255,0.06)";

          return (
            <React.Fragment key={s.id}>
              {/* Destacado: círculo pulsante */}
              {highlighted && (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={28}
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={3}
                />
              )}

              {/* Área de toque grande */}
              <Circle
                cx={cx}
                cy={cy}
                r={36}
                fill="transparent"
                onPress={() => onToggleSpot(s.id)}
              />

              {/* Punto */}
              <Circle
                cx={cx}
                cy={cy}
                r={highlighted ? 22 : 18}
                fill={fill}
                stroke={stroke}
                strokeWidth={highlighted ? 3 : 2.5}
              />

              <SvgText
                x={cx}
                y={cy + 5}
                fontSize={highlighted ? "15" : "13"}
                fontWeight="700"
                fill={selected ? "rgba(11,18,32,1)" : "rgba(255,255,255,0.85)"}
                textAnchor="middle"
              >
                {s.label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Leyenda */}
        <Line
          x1={left + 10}
          y1={bottom - 12}
          x2={left + 26}
          y2={bottom - 12}
          stroke="rgba(245,158,11,0.85)"
          strokeWidth="4"
        />
        <SvgText x={left + 34} y={bottom - 8} fontSize="11" fill="rgba(255,255,255,0.75)">
          Triples
        </SvgText>

        <Line
          x1={left + 110}
          y1={bottom - 12}
          x2={left + 126}
          y2={bottom - 12}
          stroke="rgba(34,197,94,0.85)"
          strokeWidth="4"
        />
        <SvgText x={left + 134} y={bottom - 8} fontSize="11" fill="rgba(255,255,255,0.75)">
          Dobles
        </SvgText>
      </Svg>
    </View>
  );
}

// Helpers para arco
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function cartesianToAngle(cx: number, cy: number, x: number, y: number) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
}

function angleDelta(startAngle: number, endAngle: number, clockwise: boolean) {
  const normalizedStart = ((startAngle % 360) + 360) % 360;
  const normalizedEnd = ((endAngle % 360) + 360) % 360;
  return clockwise
    ? (normalizedEnd - normalizedStart + 360) % 360
    : (normalizedStart - normalizedEnd + 360) % 360;
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  clockwise = false,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const delta = angleDelta(startAngle, endAngle, clockwise);
  const largeArcFlag = delta > 180 ? "1" : "0";
  const sweepFlag = clockwise ? "1" : "0";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}
