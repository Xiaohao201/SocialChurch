import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Smile, Heart, Coffee, Gamepad2, Laptop, Hash } from 'lucide-react';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  triggerElement?: React.RefObject<HTMLElement>;
}

// 优化的表情分类 - 添加图标和更精简的表情
const emojiCategories = {
  recent: {
    name: '最近',
    icon: '🕒',
    emojis: [] as string[] // 将由最近使用的表情填充
  },
  smileys: {
    name: '笑脸',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱']
  },
  people: {
    name: '人物',
    icon: '👋',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸']
  },
  animals: {
    name: '动物',
    icon: '🐶',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔']
  },
  food: {
    name: '食物',
    icon: '🍎',
    emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯']
  },
  activities: {
    name: '活动',
    icon: '⚽',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️‍♂️', '🤼', '🤸‍♀️', '🤸‍♂️', '⛹️‍♀️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾‍♂️', '🏌️‍♀️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘‍♂️', '🏄‍♀️', '🏄‍♂️', '🏊‍♀️', '🏊‍♂️', '🤽‍♀️', '🤽‍♂️', '🚣‍♀️', '🚣‍♂️', '🧗‍♀️', '🧗‍♂️', '🚵‍♀️', '🚵‍♂️', '🚴‍♀️', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🥁', '🪘', '🎹', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩']
  },
  travel: {
    name: '旅行',
    icon: '✈️',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛰️', '🚢', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🎡', '🎢', '🎠', '🏗️', '🌁', '🗼', '🏭', '⛲', '🎑', '⛰️', '🏔️', '🗻', '🌋', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️']
  },
  objects: {
    name: '物品',
    icon: '📱',
    emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🪩']
  },
  symbols: {
    name: '符号',
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
  }
};

// 最近使用的表情的 localStorage key
const RECENT_EMOJIS_KEY = 'recent-emojis';
const MAX_RECENT_EMOJIS = 32;

