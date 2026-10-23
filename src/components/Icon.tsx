import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'menu'
  | 'back'
  | 'phone'
  | 'hand'
  | 'trend'
  | 'pencil'
  | 'people'
  | 'calendar'
  | 'target'
  | 'home'
  | 'chat'
  | 'checkin'
  | 'gear'
  | 'send'
  | 'check'
  | 'plus'
  | 'shield'
  | 'message'
  | 'chevron'
  | 'close'
  | 'pin'
  | 'info'
  | 'mic'
  | 'speaker'
  | 'speakerOff'
  | 'bell'
  | 'star';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

// Line icons drawn on a 24x24 grid, so they need no icon font.
export default function Icon({ name, size = 22, color = '#fff', strokeWidth = 2 }: Props) {
  const p = {
    stroke: color,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  let body: React.ReactNode;
  switch (name) {
    case 'menu':
      body = (
        <>
          <Line x1="4" y1="7" x2="20" y2="7" {...p} />
          <Line x1="4" y1="12" x2="20" y2="12" {...p} />
          <Line x1="4" y1="17" x2="20" y2="17" {...p} />
        </>
      );
      break;
    case 'back':
      body = <Polyline points="15 18 9 12 15 6" {...p} />;
      break;
    case 'chevron':
      body = <Polyline points="9 18 15 12 9 6" {...p} />;
      break;
    case 'close':
      body = (
        <>
          <Line x1="6" y1="6" x2="18" y2="18" {...p} />
          <Line x1="18" y1="6" x2="6" y2="18" {...p} />
        </>
      );
      break;
    case 'phone':
      body = (
        <Path
          d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
          {...p}
        />
      );
      break;
    case 'hand':
      body = (
        <Path
          d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"
          {...p}
        />
      );
      break;
    case 'trend':
      body = (
        <>
          <Polyline points="3 17 9 11 13 15 21 7" {...p} />
          <Polyline points="15 7 21 7 21 13" {...p} />
        </>
      );
      break;
    case 'pencil':
      body = (
        <>
          <Path d="M12 20h9" {...p} />
          <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" {...p} />
        </>
      );
      break;
    case 'people':
      body = (
        <>
          <Circle cx="9" cy="8" r="3.5" {...p} />
          <Path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" {...p} />
          <Path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.6 3.5 5.2" {...p} />
        </>
      );
      break;
    case 'calendar':
      body = (
        <>
          <Rect x="3" y="5" width="18" height="16" rx="2" {...p} />
          <Line x1="3" y1="10" x2="21" y2="10" {...p} />
          <Line x1="8" y1="3" x2="8" y2="7" {...p} />
          <Line x1="16" y1="3" x2="16" y2="7" {...p} />
        </>
      );
      break;
    case 'target':
      body = (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Circle cx="12" cy="12" r="5.5" {...p} />
          <Circle cx="12" cy="12" r="2" {...p} />
        </>
      );
      break;
    case 'home':
      body = (
        <>
          <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...p} />
        </>
      );
      break;
    case 'chat':
      body = <Path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.5 8.5 0 1 1 21 11.5z" {...p} />;
      break;
    case 'message':
      body = (
        <>
          <Path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-5 4V5a1 1 0 0 1 1-1z" {...p} />
        </>
      );
      break;
    case 'checkin':
      body = (
        <>
          <Circle cx="9" cy="8" r="3.5" {...p} />
          <Path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5 1.6 0 3 .5 4.1 1.3" {...p} />
          <Polyline points="15 17 17.5 19.5 22 14" {...p} />
        </>
      );
      break;
    case 'gear':
      body = (
        <>
          <Circle cx="12" cy="12" r="3" {...p} />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            {...p}
          />
        </>
      );
      break;
    case 'send':
      body = (
        <>
          <Line x1="22" y1="2" x2="11" y2="13" {...p} />
          <Path d="M22 2 15 22l-4-9-9-4z" {...p} />
        </>
      );
      break;
    case 'check':
      body = <Polyline points="20 6 9 17 4 12" {...p} />;
      break;
    case 'plus':
      body = (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" {...p} />
          <Line x1="5" y1="12" x2="19" y2="12" {...p} />
        </>
      );
      break;
    case 'shield':
      body = <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...p} />;
      break;
    case 'pin':
      body = (
        <>
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" {...p} />
          <Circle cx="12" cy="10" r="3" {...p} />
        </>
      );
      break;
    case 'info':
      body = (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Line x1="12" y1="11" x2="12" y2="16" {...p} />
          <Line x1="12" y1="8" x2="12" y2="8" {...p} />
        </>
      );
      break;
    case 'bell':
      body = (
        <>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" {...p} />
          <Path d="M13.7 21a2 2 0 0 1-3.4 0" {...p} />
        </>
      );
      break;
    case 'star':
      body = <Path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" {...p} />;
      break;
    case 'mic':
      body = (
        <>
          <Rect x="9" y="2" width="6" height="12" rx="3" {...p} />
          <Path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" {...p} />
        </>
      );
      break;
    case 'speaker':
      body = (
        <>
          <Path d="M11 5 6 9H3v6h3l5 4z" {...p} />
          <Path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" {...p} />
        </>
      );
      break;
    case 'speakerOff':
      body = (
        <>
          <Path d="M11 5 6 9H3v6h3l5 4z" {...p} />
          <Line x1="16" y1="9" x2="22" y2="15" {...p} />
          <Line x1="22" y1="9" x2="16" y2="15" {...p} />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
