import React, { useState, useEffect } from 'react';
import { Search, Clock } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌',
      '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
      '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
      '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱',
      '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🤫', '🤥', '😶', '😐', '😑',
      '😬', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫'
    ]
  },
  {
    name: 'Gestures',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
      '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾'
    ]
  },
  {
    name: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💋', '🫂'
    ]
  },
  {
    name: 'Animals',
    icon: '🐱',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽',
      '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅',
      '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷️', '🕸️',
      '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
      '🐬', '🐳', '🐋', '🦈', '🐊', '🐆', '🐅', '🐘', '🦏', '🦛', '🐐', '🐏', '🐑'
    ]
  },
  {
    name: 'Food',
    icon: '🍏',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
      '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒',
      '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🍳', '🥞', '🧇', '🥓',
      '🥩', '🍗', '🍖', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥘', '🍲', '🥣', '🥗',
      '🍿', '🧈', '🧂', '🍱', '🍙', '🍚', '🍛', '🍜', '🍝', '🍣', '🍤', '🍦', '🍩',
      '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '☕', '🍵', '🧋'
    ]
  },
  {
    name: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒',
      '🏑', '🥍', '🏏', '🏹', '🎣', '🤿', '🥊', '🥋', '🥅', '⛳', '⛸️', '⛷️', '🎯',
      '🎮', '🕹️', '🎰', '🎲', '🧩', '🧸', '🪄', '🎨', '🎭', '🎫', '🎤', '🎧', '🎼', '🎹',
      '🥁', '🎷', '🎺', '🎸', '🎻'
    ]
  },
  {
    name: 'Objects',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🕯️', '🔌', '🔋', '💻', '🖥️', '⌨️', '🖱️', '📷', '📸', '📹', '🎥', '📞',
      '☎️', '📠', '📺', '📻', '🎙️', '🧭', '⏱️', '⏰', '📅', '🗓️', '📦', '✉️', '📨', '📩',
      '📝', '💼', '📁', '📂', '📊', '📰', '📓', '📕', '📗', '📘', '📙', '📚', '📖',
      '🔖', '🔗', '📎', '📐', '📏', '📌', '📍', '✂️', '🔒', '🔓', '🔑', '🔨', '🛡️', '🔧'
    ]
  },
  {
    name: 'Nature',
    icon: '🌸',
    emojis: [
      '🌸', '💐', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿',
      '🍀', '🍁', '🍂', '🍃', '🍄', '🌰', '🌙', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '🌈',
      '☀️', '🌤️', '⛅', '🌧️', '🌩️', '❄️', '☃️', '⛄', '💧', '💦', '🌊'
    ]
  }
];

const RECENTS_KEY = 'talkzen_emoji_recents';
const MAX_RECENTS = 18;

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecents(list) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    /* storage full / disabled */
  }
}

function EmojiPicker({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [recents, setRecents] = useState(loadRecents);

  const handleSelect = (emoji) => {
    setRecents((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
      saveRecents(next);
      return next;
    });
    onSelect(emoji);
  };

  // Filter emojis based on search
  const filteredEmojis = (() => {
    if (!searchQuery.trim()) {
      return EMOJI_CATEGORIES.find((c) => c.name === activeCategory)?.emojis || [];
    }
    const allEmojis = EMOJI_CATEGORIES.reduce((acc, cat) => [...acc, ...cat.emojis], []);
    return allEmojis.filter((e) => e.includes(searchQuery));
  })();

  return (
    <div className="w-72 h-80 bg-white/95 dark:glass-strong border border-white/30 dark:border-white/10 bg-surface/70 backdrop-blur-xl border border-zinc-200/70 dark:border-outline/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden select-none font-sans">
      {/* Search bar with gradient border on focus */}
      <div className="p-2.5 border-b border-zinc-200/70 dark:border-outline/60">
        <div className="relative group">
          <Search className="h-3.5 w-3.5 text-on-surface-muted absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-500 transition" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emojis..."
            className="w-full pl-8 pr-3 py-2 bg-surface-container-high backdrop-blur/70 backdrop-blur/80 dark:bg-surface-container/75 backdrop-blur-xl border border-white/30 dark:border-white/10 border border-zinc-200/70 dark:border-outline/70 rounded-xl text-zinc-900 dark:text-on-surface placeholder-zinc-500 text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition-all"
          />
        </div>
      </div>

      {/* Recents strip */}
      {!searchQuery.trim() && recents.length > 0 && (
        <div className="px-2 pt-2 pb-1.5 border-b border-zinc-200/70 dark:border-outline/60 bg-surface-container-high backdrop-blur/40 backdrop-blur dark:bg-surface-container/50 backdrop-blur-lg border border-white/20 dark:border-white/5">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-muted flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> Recents
            </span>
          </div>
          <div className="grid grid-cols-9 gap-0.5">
            {recents.map((emoji, idx) => (
              <button
                key={`r-${idx}-${emoji}`}
                type="button"
                onClick={() => handleSelect(emoji)}
                className="text-base hover:bg-emerald-500/15 hover:scale-130 active:scale-90 transition-transform duration-150 p-0.5 rounded-md"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      {!searchQuery.trim() && (
        <div className="flex justify-between px-2 py-2 bg-surface-container-high/60 backdrop-blur backdrop-blur dark:bg-surface-container/35 backdrop-blur-md border border-white/20 dark:border-white/5 border-b border-zinc-200/50 dark:border-outline/40">
          {EMOJI_CATEGORIES.map((category) => (
            <button
              key={category.name}
              type="button"
              onClick={() => setActiveCategory(category.name)}
              title={category.name}
              className={`text-base p-1.5 rounded-lg transition-all duration-200 hover-pop
                ${activeCategory === category.name
                  ? 'bg-gradient-to-br from-emerald-500/25 to-indigo-500/25 scale-110 border border-emerald-400/40 shadow-md shadow-emerald-500/20'
                  : 'opacity-60 hover:opacity-100 hover:bg-surface-container-high/70 backdrop-blur dark:hover:bg-surface-container-high/65 backdrop-blur-md border border-white/15 dark:border-white/5'}
              `}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emojis Grid */}
      <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar bg-zinc-200/70 backdrop-blur backdrop-blur/40 dark:bg-surface/40 backdrop-blur-lg border border-white/25 dark:border-white/5">
        {searchQuery.trim() && (
          <div className="text-[9px] font-bold text-on-surface-muted uppercase tracking-wider mb-2 px-1">
            {filteredEmojis.length} result{filteredEmojis.length === 1 ? '' : 's'}
          </div>
        )}
        <div className="grid grid-cols-7 gap-1">
          {filteredEmojis.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              type="button"
              onClick={() => handleSelect(emoji)}
              className="text-lg hover:scale-150 hover:rotate-12 active:scale-75 transition-all duration-150 p-1 rounded-lg hover:bg-emerald-500/15 flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}

          {filteredEmojis.length === 0 && (
            <div className="col-span-7 text-center py-10 text-on-surface-muted text-[11px]">
              <div className="text-2xl mb-2">🤔</div>
              No emojis found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmojiPicker;
