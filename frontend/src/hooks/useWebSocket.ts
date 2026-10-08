import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initializeWebSocket } from '../api/websocket'; // Import your connection manager!

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  type:           string;
  new_tenders?:   number;
  new_alerts?:    number;
  total_ingested?: number;
  message?:       string;
  bid_id?:        string;
  new_status?:    string; 
}

export function useWebSocket() {
  const qc = useQueryClient();

  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [newTenders, setNewTenders] = useState(0);
  const [newAlerts,  setNewAlerts]  = useState(0);

  useEffect(() => {
    // 1. Get the single socket instance from your websocket.ts file
    const socket = initializeWebSocket();
    setStatus('connecting');

    // 2. Track connection status
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));

    // ==========================================
    // LISTENER 1: Ingestion Updates
    // ==========================================
    socket.on('ingestion_complete', (msg: WsMessage) => {
      setLastMessage(msg);

      if (msg.new_tenders && msg.new_tenders > 0) setNewTenders(prev => prev + msg.new_tenders!);
      if (msg.new_alerts  && msg.new_alerts  > 0) setNewAlerts(prev => prev + msg.new_alerts!);

      // Refresh the UI caches
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['tenders'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    });

    // ==========================================
    // LISTENER 2: Bid Tracker Updates
    // ==========================================
    socket.on('bid_status_changed', (payload) => {
      setLastMessage({ type: 'bid_status_changed', ...payload });

      // Refresh the dashboard charts
      qc.invalidateQueries({ queryKey: ['overview'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['tenders'] });
    });

    // 3. Cleanup when the app is closed
    return () => {
      // Notice we are NOT calling disconnectWebSocket() here unless we want to kill 
      // the connection for the whole app when this specific hook unmounts.
      // Instead, we just remove the listeners so we don't get memory leaks.
      socket.off('connect');
      socket.off('disconnect');
      socket.off('ingestion_complete');
      socket.off('bid_status_changed');
    };
  }, [qc]); 

  const clearCounters = useCallback(() => {
    setNewTenders(0);
    setNewAlerts(0);
  }, []);

  return { status, lastMessage, newTenders, newAlerts, clearCounters };
}