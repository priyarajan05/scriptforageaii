import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) socket = io('/', { transports: ['websocket'] });
  return socket;
}

export function useSocket(event, handler) {
  const savedHandler = useRef(handler);
  savedHandler.current = handler;

  useEffect(() => {
    const s = getSocket();
    const cb = (...args) => savedHandler.current(...args);
    s.on(event, cb);
    return () => s.off(event, cb);
  }, [event]);
}
