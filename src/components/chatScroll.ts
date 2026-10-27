import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';

/**
 * Keeps the start of the newest messages in view (Ed, 2026-10-25: "when she
 * talks the screen moves up and covers the typed version").
 *
 * Scrolling to the very end hid the top of a long reply while Zoey was reading
 * it. Instead, the first message of each new batch (usually what the person
 * just sent, then Zoey's answer) is scrolled to the top of the view, and never
 * further than the end, so short replies still sit at the bottom with their
 * buttons showing.
 *
 * Each message's outer view gets `onLayout={track(id)}`; it must be a direct
 * child of the ScrollView's content so its y is measured from the top.
 *
 * Answer buttons Zoey points to ("Yes", "No", "Pick one of these") are always
 * scrolled into view (Ed, 2026-10-27): their view gets `onLayout={keep}`, and
 * `buttons` says whether they're showing.
 */
export function useChatScroll(ids: string[], buttons = false) {
  const scroll = useRef<ScrollViewInstance>(null);
  const ys = useRef(new Map<string, number>());
  const seen = useRef(new Set<string>());
  const anchor = useRef<string | null>(null);
  const size = useRef({ content: 0, view: 0 });
  // Where the answer buttons are, while they're showing.
  const box = useRef<{ y: number; h: number } | null>(null);

  const follow = useCallback(() => {
    const y = anchor.current ? ys.current.get(anchor.current) : undefined;
    if (!size.current.view || (y === undefined && !box.current)) return;
    const end = Math.max(0, size.current.content - size.current.view);
    let to = y === undefined ? 0 : Math.max(0, y - 12);
    // Far enough down that the whole row of buttons shows.
    if (box.current) to = Math.max(to, box.current.y + box.current.h + 12 - size.current.view);
    scroll.current?.scrollTo({ y: Math.min(end, to), animated: true });
  }, []);

  useEffect(() => {
    if (!buttons) box.current = null;
  }, [buttons]);

  const keep = useCallback(
    (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      box.current = { y, h: height };
      follow();
    },
    [follow],
  );

  useEffect(() => {
    const fresh = ids.filter((id) => !seen.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => seen.current.add(id));
    anchor.current = fresh[0];
    follow();
  }, [ids, follow]);

  const track = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      ys.current.set(id, e.nativeEvent.layout.y);
      if (id === anchor.current) follow();
    },
    [follow],
  );

  const scrollProps = {
    ref: scroll,
    onLayout: (e: LayoutChangeEvent) => {
      size.current.view = e.nativeEvent.layout.height;
      follow();
    },
    onContentSizeChange: (_w: number, h: number) => {
      size.current.content = h;
      follow();
    },
  };

  return { scrollProps, track, keep };
}
