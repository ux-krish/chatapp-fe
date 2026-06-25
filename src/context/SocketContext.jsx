import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { accessToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Connect to Socket.IO using absolute/relative path since Vite proxies it
    const newSocket = io({
      auth: {
        token: accessToken
      },
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO Gateway Connected.');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO Gateway Disconnected.');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
