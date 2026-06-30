import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from './EmojiPicker';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const hasOnlyEmojis = (str) => {
  if (!str || !str.trim()) return false;
  const cleaned = str.replace(/\s+/g, '');
  const emojiRegex = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\uFE0F)+$/u;
  return emojiRegex.test(cleaned);
};

/* Confetti burst emitted from the send button — pure DOM, no deps */
const spawnConfetti = (host) => {
  try {
    const colors = ['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#06b6d4'];
    const rect = host.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 14; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const distance = 28 + Math.random() * 26;
      piece.style.background = colors[i % colors.length];
      piece.style.left = `${cx}px`;
      piece.style.top = `${cy}px`;
      piece.style.setProperty(
        '--confetti-end',
        `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance - 14}px) rotate(${Math.random() * 360}deg)`
      );
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 800);
    }
  } catch (_) {
    /* no-op */
  }
};
import {
  Send, Paperclip, Smile, MoreVertical, MoreHorizontal, ShieldCheck, Phone, Video,
  Info, Image as ImageIcon, FileText, Film, Volume2, ArrowLeft, Trash2, LogOut, Check, CheckCheck,
  Users2, X, Plus, Reply, Pin, PinOff, Pencil, ChevronDown, Download, Mail, User, Calendar,
  Ban, EyeOff, UserMinus
} from 'lucide-react';

