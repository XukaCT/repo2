import { io, Socket } from 'socket.io-client';

// Point this to your Frappe URL. 
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

let socket: Socket | null = null;

export const initializeWebSocket = () => {
  if (socket) return socket;

  // Frappe natively supports Socket.io connections
  socket = io(SOCKET_URL, {
    withCredentials: true, // Passes the Frappe session cookie automatically
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('Successfully connected to Frappe Realtime (Socket.io)');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  // ==========================================
  // LISTENER: Catch updates from Bid Tracker
  // ==========================================
  socket.on('bid_status_changed', (payload) => {
    console.log('URGENT: Bid Status Updated in ERPNext!', payload);
    
    // Create a custom browser event so your React components can listen for it
    const event = new CustomEvent('onBidUpdate', { detail: payload });
    window.dispatchEvent(event);
  });

  return socket;
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};