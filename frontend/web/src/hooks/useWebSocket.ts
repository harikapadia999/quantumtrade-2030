'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketReturn {
  connected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  on: (event: string, callback: (data: any) => void) => () => void;
  emit: (event: string, data: any) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('token');

    // Connect to WebSocket server
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribe = useCallback((channel: string) => {
    if (!socketRef.current) return;

    const [type, ...rest] = channel.split(':');
    const data = rest.join(':');

    switch (type) {
      case 'market':
        socketRef.current.emit('subscribe:market', { symbol: data });
        break;
      case 'orderbook':
        socketRef.current.emit('subscribe:orderbook', { symbol: data });
        break;
      case 'trades':
        socketRef.current.emit('subscribe:trades', { symbol: data });
        break;
      case 'orders':
        socketRef.current.emit('subscribe:orders');
        break;
      case 'positions':
        socketRef.current.emit('subscribe:positions');
        break;
      case 'portfolio':
        socketRef.current.emit('subscribe:portfolio');
        break;
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('unsubscribe', { channel });
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (!socketRef.current) return () => {};

    // Add listener
    socketRef.current.on(event, callback);

    // Store listener for cleanup
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
      listenersRef.current.get(event)?.delete(callback);
    };
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (!socketRef.current) return;
    socketRef.current.emit(event, data);
  }, []);

  return {
    connected,
    subscribe,
    unsubscribe,
    on,
    emit,
  };
}