function ChatWindow() {
  const { user, getAvatarUrl, apiBase, accessToken, chatBgPattern } = useAuth();
  const {
    activeChat, messages, selectChat, sendMessage, sendMediaMessage,
    setTypingIndicator, typingStatus, leaveGroup, addGroupMembers, friends,
    replyingTo, setReplyingTo, editMessage, deleteMessage, pinMessage, reactMessage,
    pinChatAction, unpinChatAction, blockUserAction, unblockUserAction,
    hideChatAction,
    removeFriendshipAction,
    clearChatHistoryAction
  } = useChat();
  const { startCall } = useCall();

  const isGroup = activeChat ? !!activeChat.groupId : false;

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedFriendsToGroup, setSelectedFriendsToGroup] = useState([]);

  // Chat actions dropdown (header MoreVertical)
  const [showChatMenu, setShowChatMenu] = useState(false);
  const chatMenuRef = useRef(null);
  // Confirmation modal for destructive actions
  const [confirmAction, setConfirmAction] = useState(null); // { type, friendId, friendName }

  // Custom states for editing, highlighting, and scrolling
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInputText, setEditInputText] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const messageRefs = useRef(new Map());

  // Helper function to download files locally (forces local browser download)
  const handleDownload = async (url, originalFilename) => {
    try {
      // Local blob or base64 preview URLs can be downloaded directly
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = originalFilename || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Proxy remote (Firebase Storage) or server-stored files through the backend to avoid CORS and force local folder save
      const downloadUrl = `${apiBase}/api/chat/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(originalFilename || '')}&token=${accessToken}`;
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Failed to download file:', err);
      window.open(url, '_blank');
    }
  };

  const scrollToMessage = (messageId) => {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  const handleEmojiSelect = (emoji) => {
    const ref = inputRef.current;
    if (!ref) {
      setInputText(prev => prev + emoji);
      return;
    }
    const start = ref.selectionStart;
    const end = ref.selectionEnd;
    const text = inputText;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setInputText(before + emoji + after);

    const newCursorPos = start + emoji.length;
    setTimeout(() => {
      ref.focus();
      ref.selectionStart = newCursorPos;
      ref.selectionEnd = newCursorPos;
    }, 0);
  };

  // Mentions State
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const inputRef = useRef(null);

  const filteredMembers = isGroup && activeChat?.members
    ? activeChat.members
      .filter(m => m.id !== user?.id)
      .filter(m => m.displayName.toLowerCase().includes(mentionSearchQuery.toLowerCase()))
    : [];

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingStatus]);

  // Close mention dropdown when active chat changes
  useEffect(() => {
    setShowMentionDropdown(false);
  }, [activeChat?.id]);

  // Auto-focus text input box when active chat changes
  useEffect(() => {
    if (activeChat) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeChat?.id]);

  // Close message options dropdown when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeMenuMessageId && !e.target.closest('.message-dropdown-container')) {
        setActiveMenuMessageId(null);
      }
      if (showChatMenu && chatMenuRef.current && !chatMenuRef.current.contains(e.target)) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [activeMenuMessageId, showChatMenu]);

  // Handle confirmed destructive actions from the header/profile menu
  const handleConfirmChatAction = async () => {
    if (!confirmAction) return;
    const { type, friendId } = confirmAction;
    if (type === 'block') await blockUserAction(friendId);
    if (type === 'unblock') await unblockUserAction(friendId);
    if (type === 'clearChatHistory') {
      const isOneToOne = !activeChat.groupId;
      const chatId = isOneToOne
        ? (user.id < friendId ? `usr_${user.id}_usr_${friendId}` : `usr_${friendId}_usr_${user.id}`)
        : activeChat.id;
      await clearChatHistoryAction(chatId);
    }
    if (type === 'removeFriendship') { await removeFriendshipAction(friendId); selectChat(null); }
    setConfirmAction(null);
    setShowGroupInfo(false);
  };

  if (!user) return null;

  // Handle typing indicator debouncer and mention trigger detection
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    if (!isTyping) {
      setIsTyping(true);
      setTypingIndicator(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingIndicator(false);
    }, 1500);

    // Mentions logic in group chats
    if (isGroup) {
      const selectionStart = e.target.selectionStart || 0;
      const textBeforeCursor = val.slice(0, selectionStart);
      const lastAtOffset = textBeforeCursor.lastIndexOf('@');

      if (lastAtOffset !== -1) {
        // Check if the '@' is at the start or preceded by a space
        const isTriggered = lastAtOffset === 0 || textBeforeCursor[lastAtOffset - 1] === ' ';

        if (isTriggered) {
          const query = textBeforeCursor.slice(lastAtOffset + 1);
          // Only show dropdown if the query doesn't contain spaces
          if (!query.includes(' ')) {
            setShowMentionDropdown(true);
            setMentionSearchQuery(query);
            setMentionTriggerIndex(lastAtOffset);
            setMentionSelectedIndex(0);
            return;
          }
        }
      }
    }
    setShowMentionDropdown(false);
  };

  // Keyboard navigation inside mentions dropdown
  const handleKeyDown = (e) => {
    if (showMentionDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectMention(filteredMembers[mentionSelectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
      }
    }
  };

  // Insert selected mention into input box
  const selectMention = (member) => {
    if (!member) return;
    const textBeforeMention = inputText.slice(0, mentionTriggerIndex);
    const textAfterCursor = inputText.slice(mentionTriggerIndex + 1 + mentionSearchQuery.length);
    const newText = `${textBeforeMention}@${member.displayName} ${textAfterCursor}`;
    setInputText(newText);
    setShowMentionDropdown(false);

    // Maintain focus and set cursor position right after the mention space
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = mentionTriggerIndex + member.displayName.length + 2; // +1 for '@', +1 for space
        inputRef.current.selectionStart = newCursorPos;
        inputRef.current.selectionEnd = newCursorPos;
      }
    }, 0);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendMessage(inputText.trim(), 'text');
    setInputText('');

    // Clear typing status immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTyping(false);
    setTypingIndicator(false);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setShowAttachMenu(false);
    try {
      await sendMediaMessage(file);
    } catch (err) {
      alert('Failed to send file.');
    }
  };

  // Helper Date Formatter
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to parse and render mentions in text messages
  const renderMessageContent = (content, members) => {
    if (!content) return '';
    if (!members || members.length === 0) return content;

    // Sort members by display name length descending to avoid partial matching bugs (e.g., matching "John" in "John Doe")
    const sortedMembers = [...members].sort((a, b) => b.displayName.length - a.displayName.length);

    // Escape special characters in display names to build a safe regex
    const escapedNames = sortedMembers.map(m => m.displayName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    if (escapedNames.length === 0) return content;

    // Match exact display names preceded by '@' and followed by space, punctuation, or end of string
    const regex = new RegExp(`@(${escapedNames.join('|')})(?=\\s|$|[.,!?;:])`, 'g');

    const parts = [];
    let lastIndex = 0;
    let match;

    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const matchIndex = match.index;
      const matchText = match[0];
      const nameOnly = match[1];

      if (matchIndex > lastIndex) {
        parts.push(content.substring(lastIndex, matchIndex));
      }

      const member = sortedMembers.find(m => m.displayName === nameOnly);
      const isCurrentUserMentioned = member?.id === user?.id;

      parts.push(
        <span
          key={matchIndex}
          className={`font-semibold px-1 rounded-md transition-colors ${isCurrentUserMentioned
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-sans'
            : 'text-emerald-400 hover:underline cursor-pointer font-sans'
            }`}
        >
          {matchText}
        </span>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  // Get active typing status text
  const getTypingText = () => {
    if (!activeChat) return null;
    const isGroup = !!activeChat.groupId;
    const chatId = isGroup ? activeChat.id : [user.id, activeChat.id].sort().join('_');
    const chatTypers = typingStatus[chatId];

    if (!chatTypers || Object.keys(chatTypers).length === 0) return null;

    if (isGroup) {
      const names = Object.keys(chatTypers)
        .filter(id => id !== user.id)
        .map(id => {
          const member = activeChat.members?.find(m => m.id === id);
          return member ? member.displayName : 'Someone';
        });

      if (names.length === 0) return null;
      if (names.length === 1) return `${names[0]} is typing...`;
      return `${names.slice(0, 2).join(', ')} are typing...`;
    } else {
      // 1-to-1 chat
      if (chatTypers[activeChat.id]) {
        return 'typing...';
      }
    }
    return null;
  };

  const typingText = getTypingText();

  // --- 1. EMPTY CHAT STATE ---
  if (!activeChat) {
    return (
      <div className="h-full w-full chat-bg chat-bg-playful flex flex-col items-center justify-center p-8 text-center select-none font-sans relative overflow-hidden" data-bg-pattern={chatBgPattern}>
        {/* Floating ambient emojis */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          {['💬','✨','🚀','💜','🎈','⚡','🌈','🔥'].map((e, i) => (
            <span
              key={i}
              className="absolute text-2xl opacity-25 hover-pop"
              style={{
                left: `${10 + (i * 11) % 80}%`,
                top: `${8 + (i * 13) % 80}%`,
                animation: `empty-float-${i % 4} ${10 + (i % 4) * 2}s ease-in-out ${i * 0.5}s infinite alternate`,
              }}
            >
              {e}
            </span>
          ))}
        </div>
        <style>{`
          @keyframes empty-float-0 { 0%{transform:translate(0,0) rotate(0)}100%{transform:translate(15px,-25px) rotate(8deg)} }
          @keyframes empty-float-1 { 0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-20px,15px) rotate(-10deg)} }
          @keyframes empty-float-2 { 0%{transform:translate(0,0) rotate(0)}100%{transform:translate(10px,30px) rotate(6deg)} }
          @keyframes empty-float-3 { 0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-25px,-10px) rotate(-6deg)} }
        `}</style>

        <div className="max-w-md p-8 rounded-3xl glass border border-outline/80 shadow-2xl flex flex-col items-center relative z-10">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            className="relative mb-6"
          >
            <div className="absolute -inset-3 rounded-[32px] bg-gradient-to-tr from-emerald-500 via-indigo-500 to-pink-500 opacity-40 blur-2xl conic-spin-slow" aria-hidden="true"></div>
            <div className="relative h-20 w-20 bg-gradient-to-tr from-emerald-500 via-emerald-400 to-indigo-500 rounded-3xl flex items-center justify-center text-4xl shadow-2xl shadow-emerald-500/30">
              💬
            </div>
          </motion.div>
          <h2 className="text-2xl font-extrabold tracking-tight font-sans">
            <span className="bg-gradient-to-r from-emerald-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
              Welcome to Talkzen
            </span>
          </h2>
          <p className="mt-2.5 text-xs text-on-surface-muted max-w-[320px] leading-relaxed">
            Pick a chat from the left to start messaging. Real-time DMs, group channels &amp; media — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold tracking-wide uppercase hover-pop">
              <ShieldCheck className="h-3.5 w-3.5" /> End-to-End Synced
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-bold tracking-wide uppercase hover-pop">
              ⚡ Realtime
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-[10px] text-pink-300 font-bold tracking-wide uppercase hover-pop">
              🎨 Themeable
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Determine chat characteristics
  const isOnline = !isGroup && activeChat.status === 'online';

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

  return (
    <div className="h-full w-full flex flex-col bg-surface/85 backdrop-blur-xl border border-outline-variant/60 font-sans relative overflow-hidden chat-bg" data-bg-pattern={chatBgPattern}>

      {/* 2. CHAT WINDOW HEADER */}
      <div
        className="px-4 pt-[env(safe-area-inset-top)] glass-light border-none backdrop-blur-2xl flex items-center justify-between z-20"
        style={{ height: 'calc(68px + env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => selectChat(null)}
            className="lg:hidden p-1.5 hover:bg-surface-container-high text-on-surface-muted hover:text-on-surface rounded-lg transition mr-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="relative cursor-pointer group/avatar" onClick={() => setShowGroupInfo(true)}>
            {activeChat.avatarUrl ? (
              <img src={getAvatarUrl(activeChat.avatarUrl)} alt={activeChat.name || activeChat.displayName} className="h-10 w-10 rounded-full object-cover border border-outline group-hover/avatar:border-emerald-400 transition-all duration-300" />
            ) : (
              <div className="h-10 w-10 rounded-full mesh-avatar border border-outline flex items-center justify-center font-extrabold text-white text-xs uppercase shadow-inner">
                {isGroup ? <Users2 className="h-5 w-5 text-white" /> : getInitials(activeChat.displayName)}
              </div>
            )}
            {isOnline && (
              <>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-emerald-500 border-2 border-outline-variant rounded-full status-online-ring"></span>
              </>
            )}
          </div>

          <div className="min-w-0" onClick={() => setShowGroupInfo(true)}>
            <h3 className="text-sm font-bold text-white truncate leading-tight">
              {isGroup ? activeChat.name : activeChat.displayName}
            </h3>
            <span className="text-[11px] text-on-surface-muted block truncate mt-0.5 font-medium">
              {typingText ? (
                <span className="text-emerald-400 font-semibold">{typingText}</span>
              ) : isGroup ? (
                `Group Channel • ${activeChat.memberCount || activeChat.members?.length || 0} Members`
              ) : isOnline ? (
                'online'
              ) : (
                activeChat.lastSeen
                  ? `last seen ${new Date(activeChat.lastSeen).toLocaleDateString()} at ${formatTime(activeChat.lastSeen)}`
                  : 'offline'
              )}
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => startCall(activeChat.id, activeChat.displayName, activeChat.avatarUrl)}
            className="p-2 text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high rounded-xl transition"
            title="Start Audio Call"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            onClick={() => startCall(activeChat.id, activeChat.displayName, activeChat.avatarUrl, 'video')}
            className="p-2 text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high rounded-xl transition"
            title="Start Video Call"
          >
            <Video className="h-4 w-4" />
          </button>
          {isGroup ? (
            <button
              onClick={() => setShowGroupInfo(true)}
              className="p-2 text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high rounded-xl transition"
            >
              <Info className="h-4 w-4" />
            </button>
          ) : (
            <div className="relative" ref={chatMenuRef}>
              <button
                onClick={() => setShowChatMenu(prev => !prev)}
                className={`p-2 text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high rounded-xl transition ${showChatMenu ? 'bg-surface-container-high text-on-surface' : ''}`}
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showChatMenu && (
                <div className="absolute right-0 top-10 w-52 bg-surface/98 dark:bg-surface-container/98 border border-outline rounded-2xl shadow-elev4 py-1.5 z-50 text-on-surface">
                  {/* Pin / Unpin */}
                  <button
                    onClick={() => {
                      if (activeChat.isPinned) unpinChatAction(activeChat.id);
                      else pinChatAction(activeChat.id);
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-on-surface hover:bg-surface-container-high transition flex items-center gap-2"
                  >
                    {activeChat.isPinned
                      ? <><PinOff className="h-3.5 w-3.5 text-on-surface-faint" /> Unpin Chat</>
                      : <><Pin className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 rotate-45" /> Pin Chat</>}
                  </button>

                  {/* Block / Unblock */}
                  <button
                    onClick={() => {
                      setConfirmAction({ type: activeChat.isBlocked ? 'unblock' : 'block', friendId: activeChat.id, friendName: activeChat.displayName });
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-on-surface hover:bg-surface-container-high transition flex items-center gap-2"
                  >
                    <Ban className="h-3.5 w-3.5 text-amber-500" />
                    {activeChat.isBlocked ? 'Unblock User' : 'Block User'}
                  </button>

                  {/* Delete Chat */}
                  <button
                    onClick={() => {
                      setConfirmAction({ type: 'clearChatHistory', friendId: activeChat.id, friendName: activeChat.displayName });
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    Delete Chat
                  </button>

                  <div className="border-t border-outline-variant my-1" />

                  {/* Remove Friend */}
                  <button
                    onClick={() => {
                      setConfirmAction({ type: 'removeFriendship', friendId: activeChat.id, friendName: activeChat.displayName });
                      setShowChatMenu(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-rose-500 dark:text-rose-400 hover:bg-rose-500/15 transition flex items-center gap-2"
                  >
                    <UserMinus className="h-3.5 w-3.5 text-rose-500" />
                    Remove Friend
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Messages Banner */}
      {(() => {
        const pinnedMessage = [...messages].reverse().find(m => m.isPinned === 1);
        if (!pinnedMessage) return null;
        return (
          <div
            onClick={() => scrollToMessage(pinnedMessage.id)}
            className="px-4 py-2 glass-strong border border-white/30 dark:border-white/10 bg-surface-container/70 border-b border-outline/60 flex items-center justify-between cursor-pointer hover:bg-surface-container/40 backdrop-blur-md/60 transition backdrop-blur-md z-10"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs">📌</span>
              <div className="min-w-0 text-left">
                <span className="text-[9px] font-bold text-emerald-400 block leading-none font-sans">Pinned Message</span>
                <span className="text-[10px] text-on-surface-variant truncate block mt-0.5">
                  {pinnedMessage.type === 'deleted'
                    ? 'This message was deleted'
                    : pinnedMessage.type === 'text'
                      ? pinnedMessage.content
                      : `[${pinnedMessage.type}]`}
                </span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                pinMessage(pinnedMessage.id, false);
              }}
              className="p-1 text-on-surface-muted hover:text-zinc-350 rounded-lg transition"
              title="Unpin message"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {/* 3. MESSAGES SCROLL LIST */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 relative">
        <div className="max-w-4xl mx-auto w-full flex flex-col space-y-3 min-h-full justify-end">

        {messages.map((msg) => {
          const isMe = msg.senderId === user.id;
          const isHighlighted = highlightedMessageId === msg.id;

          // Render group system notifications differently
          if (!msg.receiverId && !msg.groupId && !msg.senderId) {
            // It's a system notice
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="px-3 py-1 bg-surface-container/75 backdrop-blur-xl border border-outline-variant rounded-full text-[9px] text-on-surface-muted tracking-wider uppercase font-medium">
                  {msg.content}
                </span>
              </div>
            );
          }

          // System message check (fallback based on content)
          const isSystem = msg.content.includes('created') || msg.content.includes('added') || msg.content.includes('left') || msg.content.includes('was added');
          if (isSystem && isGroup) {
            return (
              <div key={msg.id} className="flex justify-center my-2 w-full">
                <span className="px-3 py-1 bg-surface-container/85 backdrop-blur-xl border border-outline-variant rounded-full text-[9px] text-on-surface-muted font-medium text-center max-w-[80%]">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              ref={el => {
                if (el) messageRefs.current.set(msg.id, el);
                else messageRefs.current.delete(msg.id);
              }}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative msg-enter`}
            >
              <div
                onDoubleClick={() => {
                  if (msg.type !== 'deleted') {
                    setReplyingTo(msg);
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }
                }}
                className={`relative max-w-[75%] py-2.5 px-4 shadow-lg flex flex-col transition-all duration-300 ${isHighlighted ? 'ring-2 ring-emerald-500/60 scale-[1.02] bg-emerald-500/10' : ''
                  } ${isMe
                    ? 'bg-gradient-to-br from-emerald-600/90 to-emerald-700 text-white border border-emerald-500/20 rounded-2xl rounded-tr-sm shadow-emerald-950/20 bubble-out'
                    : 'bg-zinc-900/95 backdrop-blur-md border border-zinc-850/80 text-zinc-100 rounded-2xl rounded-tl-sm shadow-black/10 bubble-in'
                  }`}
                title={msg.type !== 'deleted' ? "Double-click to reply" : undefined}
              >
                {/* Sender Name in Groups */}
                {isGroup && !isMe && (
                  <span className="text-[9px] font-bold text-emerald-400 mb-0.5 leading-none">
                    {msg.senderName}
                  </span>
                )}

                {/* Reply Context Block */}
                {msg.parentMessageId && (
                  <div
                    onClick={() => scrollToMessage(msg.parentMessageId)}
                    className="mb-2 p-2 bg-black/35 hover:bg-black/50 transition border-l-3 border-emerald-500 rounded-r-xl text-left cursor-pointer select-none max-w-full"
                  >
                    <span className="text-[9px] font-bold text-emerald-400 block leading-tight font-sans">
                      {msg.parentMessageSenderId === user.id ? 'You' : msg.parentMessageSenderName}
                    </span>
                    <span className="text-[10px] text-on-surface-muted truncate block mt-0.5 font-sans">
                      {msg.parentMessageType === 'deleted'
                        ? 'This message was deleted'
                        : msg.parentMessageType === 'text'
                          ? msg.parentMessageContent
                          : `[${msg.parentMessageType}]`}
                    </span>
                  </div>
                )}

                {/* Inline Editing or normal rendering */}
                {msg.type === 'deleted' ? (
                  <p className="text-xs leading-relaxed italic text-on-surface-muted select-none flex items-center gap-1.5 py-0.5">
                    🚫 This message was deleted
                  </p>
                ) : editingMessageId === msg.id ? (
                  <div className="flex flex-col gap-2 w-full mt-1 min-w-[200px]">
                    <textarea
                      value={editInputText}
                      onChange={(e) => setEditInputText(e.target.value)}
                      className="w-full p-2 bg-surface/85 backdrop-blur-xl border border-white/40 dark:border-white/10 border border-outline rounded-lg text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMessageId(null)}
                        className="px-2.5 py-1 bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 hover:bg-surface-container-high/40 backdrop-blur-md text-zinc-350 rounded-md text-[10px] font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (editInputText.trim()) {
                            editMessage(msg.id, editInputText.trim());
                            setEditingMessageId(null);
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-md text-[10px] font-bold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Status Reply Message */}
                    {msg.type === 'status_reply' && (
                      <div className="flex flex-col gap-2.5 min-w-[240px] max-w-[290px]">
                        {(() => {
                          try {
                            const parsed = JSON.parse(msg.content);
                            return (
                              <>
                                {/* Glassmorphic Quoted Status Box */}
                                <div className="flex gap-2.5 p-2 bg-black/40 border-l-4 border-emerald-500 rounded-r-xl rounded-l-sm text-[10px] text-on-surface-variant items-center justify-between shadow-inner">
                                  <div className="flex flex-col min-w-0 pr-1 text-left">
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Status Update</span>
                                    <span className="truncate italic mt-0.5 text-on-surface-muted">
                                      {parsed.mediaType === 'video' ? '🎥 Video status' : '📷 Image status'}
                                    </span>
                                  </div>
                                  {parsed.mediaUrl && (
                                    <div className="h-9 w-9 bg-surface-container/85 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded overflow-hidden flex-shrink-0 border border-outline shadow-sm">
                                      {parsed.mediaType === 'video' ? (
                                        <video src={getAvatarUrl(parsed.mediaUrl)} className="h-full w-full object-cover" muted />
                                      ) : (
                                        <img src={getAvatarUrl(parsed.mediaUrl)} alt="Status update" className="h-full w-full object-cover" />
                                      )}
                                    </div>
                                  )}
                                </div>
                                {/* User's Text Reply */}
                                <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words pr-4">
                                  {parsed.text}
                                </p>
                              </>
                            );
                          } catch (err) {
                            return (
                              <p className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words italic text-on-surface-muted">
                                [Invalid status reply]
                              </p>
                            );
                          }
                        })()}
                      </div>
                    )}

                    {/* A: Text Content */}
                    {msg.type === 'text' && (
                      <p className={`leading-relaxed whitespace-pre-wrap select-text break-words ${hasOnlyEmojis(msg.content) ? 'text-3xl py-0.5' : 'text-xs'}`}>
                        {renderMessageContent(msg.content, activeChat.members)}
                      </p>
                    )}

                    {/* B: Image Media Attachment */}
                    {msg.type === 'image' && (
                      <div className="relative group/media max-w-[280px] my-1 rounded-xl overflow-hidden border border-outline">
                        <div
                          onClick={() => setLightboxImage(msg.content)}
                          className="cursor-pointer hover:opacity-90 transition duration-200"
                        >
                          <img src={getAvatarUrl(msg.content)} alt="Chat attachment" className="w-full h-auto object-cover max-h-48" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.content, `image_${msg.id}.png`);
                          }}
                          className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-surface-container/85 backdrop-blur-xl border border-white/30 dark:border-white/10/90 text-white hover:text-emerald-400 border border-outline rounded-lg backdrop-blur-sm opacity-0 group-hover/media:opacity-100 transition-opacity duration-200 shadow-lg"
                          title="Download image"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* C: Video Media Attachment */}
                    {msg.type === 'video' && (
                      <div className="relative group/media max-w-[280px] my-1 rounded-xl overflow-hidden border border-outline">
                        <video src={getAvatarUrl(msg.content)} controls className="w-full h-auto max-h-48" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.content, `video_${msg.id}.mp4`);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-surface-container/85 backdrop-blur-xl border border-white/30 dark:border-white/10/90 text-white hover:text-emerald-400 border border-outline rounded-lg backdrop-blur-sm opacity-0 group-hover/media:opacity-100 transition-opacity duration-200 shadow-lg z-10"
                          title="Download video"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* D: Audio Media Attachment */}
                    {msg.type === 'audio' && (
                      <div className="flex items-center gap-3 p-2 bg-surface/50 backdrop-blur-xl border border-white/25 dark:border-white/10 border border-outline rounded-xl my-1 min-w-[260px]">
                        <Volume2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <audio src={getAvatarUrl(msg.content)} controls className="w-full h-7 accent-emerald-500" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(msg.content, `audio_${msg.id}.mp3`);
                          }}
                          className="p-1.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-muted hover:text-emerald-500 dark:hover:text-emerald-400 border border-outline rounded-lg transition flex-shrink-0 backdrop-blur-md"
                          title="Download audio"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* E: Generic File Attachment */}
                    {msg.type === 'file' && (
                      <div
                        onClick={() => handleDownload(msg.content, 'attachment')}
                        className="flex items-center justify-between gap-3 p-2.5 bg-surface/50 backdrop-blur-xl border border-white/25 dark:border-white/10 border border-outline rounded-xl my-1 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5/20 transition duration-200 cursor-pointer min-w-[200px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                          <div className="min-w-0 text-left">
                            <p className="text-[11px] font-semibold text-white truncate leading-tight">Attachment</p>
                            <span className="text-[9px] text-on-surface-muted block mt-0.5">Click to download</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="p-1.5 bg-surface-container/85 backdrop-blur-xl border border-white/30 dark:border-white/10 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 text-on-surface-muted hover:text-emerald-400 border border-outline rounded-lg transition"
                          title="Download file"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                  </>
                )}

                {/* Bubble Footer Metadata Row */}
                <div className="flex items-center justify-end gap-1 mt-1.5 self-end leading-none">
                  {msg.isEdited === 1 && msg.type !== 'deleted' && (
                    <span className="text-[8px] text-on-surface-muted font-medium italic mr-1">edited</span>
                  )}
                  {msg.isPinned === 1 && msg.type !== 'deleted' && (
                    <span className="text-[9px] text-emerald-400 mr-1" title="Pinned message">📌</span>
                  )}
                  <span className="text-[9px] text-on-surface-muted font-medium">
                    {formatTime(msg.createdAt)}
                  </span>

                  {isMe && (
                    <div className="ml-1 flex items-center">
                      {msg.status === 'sent' && (
                        <Check className="h-3 w-3 text-on-surface-muted stroke-[2.5]" />
                      )}
                      {msg.status === 'delivered' && (
                        <div className="relative flex items-center w-[14px] h-3">
                          <Check className="absolute left-0 h-3 w-3 text-on-surface-muted stroke-[2.5]" />
                          <Check className="absolute left-[3.5px] h-3 w-3 text-on-surface-muted stroke-[2.5]" />
                        </div>
                      )}
                      {msg.status === 'read' && (
                        <div className="relative flex items-center w-[14px] h-3">
                          <Check className="absolute left-0 h-3 w-3 text-sky-400 stroke-[2.5]" />
                          <Check className="absolute left-[3.5px] h-3 w-3 text-sky-400 stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Interactive Emoji reaction display badge */}
                {msg.reaction && (
                  <span className="absolute -bottom-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 backdrop-blur-md border border-emerald-500/40 text-base shadow-md shadow-emerald-500/20 select-none heartbeat">
                    {msg.reaction}
                  </span>
                )}

                {/* Quick Hover Actions Bar (WhatsApp Style) */}
                {msg.type !== 'deleted' && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-0.5 glass-strong border border-white/30 dark:border-white/10 bg-surface-container/70 border border-outline/80 p-1 rounded-full shadow-xl backdrop-blur-md ${isMe ? 'right-full mr-2.5' : 'left-full ml-2.5'
                      }`}
                  >
                    {/* Reply Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingTo(msg);
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }}
                      className="p-1.5 text-on-surface-muted hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-surface-container-high rounded-full transition-all duration-150 active:scale-95 hover-wiggle"
                      title="Reply"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>

                    {/* Pin Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pinMessage(msg.id, msg.isPinned !== 1);
                      }}
                      className="p-1.5 text-on-surface-muted hover:text-amber-500 dark:hover:text-amber-400 hover:bg-surface-container-high rounded-full transition-all duration-150 active:scale-95 hover-wiggle"
                      title={msg.isPinned === 1 ? "Unpin" : "Pin"}
                    >
                      <Pin className={`h-3.5 w-3.5 ${msg.isPinned === 1 ? 'text-amber-400 fill-amber-400/20' : ''}`} />
                    </button>

                    {/* More Actions Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMessageId(prev => prev === msg.id ? null : msg.id);
                        }}
                        className={`p-1.5 text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high rounded-full transition-all duration-150 active:scale-95 hover-wiggle ${activeMenuMessageId === msg.id ? 'bg-surface-container-high text-on-surface' : ''}`}
                        title="More options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>

                      {/* Glassmorphic Dropdown Actions Menu */}
                      {activeMenuMessageId === msg.id && (
                        <div className={`message-dropdown-container absolute z-40 w-36 p-1.5 bg-surface/98 dark:bg-surface-container/98 border border-outline rounded-xl shadow-2xl flex flex-col gap-0.5 backdrop-blur-md ${isMe ? 'right-0 top-8' : 'left-0 top-8'
                          }`}>
                          {/* Emojis Reaction Row inside Dropdown */}
                          <div className="flex justify-between items-center border-b border-outline/60 pb-1.5 pt-0.5 px-1 mb-1 gap-0.5">
                            {emojis.slice(0, 5).map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reactMessage(msg.id, msg.reaction === emoji ? null : emoji);
                                  setActiveMenuMessageId(null);
                                }}
                                className="text-base emoji-react transition-transform duration-150 p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          {/* Edit Option (Sender & text messages only) */}
                          {isMe && msg.type === 'text' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMessageId(msg.id);
                                setEditInputText(msg.content);
                                setActiveMenuMessageId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 text-left text-[11px] font-semibold text-on-surface-variant hover:text-white rounded-lg transition"
                            >
                              <Pencil className="h-3.5 w-3.5 text-on-surface-faint" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Delete Option (Sender only) */}
                          {isMe && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this message?')) {
                                  deleteMessage(msg.id);
                                }
                                setActiveMenuMessageId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 text-left text-[11px] font-semibold text-red-400 hover:text-red-300 rounded-lg transition"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}

        {/* typing indicator bubbles */}
        {typingText && (
          <div className="flex justify-start msg-enter">
            <div className="bubble-in px-4 py-2.5 rounded-2xl shadow flex items-center gap-2.5">
              <div className="flex items-end gap-1 h-4">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-emerald-500 to-pink-500 typing-dot"
                    style={{ height: `${6 + i * 2}px`, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-on-surface-muted font-medium">{typingText.split(' ')[0]} is typing</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 4. CHAT INPUT ATTACHMENT MENU / QUICK ACTION MENU */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 15, opacity: 0 }}
            className="absolute bottom-20 left-4 p-3 bg-surface-container/85 backdrop-blur-xl border border-white/30 dark:border-white/10 border border-outline rounded-2xl shadow-2xl flex flex-col gap-2 z-20 min-w-[150px]"
          >
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-xl cursor-pointer text-xs font-semibold text-on-surface-variant hover:text-white transition">
              <ImageIcon className="h-5 w-5 text-emerald-400" />
              <span>Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
            </label>
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-xl cursor-pointer text-xs font-semibold text-on-surface-variant hover:text-white transition">
              <Film className="h-5 w-5 text-sky-400" />
              <span>Video</span>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
            </label>
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-xl cursor-pointer text-xs font-semibold text-on-surface-variant hover:text-white transition">
              <Volume2 className="h-5 w-5 text-amber-400" />
              <span>Audio</span>
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'audio')} />
            </label>
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-xl cursor-pointer text-xs font-semibold text-on-surface-variant hover:text-white transition">
              <FileText className="h-5 w-5 text-indigo-400" />
              <span>Document</span>
              <input type="file" accept="*" className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Threaded Reply Preview Card */}
      {replyingTo && (
        <div className="mx-4 mb-2 p-3 bg-surface-container/85 backdrop-blur-xl border border-outline-variant rounded-2xl flex items-center justify-between backdrop-blur-md z-10 border-l-4 border-l-emerald-500 shadow-lg">
          <div className="flex items-center gap-2 min-w-0 pl-1">
            <div className="text-left min-w-0">
              <span className="text-[9px] font-bold text-emerald-400 block leading-tight font-sans">
                Replying to {replyingTo.senderId === user.id ? 'yourself' : replyingTo.senderName}
              </span>
              <span className="text-[10px] text-on-surface-variant truncate block mt-0.5 font-sans">
                {replyingTo.type === 'deleted'
                  ? 'This message was deleted'
                  : replyingTo.type === 'text'
                    ? replyingTo.content
                    : `[${replyingTo.type}]`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 text-on-surface-muted hover:text-on-surface-variant rounded-lg transition"
            title="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 5. BOTTOM TEXT ENTRY BOX — Modern Integrated Composer */}
      <div className="w-full max-w-4xl mx-auto px-4 z-20">
        <form
          onSubmit={handleSend}
          className="mb-4 mt-1 h-14 bg-transparent border border-outline rounded-2xl flex items-center gap-2.5 px-3 relative shadow-md transition-all duration-200 input-glow-ring"
          style={{ marginBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
        <button
          type="button"
          onClick={() => {
            setShowAttachMenu(prev => !prev);
            setShowEmojiPicker(false);
          }}
          className={`p-2 text-on-surface-muted hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition flex-shrink-0 hover-wiggle ${showAttachMenu ? 'bg-emerald-500/15 text-emerald-400' : ''}`}
          title="Attach media"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="flex-1 relative flex items-center">
          <AnimatePresence>
            {showMentionDropdown && filteredMembers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 mb-3 w-72 max-h-60 bg-surface-container/95 border border-outline rounded-2xl shadow-2xl overflow-y-auto z-50 py-2 custom-scrollbar"
              >
                <div className="px-3 py-1 text-[10px] font-bold text-on-surface-muted uppercase tracking-wider border-b border-outline/40 mb-1">
                  Mention Group Member
                </div>
                {filteredMembers.map((member, idx) => {
                  const isSelected = idx === mentionSelectedIndex;
                  return (
                    <div
                      key={member.id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevents input from losing focus
                        selectMention(member);
                      }}
                      onMouseEnter={() => setMentionSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition duration-150 ${isSelected
                        ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                        : 'text-on-surface-variant hover:bg-surface-container-high/45 border-l-2 border-transparent'
                        }`}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={getAvatarUrl(member.avatarUrl)}
                          alt={member.displayName}
                          className="h-6 w-6 rounded-full object-cover border border-outline"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-surface-container-high/85 border border-outline-variant flex items-center justify-center font-bold text-[10px] text-on-surface-muted uppercase">
                          {getInitials(member.displayName)}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold truncate leading-tight">
                          {member.displayName}
                        </span>
                        <span className="text-[9px] text-on-surface-muted truncate">
                          @{member.displayName.toLowerCase().replace(/\s+/g, '')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={inputText.trim() ? '' : 'Type a message…'}
            className="block w-full bg-transparent border-0 px-2 py-1.5 focus:outline-none focus:ring-0 text-on-surface placeholder-on-surface-muted/50 text-sm"
          />
        </div>

        <div className="relative flex items-center flex-shrink-0">
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-3 z-50">
              <EmojiPicker onSelect={handleEmojiSelect} />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(prev => !prev);
              setShowAttachMenu(false);
            }}
            className={`p-2 text-on-surface-muted hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition ${showEmojiPicker ? 'text-amber-400 bg-amber-500/10' : ''}`}
            title="Emojis"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        {/* Send button with gradient blob, shine, and confetti burst */}
        <button
          type="submit"
          disabled={!inputText.trim()}
          onClick={(e) => {
            if (!inputText.trim()) return;
            const btn = e.currentTarget;
            spawnConfetti(btn);
          }}
          className="relative p-2.5 rounded-2xl flex-shrink-0 shine-effect transition-all duration-200
                     bg-gradient-to-br from-emerald-500 via-emerald-400 to-indigo-500
                     text-white shadow-lg shadow-emerald-500/30 border border-white/20 dark:border-white/10
                     hover:shadow-emerald-500/50 hover:brightness-110
                     active:scale-95 hover-pop
                     disabled:bg-surface-container-high disabled:text-on-surface-faint
                     disabled:border-outline-variant disabled:shadow-none disabled:hover:brightness-100"
          aria-label="Send message"
        >
          <Send className="h-5 w-5 relative z-10" strokeWidth={2.4} />
          <span aria-hidden="true" className="absolute inset-0 rounded-2xl confetti-host pointer-events-none" />
        </button>
        </form>
      </div>

      {/* 7. FULLSCREEN LIGHTBOX FOR IMAGES */}
      <AnimatePresence>
        {lightboxImage && (
          <div
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            {/* Action Bar inside Lightbox */}
            <div className="absolute top-4 right-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleDownload(lightboxImage, 'image.png')}
                className="p-2 bg-surface-container/85 backdrop-blur-xl border border-outline text-white hover:text-emerald-400 rounded-full hover:bg-surface-container-high/80 transition duration-150 shadow-lg"
                title="Download image"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 bg-surface-container/85 backdrop-blur-xl border border-white/30 dark:border-white/10 text-white rounded-full border border-outline hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 transition duration-150 shadow-lg"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={getAvatarUrl(lightboxImage)}
              alt="Attachment Full size"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </AnimatePresence>


      {/* 8. SLIDE-OUT INFO DRAWER */}
      <AnimatePresence>
        {showGroupInfo && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs z-30 flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-xs h-full bg-surface-container/85 backdrop-blur-xl border-l border-outline p-6 flex flex-col justify-between overflow-y-auto"
            >
              {isGroup ? (
                // GROUP INFO SIDEBAR
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Group Info</h3>
                    <button
                      onClick={() => setShowGroupInfo(false)}
                      className="p-1 text-on-surface-muted hover:text-white hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-lg transition"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Group Details */}
                  <div className="flex flex-col items-center text-center pb-6 border-b border-outline">
                    {activeChat.avatarUrl ? (
                      <img src={getAvatarUrl(activeChat.avatarUrl)} alt="Group" className="h-16 w-16 rounded-full object-cover border border-outline" />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-500/10 border border-outline flex items-center justify-center text-emerald-400 font-bold text-lg">
                        <Users2 className="h-8 w-8" />
                      </div>
                    )}
                    <h4 className="text-sm font-bold text-white mt-3 leading-tight">{activeChat.name}</h4>
                    <p className="text-[10px] text-on-surface-muted mt-1 max-w-[180px]">{activeChat.description || 'No description provided.'}</p>
                  </div>

                  {/* Members list */}
                  <div className="py-6">
                    {activeChat.members?.find(m => m.id === user.id)?.role === 'admin' && (
                      <button
                        onClick={() => setShowAddMemberModal(true)}
                        className="w-full mb-4 py-2 px-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" /> Add Member
                      </button>
                    )}
                    <h5 className="text-[10px] uppercase font-bold tracking-wider text-on-surface-muted mb-3">Members ({activeChat.members?.length || 0})</h5>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {activeChat.members?.map(member => (
                        <div key={member.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {member.avatarUrl ? (
                              <img src={getAvatarUrl(member.avatarUrl)} alt={member.displayName} className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 flex items-center justify-center text-[9px] font-bold text-on-surface-variant uppercase">
                                {getInitials(member.displayName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-white truncate block">{member.displayName}</span>
                            </div>
                          </div>

                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${member.role === 'admin'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 text-on-surface-muted'
                            }`}>
                            {member.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline">
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to leave this group chat?')) {
                          leaveGroup(activeChat.id);
                          setShowGroupInfo(false);
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="h-4 w-4" /> Leave Group Channel
                    </button>
                  </div>
                </div>
              ) : (
                // FRIEND PROFILE SIDEBAR
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Friend Profile</h3>
                      <button
                        onClick={() => setShowGroupInfo(false)}
                        className="p-1 text-on-surface-muted hover:text-white hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 rounded-lg transition"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Centered Avatar and Name */}
                    <div className="flex flex-col items-center text-center pb-6 border-b border-outline">
                      <div className="relative">
                        {activeChat.avatarUrl ? (
                          <img src={getAvatarUrl(activeChat.avatarUrl)} alt={activeChat.displayName} className="h-20 w-20 rounded-full object-cover border-2 border-outline shadow-xl" />
                        ) : (
                          <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-emerald-500/20 to-emerald-500/10 border-2 border-outline flex items-center justify-center text-emerald-400 font-bold text-2xl uppercase shadow-xl">
                            {getInitials(activeChat.displayName)}
                          </div>
                        )}
                        {activeChat.status === 'online' && (
                          <span className="absolute bottom-0 right-0 h-4 w-4 bg-emerald-500 border-4 border-outline-variant rounded-full animate-pulse"></span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-white mt-4 leading-tight">{activeChat.displayName}</h4>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-2 inline-block ${activeChat.status === 'online'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        : 'bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 text-on-surface-muted border border-zinc-750'
                        }`}>
                        {activeChat.status === 'online' ? 'Active now' : 'Offline'}
                      </span>
                    </div>

                    {/* Detailed Metadata fields */}
                    <div className="py-6 space-y-5">
                      {/* Email address */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-on-surface-faint flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-on-surface-muted" /> Email Address
                        </span>
                        <span className="text-xs text-on-surface block bg-surface/40 backdrop-blur-lg border border-white/25 dark:border-white/5 border border-outline/50 p-2.5 rounded-xl break-all">
                          {activeChat.email || 'N/A'}
                        </span>
                      </div>

                      {/* Bio Status */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-on-surface-faint flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-on-surface-muted" /> Personal Bio
                        </span>
                        <p className="text-xs text-on-surface-variant bg-surface/40 backdrop-blur-lg border border-white/25 dark:border-white/5 border border-outline/50 p-2.5 rounded-xl leading-relaxed whitespace-pre-wrap">
                          {activeChat.bio || 'Hey there! I am using Talkzen.'}
                        </p>
                      </div>

                      {/* Last Seen indicator */}
                      {activeChat.status !== 'online' && activeChat.lastSeen && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-on-surface-faint flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-on-surface-muted" /> Last Active
                          </span>
                          <span className="text-xs text-on-surface-muted block bg-surface-container-low/70 border border-outline p-2.5 rounded-xl font-mono backdrop-blur-md">
                            {new Date(activeChat.lastSeen).toLocaleDateString()} at {formatTime(activeChat.lastSeen)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Chat Action Buttons ── */}
                  <div className="pt-5 border-t border-outline/60 space-y-2">
                    <h5 className="text-[10px] uppercase font-bold tracking-wider text-on-surface-muted mb-3">Chat Actions</h5>

                    {/* Pin / Unpin */}
                    <button
                      onClick={() => {
                        if (activeChat.isPinned) unpinChatAction(activeChat.id);
                        else pinChatAction(activeChat.id);
                        setShowGroupInfo(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-container-high/45 backdrop-blur-md border border-white/10 dark:border-white/5 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 text-on-surface-variant hover:text-white transition text-xs font-medium"
                    >
                      {activeChat.isPinned
                        ? <><PinOff className="h-4 w-4 text-on-surface-muted flex-shrink-0" /> Unpin Chat</>
                        : <><Pin className="h-4 w-4 text-emerald-400 rotate-45 flex-shrink-0" /> Pin Chat</>}
                    </button>

                    {/* Block / Unblock */}
                    <button
                      onClick={() => setConfirmAction({ type: activeChat.isBlocked ? 'unblock' : 'block', friendId: activeChat.id, friendName: activeChat.displayName })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-container-high/45 backdrop-blur-md border border-white/10 dark:border-white/5 hover:bg-amber-500/10 text-on-surface-variant hover:text-amber-400 transition text-xs font-medium"
                    >
                      <Ban className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      {activeChat.isBlocked ? 'Unblock User' : 'Block User'}
                    </button>

                    {/* Remove Chat */}
                    <button
                      onClick={() => setConfirmAction({ type: 'removeChat', friendId: activeChat.id, friendName: activeChat.displayName })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-container-high/45 backdrop-blur-md border border-white/10 dark:border-white/5 hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 text-on-surface-variant hover:text-white transition text-xs font-medium"
                    >
                      <EyeOff className="h-4 w-4 text-on-surface-muted flex-shrink-0" />
                      Remove Chat
                    </button>

                    {/* Remove Friend */}
                    <button
                      onClick={() => setConfirmAction({ type: 'removeFriendship', friendId: activeChat.id, friendName: activeChat.displayName })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition text-xs font-medium border border-rose-500/10"
                    >
                      <UserMinus className="h-4 w-4 text-rose-500 flex-shrink-0" />
                      Remove Friend
                    </button>
                  </div>

                  {/* Close connection indicator */}
                  <div className="pt-4 border-t border-outline text-center mt-4">
                    <span className="text-[9px] uppercase tracking-widest text-on-surface-faint font-bold block">
                      End-to-End Encrypted Session
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= CHAT ACTION CONFIRM MODAL ================= */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-surface-container/85 backdrop-blur-xl border border-outline rounded-2xl shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                {confirmAction.type === 'block' && <Ban className="h-5 w-5 text-amber-500" />}
                {confirmAction.type === 'unblock' && <Ban className="h-5 w-5 text-emerald-500" />}
                {confirmAction.type === 'clearChatHistory' && <Trash2 className="h-5 w-5 text-rose-500" />}
                {confirmAction.type === 'removeFriendship' && <UserMinus className="h-5 w-5 text-rose-500" />}
                <h3 className="text-sm font-bold text-white">
                  {confirmAction.type === 'block' && 'Block User'}
                  {confirmAction.type === 'unblock' && 'Unblock User'}
                  {confirmAction.type === 'clearChatHistory' && 'Delete Chat'}
                  {confirmAction.type === 'removeFriendship' && 'Remove Friend'}
                </h3>
              </div>
              <p className="text-xs text-on-surface-muted mb-6 leading-relaxed">
                {confirmAction.type === 'block' && `Are you sure you want to block ${confirmAction.friendName}? You will no longer receive messages from them.`}
                {confirmAction.type === 'unblock' && `Are you sure you want to unblock ${confirmAction.friendName}?`}
                {confirmAction.type === 'clearChatHistory' && `Are you sure you want to delete all chat history with ${confirmAction.friendName} from your end? This action is permanent.`}
                {confirmAction.type === 'removeFriendship' && `Remove ${confirmAction.friendName} from your friends list? This will also delete your chat history.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 px-4 bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 hover:bg-surface-container-low/80 backdrop-blur-md border border-white/10 dark:border-white/5 text-on-surface-variant font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmChatAction}
                  className={`flex-1 py-2.5 px-4 font-semibold rounded-xl text-xs transition ${confirmAction.type === 'removeFriendship' || confirmAction.type === 'block' || confirmAction.type === 'clearChatHistory'
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                    }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= ADD MEMBER MODAL OVERLAY ================= */}
      <AnimatePresence>
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm p-6 bg-surface-container/85 backdrop-blur-xl border border-outline rounded-2xl shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedFriendsToGroup([]);
                }}
                className="absolute top-4 right-4 p-1 text-on-surface-muted hover:text-white rounded-lg hover:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 transition"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Users2 className="h-5 w-5 text-emerald-400" /> Add Members to Group
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-muted">Select Friends</span>
                  <div className="max-h-48 overflow-y-auto border border-outline/50 rounded-xl p-2 space-y-1 bg-surface/50 backdrop-blur-xl border border-white/25 dark:border-white/10">
                    {friends
                      .filter(f => f.friendshipStatus === 'accepted')
                      .filter(f => !activeChat.members?.some(m => m.id === f.id))
                      .map(friend => {
                        const isChecked = selectedFriendsToGroup.includes(friend.id);
                        return (
                          <div
                            key={friend.id}
                            onClick={() => {
                              setSelectedFriendsToGroup(prev =>
                                prev.includes(friend.id)
                                  ? prev.filter(id => id !== friend.id)
                                  : [...prev, friend.id]
                              );
                            }}
                            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-container/40 backdrop-blur-md cursor-pointer text-left transition"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="accent-emerald-500 h-4 w-4 rounded border-zinc-750 bg-surface/85 backdrop-blur-xl border border-white/40 dark:border-white/10"
                            />
                            {friend.avatarUrl ? (
                              <img src={getAvatarUrl(friend.avatarUrl)} alt={friend.displayName} className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 flex items-center justify-center text-[8px] font-bold text-on-surface-muted uppercase">
                                {getInitials(friend.displayName)}
                              </div>
                            )}
                            <span className="text-xs font-medium text-on-surface">{friend.displayName}</span>
                          </div>
                        );
                      })}

                    {friends.filter(f => f.friendshipStatus === 'accepted').filter(f => !activeChat.members?.some(m => m.id === f.id)).length === 0 && (
                      <div className="text-center py-6 text-on-surface-muted text-xs">All active friends are already members of this group.</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setSelectedFriendsToGroup([]);
                    }}
                    className="flex-1 py-2 px-4 bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 hover:bg-surface-container-high/40 backdrop-blur-md text-on-surface-variant font-bold rounded-xl text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedFriendsToGroup.length === 0}
                    onClick={async () => {
                      try {
                        await addGroupMembers(activeChat.id, selectedFriendsToGroup);
                        setShowAddMemberModal(false);
                        setSelectedFriendsToGroup([]);
                      } catch (err) {
                        alert(err.message || 'Failed to add members.');
                      }
                    }}
                    className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-surface-container-high/80 backdrop-blur-md border border-white/20 dark:border-white/5 disabled:text-on-surface-faint text-zinc-950 font-bold rounded-xl text-xs shadow transition"
                  >
                    Add ({selectedFriendsToGroup.length})
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default ChatWindow;
