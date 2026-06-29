import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import { useSocket } from './context/SocketContext';
import AuthScreen from './components/auth/AuthScreen';
import Sidebar from './components/sidebar/Sidebar';
import ChatWindow from './components/chat/ChatWindow';
import CallOverlay from './components/chat/CallOverlay';
import AdminDashboard from './components/admin/AdminDashboard';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

function App() {
  const { user, loading: authLoading, isAdminPortalOpen, setIsAdminPortalOpen, getAvatarUrl, completeTokenLogin } = useAuth();
  const { activeChat } = useChat();
  const { socket, connected: socketConnected } = useSocket();
  const [broadcastAlert, setBroadcastAlert] = useState(null);

  useEffect(() => {
    if (!socket) return;
    
    const handleBroadcast = (data) => {
      setBroadcastAlert(data);
    };

    socket.on('system_broadcast', handleBroadcast);
    return () => {
      socket.off('system_broadcast', handleBroadcast);
    };
  }, [socket]);

  // Auto-dismiss broadcast after 12 seconds
  useEffect(() => {
    if (!broadcastAlert) return;
    const timer = setTimeout(() => {
      setBroadcastAlert(null);
    }, 12000);
    return () => clearTimeout(timer);
  }, [broadcastAlert]);

  // Dynamic height adjustment to handle mobile virtual keyboards
  useEffect(() => {
    const handleResize = () => {
      const height = window.visualViewport 
        ? window.visualViewport.height 
        : window.innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }
    window.addEventListener('resize', handleResize);
    
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle Capacitor Deep Links (Android redirect tokens)
  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const handleDeepLink = (event) => {
        console.log('🔗 Received deep link intent URL:', event.url);
        try {
          const parsedUrl = new URL(event.url);
          if (parsedUrl.host === 'auth-success') {
            const accessToken = parsedUrl.searchParams.get('accessToken');
            const refreshToken = parsedUrl.searchParams.get('refreshToken');
            if (accessToken && refreshToken) {
              console.log('🔑 Extracted tokens from deep link. Authenticating...');
              completeTokenLogin(accessToken, refreshToken);
            }
          }
        } catch (err) {
          console.error('Failed to parse deep link URL:', err);
        }
      };

      CapApp.addListener('appUrlOpen', handleDeepLink);

      // Check for launcher intent URL on cold start
      CapApp.getLaunchUrl().then((launchUrl) => {
        if (launchUrl && launchUrl.url) {
          handleDeepLink(launchUrl);
        }
      });

      return () => {
        CapApp.removeAllListeners();
      };
    }
  }, [completeTokenLogin]);

  const isAppLoading = authLoading || (user && !socketConnected);

  if (isAppLoading) {
    return (
      <div
        className="w-screen bg-background flex flex-col items-center justify-center chat-bg-playful relative overflow-hidden text-on-surface"
        style={{ height: 'var(--viewport-height, 100dvh)' }}
      >
        {/* Floating playful emojis drift in the background */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          {[
            { e: '💬', t: '10s', d: '0s', x: '15%', y: '20%', s: 'text-3xl' },
            { e: '✨', t: '14s', d: '2s', x: '75%', y: '25%', s: 'text-2xl' },
            { e: '🚀', t: '11s', d: '4s', x: '20%', y: '75%', s: 'text-2xl' },
            { e: '🎉', t: '13s', d: '1s', x: '70%', y: '70%', s: 'text-3xl' },
            { e: '⚡', t: '9s', d: '3s', x: '45%', y: '85%', s: 'text-2xl' },
          ].map((p, i) => (
            <span
              key={i}
              className={`absolute ${p.s} opacity-30 hover-pop`}
              style={{
                left: p.x,
                top: p.y,
                animation: `float-drift-${i % 3} ${p.t} ease-in-out ${p.d} infinite alternate`,
              }}
            >
              {p.e}
            </span>
          ))}
        </div>
        <style>{`
          @keyframes float-drift-0 { 0% { transform: translate(0,0) rotate(0deg);} 100% { transform: translate(20px,-25px) rotate(10deg);} }
          @keyframes float-drift-1 { 0% { transform: translate(0,0) rotate(0deg);} 100% { transform: translate(-30px,20px) rotate(-12deg);} }
          @keyframes float-drift-2 { 0% { transform: translate(0,0) rotate(0deg);} 100% { transform: translate(15px,30px) rotate(8deg);} }
        `}</style>

        {/* Glassmorphic loading card */}
        <div className="relative z-10 flex flex-col items-center px-6">
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-emerald-500 via-indigo-500 to-pink-500 opacity-30 blur-2xl conic-spin-slow" aria-hidden="true"></div>
            <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-emerald-400 to-indigo-500 flex items-center justify-center shadow-elev4">
              <span className="absolute inset-0 rounded-3xl border-2 border-white/20"></span>
              <span className="text-3xl heartbeat">💬</span>
            </div>
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-7 text-2xl sm:text-3xl font-extrabold tracking-tight"
          >
            <span className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-pink-500 bg-clip-text text-transparent">
              Talkzen
            </span>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full glass text-xs text-on-surface font-medium"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 status-online-ring"></div>
            <span>Securing your connection…</span>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-screen bg-background text-on-surface flex overflow-hidden select-none font-sans relative"
      style={{ height: 'var(--viewport-height, 100dvh)' }}
    >
      {/* Global aurora backdrop — fills every empty pixel behind glass */}
      <div aria-hidden="true" className="app-aurora">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
      </div>

      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="h-full w-full overflow-hidden bg-background"
            style={{ height: 'var(--viewport-height, 100dvh)' }}
          >
            <AuthScreen />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="h-full w-full flex overflow-hidden"
          >
            {/* Left Sidebar Pane - Mobile/iPad Responsive Single-Pane Layout */}
            <div className={`h-full flex-shrink-0 z-10 transition-all duration-300 relative ${activeChat ? 'hidden lg:flex lg:w-[380px] xl:w-[420px]' : 'flex w-full lg:w-[380px] xl:w-[420px]'}`}>
              {/* Translucent glass layer behind sidebar so aurora can shine through */}
              <div className="absolute inset-y-0 right-0 left-0 bg-surface/55 backdrop-blur-2xl border-r border-white/40 dark:border-white/5 shadow-elev1" aria-hidden="true" />
              <div className="relative z-10 h-full w-full">
                <Sidebar />
              </div>
            </div>

            {/* Right Chat Area Pane - Mobile/iPad Responsive Single-Pane Layout */}
            <div className={`h-full relative transition-all duration-300 z-10 ${activeChat ? 'flex flex-1 w-full' : 'hidden lg:flex lg:flex-1'}`}>
              <ChatWindow />
            </div>

            {/* Fullscreen Admin Dashboard Portal Overlay */}
            <AnimatePresence>
              {isAdminPortalOpen && user?.role === 'admin' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="z-50"
                >
                  <AdminDashboard onClose={() => setIsAdminPortalOpen(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time System Broadcast Alert Overlay */}
      <AnimatePresence>
        {broadcastAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -50, scale: 0.95, x: '-50%' }}
            className="fixed top-4 left-1/2 z-[9999] w-[90%] max-w-md p-5 rounded-2xl glass-strong flex gap-3.5 items-start cursor-pointer select-text text-on-surface"
            onClick={() => setBroadcastAlert(null)}
          >
            <div className={`p-2.5 rounded-xl flex-shrink-0 backdrop-blur-md ${
              broadcastAlert.severity === 'danger' ? 'bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/30' :
              broadcastAlert.severity === 'warning' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
              'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-muted">
                  System Broadcast
                </span>
                <span className="text-[9px] text-on-surface-faint">
                  {new Date(broadcastAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs font-semibold mt-1.5 leading-relaxed">
                {broadcastAlert.message}
              </p>
              {broadcastAlert.mediaUrl && (
                <div className="mt-3 rounded-xl overflow-hidden border border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-md max-h-32 flex justify-center items-center">
                  <img src={getAvatarUrl(broadcastAlert.mediaUrl)} alt="Broadcast attachment" className="max-w-full max-h-32 object-contain" />
                </div>
              )}
            </div>
            <button className="text-on-surface-muted hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high backdrop-blur-md">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time WebRTC Audio Calling Portal Overlay */}
      <CallOverlay />
    </div>
  );
}

export default App;
