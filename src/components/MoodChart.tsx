import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { ChartMark } from '../recovery/lifeEvents';
import { colors } from '../theme';

export type ChartPoint = { label: string; value: number | null };

// Line chart on the fixed -2..+2 scale. Gaps (no check-in) break the line
// rather than being interpolated, so the chart never invents a mood. Marks are
// life events: a dashed line and a dot under the point they fall on.
export default function MoodChart({ points, marks = [], height = 210 }: { points: ChartPoint[]; marks?: ChartMark[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const padL = 26;
  const padR = 22;
  const padT = 12;
  const padB = marks.length ? 42 : 26;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const x = (i: number) => padL + (points.length <= 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const y = (v: number) => padT + ((2 - v) / 4) * plotH;

  let d = '';
  let pen = false;
  points.forEach((p, i) => {
    if (p.value == null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
    pen = true;
  });

  const labelEvery = points.length > 12 ? Math.ceil(points.length / 7) : 1;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[2, 1, 0, -1, -2].map((v) => (
            <React.Fragment key={v}>
              <Line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={padL - 6} y={y(v) + 4} fontSize={11} fill={colors.inkSoft} textAnchor="end">
                {v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}
              </SvgText>
            </React.Fragment>
          ))}
          {marks.map((m) => (
            <React.Fragment key={`m${m.index}`}>
              <Line x1={x(m.index)} x2={x(m.index)} y1={padT} y2={padT + plotH} stroke={m.color} strokeWidth={1.5} strokeDasharray="3,4" opacity={0.6} />
              <Circle cx={x(m.index)} cy={padT + plotH + 12} r={5} fill={m.color} />
              {m.count > 1 ? (
                <SvgText x={x(m.index) + 8} y={padT + plotH + 16} fontSize={10} fill={colors.inkSoft}>
                  {m.count}
                </SvgText>
              ) : null}
            </React.Fragment>
          ))}
          <Path d={d} stroke={colors.greenLine} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
          {points.map((p, i) =>
            p.value == null ? null : (
              <Circle key={i} cx={x(i)} cy={y(p.value)} r={4.5} fill="#fff" stroke={colors.greenLine} strokeWidth={2} />
            ),
          )}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <SvgText key={`l${i}`} x={x(i)} y={height - 6} fontSize={11} fill={colors.inkSoft} textAnchor="middle">
                {p.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}
