import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('http', 'ws')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  type:           string;
  new_tenders?:   number;
  new_alerts?:    number;
  total_ingested?: number;
  message?:       string;
}

export function useWebSocket() {
  const token                   = "cookie-auth";
  const qc                      = useQueryClient();
  const wsRef                   = useRef<WebSocket | null>(null);
  const reconnectRef            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectRef              = useRef<() => void>(() => {});
  const mountedRef              = useRef(true);

  const [status,     setStatus]     = useState<WsStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [newTenders, setNewTenders] = useState(0);
  const [newAlerts,  setNewAlerts]  = useState(0);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/live?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
      // Start ping every 25s to keep connection alive
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        } else {
          clearInterval(ping);
        }
      }, 25_000);
      pingRef.current = ping;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg: WsMessage = JSON.parse(event.data);
        setLastMessage(msg);

        if (msg.type === 'ingestion_complete') {
          // Update counters
          if (msg.new_tenders  && msg.new_tenders  > 0) setNewTenders(msg.new_tenders);
          if (msg.new_alerts   && msg.new_alerts   > 0) setNewAlerts(msg.new_alerts);

          // Invalidate React Query caches so pages refresh automatically
          qc.invalidateQueries({ queryKey: ['alerts'] });
          qc.invalidateQueries({ queryKey: ['tenders'] });
          qc.invalidateQueries({ queryKey: ['overview'] });
          qc.invalidateQueries({ queryKey: ['analytics'] });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      if (pingRef.current) clearInterval(pingRef.current);
      // Auto reconnect after 3 seconds
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connectRef.current();
      }, 3_000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, qc]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        if (pingRef.current) clearInterval(pingRef.current);
        wsRef.current.close();
      }
    };
  }, [connect, token]);

  const clearCounters = useCallback(() => {
    setNewTenders(0);
    setNewAlerts(0);
  }, []);

  return { status, lastMessage, newTenders, newAlerts, clearCounters };
}
