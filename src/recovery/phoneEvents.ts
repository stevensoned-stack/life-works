// Zoey goes quiet the moment a call or text starts (Ed, 2026-11-15: "Zoey needs to stop
// talking when they are calling"). contact.ts calls `phoning`; useZoeyVoice listens.
export type PhoneKind = 'call' | 'text';
type PhoneListener = (kind: PhoneKind) => void;
const listeners = new Set<PhoneListener>();

export const onPhone = (fn: PhoneListener) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export const phoning = (kind: PhoneKind) => listeners.forEach((fn) => fn(kind));
