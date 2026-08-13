const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/live`;

type WSEvent = { type: string; payload: unknown };
type Listener = (event: WSEvent) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private reconnectDelay = 3000;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    try {
      this.ws = new WebSocket(WS_URL);
      this.ws.onopen    = () => { console.log('[WS] connected'); this.reconnectDelay = 3000; };
      this.ws.onmessage = (e) => { try { const data = JSON.parse(e.data); this.listeners.forEach(l => l(data)); } catch { /* ignore malformed JSON frames */ } };
      this.ws.onclose   = () => { if (this.shouldReconnect) this.scheduleReconnect(); };
      this.ws.onerror   = () => { this.ws?.close(); };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.ws?.close();
    this.ws = null;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isConnected() { return this.ws?.readyState === WebSocket.OPEN; }
}

export const wsManager = new WebSocketManager();
