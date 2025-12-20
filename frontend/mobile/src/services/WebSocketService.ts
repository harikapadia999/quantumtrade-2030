import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class WebSocketServiceClass {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  async connect(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        throw new Error('No authentication token found');
      }

      this.socket = io(process.env.REACT_APP_WS_URL || 'ws://localhost:3000', {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        this.socket!.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }

    // Add listener
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);

    // Subscribe to channel
    const [type, ...rest] = channel.split(':');
    const data = rest.join(':');

    switch (type) {
      case 'market':
        this.socket.emit('subscribe:market', { symbol: data });
        break;
      case 'orderbook':
        this.socket.emit('subscribe:orderbook', { symbol: data });
        break;
      case 'trades':
        this.socket.emit('subscribe:trades', { symbol: data });
        break;
      case 'orders':
        this.socket.emit('subscribe:orders');
        break;
      case 'positions':
        this.socket.emit('subscribe:positions');
        break;
      case 'portfolio':
        this.socket.emit('subscribe:portfolio');
        break;
    }

    // Listen for updates
    this.socket.on(channel, callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(channel)?.delete(callback);
      if (this.socket) {
        this.socket.off(channel, callback);
        this.socket.emit('unsubscribe', { channel });
      }
    };
  }

  emit(event: string, data: any): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.emit(event, data);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const WebSocketService = new WebSocketServiceClass();