// 表情名称映射（用于搜索）
const emojiNameMap: { [key: string]: string[] } = {
  '😀': ['笑', '开心', 'grin', 'smile', '高兴'],
  '😂': ['哭笑', '大笑', 'lol', '搞笑', '有趣'],
  '😍': ['爱心', '喜欢', 'love', '心动', '迷恋'],
  '😊': ['微笑', 'smile', '开心', '愉快'],
  '😭': ['哭', 'cry', '伤心', '难过'],
  '😘': ['飞吻', 'kiss', '亲亲', '爱你'],
  '🥰': ['可爱', 'cute', '萌', '爱心'],
  '😴': ['睡觉', 'sleep', '困', '累'],
  '😅': ['尴尬', '汗', '无奈'],
  '🤔': ['思考', 'think', '想想'],
  '👍': ['赞', 'good', '好', '支持', '点赞'],
  '👎': ['踩', 'bad', '不好', '反对'],
  '❤️': ['爱心', 'love', '红心', '喜欢'],
  '🔥': ['火', 'fire', '热', '厉害'],
  '👏': ['鼓掌', 'clap', '赞扬', '加油'],
  '🙏': ['祈祷', 'pray', '拜托', '感谢'],
  '💪': ['肌肉', 'strong', '力量', '加油'],
  '🎉': ['庆祝', 'party', '恭喜', '开心'],
  '🥳': ['庆祝', 'party', '生日', '狂欢'],
  '😎': ['酷', 'cool', '厉害', '帅'],
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({ 
  isOpen, 
  onClose, 
  onEmojiSelect, 
  triggerElement 
}) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const emojiGridRef = useRef<HTMLDivElement>(null);

  // 加载最近使用的表情
  useEffect(() => {
    try {
      const recent = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (recent) {
        const parsedRecent = JSON.parse(recent);
        const recentArray = Array.isArray(parsedRecent) ? parsedRecent : [];
        setRecentEmojis(recentArray);
      }
    } catch (error) {
      console.warn('Failed to load recent emojis:', error);
    }
  }, []); // 只在组件挂载时运行一次

  // 更新最近使用的表情
  const updateRecentEmojis = useCallback((emoji: string) => {
    try {
      setRecentEmojis(prev => {
        const filtered = prev.filter(e => e !== emoji);
        const newRecent = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(newRecent));
        return newRecent;
      });
    } catch (error) {
      console.warn('Failed to save recent emoji:', error);
    }
  }, []);

  // 获取表情的搜索权重（用于排序）
  const getEmojiWeight = useCallback((emoji: string, query: string) => {
    const names = emojiNameMap[emoji] || [];
    const lowerQuery = query.toLowerCase();
    
    // 完全匹配权重最高
    if (names.some(name => name === lowerQuery)) return 100;
    
    // 开头匹配权重较高
    if (names.some(name => name.startsWith(lowerQuery))) return 80;
    
    // 包含匹配权重一般
    if (names.some(name => name.includes(lowerQuery))) return 60;
    
    // 表情符号直接匹配
    if (emoji.includes(lowerQuery)) return 40;
    
    return 0;
  }, []);

  // 处理表情选择
  const handleEmojiSelect = useCallback((emoji: string) => {
    updateRecentEmojis(emoji);
    onEmojiSelect(emoji);
    onClose();
  }, [updateRecentEmojis, onEmojiSelect, onClose]);

  // 合并最近使用的表情到分类中
  const categoriesWithRecent = useMemo(() => {
    const categories = { ...emojiCategories };
    if (recentEmojis.length > 0) {
      categories.recent.emojis = recentEmojis;
    }
    return categories;
  }, [recentEmojis]);

  // 搜索过滤表情
  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoriesWithRecent[activeCategory as keyof typeof categoriesWithRecent]?.emojis || [];
    }

    const query = searchQuery.toLowerCase();
    const allEmojis: string[] = [];
    
    Object.values(categoriesWithRecent).forEach(category => {
      allEmojis.push(...category.emojis);
    });

    // 智能搜索：支持表情名称和描述，并按相关性排序
    const matchedEmojis = allEmojis
      .map(emoji => ({
        emoji,
        weight: getEmojiWeight(emoji, query)
      }))
      .filter(item => item.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .map(item => item.emoji);

         return matchedEmojis;
  }, [searchQuery, activeCategory, categoriesWithRecent, getEmojiWeight]);

  // 增强的键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // 如果焦点在按钮或分类按钮上，不处理键盘事件
      if (e.target && (
        (e.target as HTMLElement).tagName === 'BUTTON' ||
        (e.target as HTMLElement).getAttribute('role') === 'button'
      )) {
        return;
      }

      const availableCategories = Object.entries(categoriesWithRecent).filter(([key, category]) => {
        if (key === 'recent') {
          return category.emojis.length > 0;
        }
        return true;
      });

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
          
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && filteredEmojis[selectedIndex]) {
            handleEmojiSelect(filteredEmojis[selectedIndex]);
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (filteredEmojis.length > 0) {
            setSelectedIndex(prev => {
              const newIndex = prev <= 0 ? filteredEmojis.length - 1 : prev - 8; // 上移一行（8个表情）
              return Math.max(0, newIndex);
            });
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (filteredEmojis.length > 0) {
            setSelectedIndex(prev => {
              const newIndex = prev < 0 ? 0 : prev + 8; // 下移一行（8个表情）
              return Math.min(filteredEmojis.length - 1, newIndex);
            });
          }
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          if (filteredEmojis.length > 0) {
            setSelectedIndex(prev => {
              const newIndex = prev <= 0 ? filteredEmojis.length - 1 : prev - 1;
              return newIndex;
            });
          }
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          if (filteredEmojis.length > 0) {
            setSelectedIndex(prev => {
              const newIndex = prev >= filteredEmojis.length - 1 ? 0 : prev + 1;
              return newIndex;
            });
          }
          break;
          
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            // 向前切换分类
            const categories = availableCategories.map(([key]) => key);
            const currentIndex = categories.indexOf(activeCategory);
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : categories.length - 1;
            setActiveCategory(categories[prevIndex]);
          } else {
            // 向后切换分类
            const categories = availableCategories.map(([key]) => key);
            const currentIndex = categories.indexOf(activeCategory);
            const nextIndex = currentIndex < categories.length - 1 ? currentIndex + 1 : 0;
            setActiveCategory(categories[nextIndex]);
          }
          setSelectedIndex(-1); // 重置选择
          break;
          
        default:
          // 如果按下字母/数字/中文，聚焦搜索框
          if (e.key.length === 1 && /[a-zA-Z0-9\u4e00-\u9fa5]/.test(e.key)) {
            searchInputRef.current?.focus();
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, activeCategory, categoriesWithRecent, filteredEmojis, selectedIndex, handleEmojiSelect]);

  // 重置选择索引当搜索或分类改变时
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery, activeCategory]);

  // 自动滚动到选中的表情
  useEffect(() => {
    if (selectedIndex >= 0 && emojiGridRef.current) {
      const emojiButtons = emojiGridRef.current.querySelectorAll('button');
      const selectedButton = emojiButtons[selectedIndex];
      if (selectedButton) {
        selectedButton.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }
  }, [selectedIndex]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // console.log('点击外部事件触发:', event.target);
      
      // 延迟检查，让内部点击事件先执行
      setTimeout(() => {
        if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
          // console.log('点击在表情选择器外部，关闭选择器');
          onClose();
        } else {
          // console.log('点击在表情选择器内部，不关闭');
        }
      }, 0);
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside, true);
      return () => document.removeEventListener('click', handleClickOutside, true);
    }
  }, [isOpen, onClose]);

  // 自动聚焦搜索框 - 延迟更长时间避免干扰点击
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        // 只有在没有活动元素时才聚焦搜索框
        if (document.activeElement === document.body) {
          searchInputRef.current?.focus();
        }
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 过滤掉最近使用为空的情况
  const availableCategories = Object.entries(categoriesWithRecent).filter(([key, category]) => {
    if (key === 'recent') {
      return category.emojis.length > 0;
    }
    return true;
  });

  // console.log('所有分类数据:', categoriesWithRecent);
  // console.log('可用分类:', availableCategories);
  // console.log('当前活跃分类:', activeCategory);



  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full right-0 mb-2 w-80 h-96 bg-cream border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col emoji-picker-scrollbar"
      data-emoji-picker
    >
      {/* 搜索框 */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索表情..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      {/* 分类标签 */}
              {!searchQuery && (
          <div className="flex border-b border-gray-200 p-2 gap-1 overflow-x-auto emoji-picker-scrollbar-horizontal">
          {availableCategories.map(([key, category]) => {
            // console.log('渲染分类按钮:', key, category.name);
            return (
              <div
                key={key}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveCategory(key);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setActiveCategory(key);
                }}
                className={`min-w-fit text-xs px-2 py-1 h-8 cursor-pointer rounded flex items-center select-none ${
                  activeCategory === key 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
                }`}
                style={{ 
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  pointerEvents: 'auto',
                  zIndex: 1000
                }}
                title={category.name}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveCategory(key);
                  }
                }}
              >
                <span className="text-base mr-1 pointer-events-none">{category.icon}</span>
                <span className="hidden sm:inline pointer-events-none">{category.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 表情网格 */}
      <div ref={emojiGridRef} className="flex-1 p-3 overflow-y-auto emoji-picker-scrollbar-vertical">
        {filteredEmojis.length > 0 ? (
          <div className="grid grid-cols-8 gap-1">
            {filteredEmojis.map((emoji, index) => (
              <Button
                key={`${emoji}-${index}`}
                variant="ghost"
                size="sm"
                onClick={() => handleEmojiSelect(emoji)}
                className={`w-8 h-8 p-0 text-lg transition-all duration-150 rounded-md ${
                  selectedIndex === index 
                    ? 'bg-primary-500/30 ring-2 ring-primary-500 scale-110' 
                    : 'hover:bg-black/10 hover:scale-110'
                }`}
                title={`${emoji}${emojiNameMap[emoji] ? ` - ${emojiNameMap[emoji].join(', ')}` : ''}`}
              >
                {emoji}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Search className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">没有找到相关表情</p>
            <p className="text-xs mt-1">试试其他搜索词</p>
          </div>
        )}
      </div>

      {/* 底部快捷键提示 */}
      <div className="border-t border-gray-200 px-3 py-2">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            {selectedIndex >= 0 ? `已选择: ${filteredEmojis[selectedIndex]}` : '点击或按键选择表情'}
          </span>
          <div className="flex gap-2">
            <span>↑↓← →导航</span>
            <span>Enter选择</span>
            <span>Tab切换</span>
            <span>Esc关闭</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker; 