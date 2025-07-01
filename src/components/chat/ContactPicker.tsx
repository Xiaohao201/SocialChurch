import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  User, 
  Phone, 
  Mail, 
  Send,
  UserPlus,
  Users,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

interface ContactPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contacts: ContactData[] | ContactData) => void;
  multiple?: boolean;
  title?: string;
}

interface ContactData {
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  id?: string;
}

interface CreateContactForm {
  name: string;
  phone: string;
  email: string;
}

// 模拟联系人数据（实际项目中应从API获取）
const mockContacts: ContactData[] = [
  {
    id: '1',
    name: '张三',
    phone: '+86 138 0013 8000',
    email: 'zhangsan@example.com',
    avatar: '👨'
  },
  {
    id: '2',
    name: '李四',
    phone: '+86 139 0013 9000',
    email: 'lisi@example.com',
    avatar: '👩'
  },
  {
    id: '3',
    name: '王五',
    phone: '+86 137 0013 7000',
    email: 'wangwu@example.com',
    avatar: '👨‍💼'
  },
  {
    id: '4',
    name: '赵六',
    phone: '+86 136 0013 6000',
    email: 'zhaoliu@example.com',
    avatar: '👩‍💼'
  },
  {
    id: '5',
    name: '钱七',
    phone: '+86 135 0013 5000',
    avatar: '👨‍🎓'
  }
];

const ContactPicker: React.FC<ContactPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  multiple = false,
  title = 'Select Contact'
}) => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactData[]>(mockContacts);
  const [filteredContacts, setFilteredContacts] = useState<ContactData[]>(mockContacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<ContactData[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateContactForm>({
    name: '',
    phone: '',
    email: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // 搜索联系人
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(contact => 
      contact.name.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query) ||
      (contact.email && contact.email.toLowerCase().includes(query))
    );
    
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  // 检查Web Share API支持
  const checkWebShareSupport = () => {
    return 'share' in navigator;
  };

  // 请求联系人权限（Web平台限制，主要用于演示）
  const requestContactsPermission = async (): Promise<boolean> => {
    try {
      // 在实际Web应用中，无法直接访问系统联系人
      // 这里提供手动输入或从云端同步的方案
      toast({
        title: "联系人访问",
        description: "Web平台无法直接访问系统联系人，请手动添加或从云端同步"
      });
      return true;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "无法访问联系人",
        description: "请手动添加联系人信息"
      });
      return false;
    }
  };

  // 验证电话号码格式
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  // 验证邮箱格式
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // 邮箱是可选的
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 创建新联系人
  const handleCreateContact = async () => {
    const { name, phone, email } = createForm;

    // 验证必填字段
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "姓名不能为空"
      });
      return;
    }

    if (!phone.trim()) {
      toast({
        variant: "destructive",
        title: "电话号码不能为空"
      });
      return;
    }

    // 验证格式
    if (!validatePhone(phone)) {
      toast({
        variant: "destructive",
        title: "电话号码格式不正确"
      });
      return;
    }

    if (email && !validateEmail(email)) {
      toast({
        variant: "destructive",
        title: "邮箱格式不正确"
      });
      return;
    }

    setIsLoading(true);

    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newContact: ContactData = {
        id: Date.now().toString(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        avatar: '👤'
      };

      setContacts(prev => [newContact, ...prev]);
      setSelectedContacts(prev => [newContact, ...prev]);
      setShowCreateForm(false);
      setCreateForm({ name: '', phone: '', email: '' });
      
      toast({
        title: "联系人创建成功",
        description: `已添加 ${newContact.name}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "创建失败",
        description: "无法创建联系人，请重试"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 发送联系人
  const handleSendContact = () => {
    if (selectedContacts.length > 0) {
      onSelect(multiple ? selectedContacts : selectedContacts[0]);
      onClose();
    }
  };

  // 分享联系人（使用Web Share API）
  const handleShareContact = async (contact: ContactData) => {
    if (checkWebShareSupport()) {
      try {
        await navigator.share({
          title: `联系人: ${contact.name}`,
          text: `${contact.name}\n电话: ${contact.phone}${contact.email ? `\n邮箱: ${contact.email}` : ''}`,
          url: `tel:${contact.phone}`
        });
      } catch (error) {
        console.log('分享被取消或失败:', error);
      }
    } else {
      // 备用方案：复制到剪贴板
      const contactText = `${contact.name}\n电话: ${contact.phone}${contact.email ? `\n邮箱: ${contact.email}` : ''}`;
      try {
        await navigator.clipboard.writeText(contactText);
        toast({
          title: "已复制到剪贴板",
          description: "联系人信息已复制"
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "复制失败",
          description: "无法复制联系人信息"
        });
      }
    }
  };

  const handleContactClick = (contact: ContactData) => {
    if (multiple) {
      setSelectedContacts(prev => 
        prev.find(c => c.id === contact.id)
          ? prev.filter(c => c.id !== contact.id)
          : [...prev, contact]
      );
    } else {
      setSelectedContacts([contact]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-4 bg-dark-2 rounded-xl overflow-hidden shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-dark-4 bg-dark-1">
              <h3 className="text-lg font-semibold text-light-1">{title}</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCreateForm(true)}
                  className="text-primary-500 hover:text-primary-400"
                  title="添加新联系人"
                >
                  <UserPlus className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-light-2 hover:text-light-1"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* 搜索栏 */}
            {!showCreateForm && (
              <div className="p-4 border-b border-dark-4 bg-dark-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="搜索或开始新对话"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
              </div>
            )}

            {/* 主内容区域 */}
            <div className="flex-1 overflow-hidden">
              {showCreateForm ? (
                /* 创建联系人表单 */
                <div className="p-6 space-y-4">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <UserPlus className="w-8 h-8 text-primary-500" />
                    </div>
                    <h4 className="text-lg font-medium text-light-1">添加新联系人</h4>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-light-2 mb-2">
                        姓名 *
                      </label>
                      <Input
                        value={createForm.name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="请输入姓名"
                        className="bg-dark-3 border-dark-4 text-light-1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-2 mb-2">
                        电话号码 *
                      </label>
                      <Input
                        value={createForm.phone}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="请输入电话号码"
                        type="tel"
                        className="bg-dark-3 border-dark-4 text-light-1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-light-2 mb-2">
                        邮箱 (可选)
                      </label>
                      <Input
                        value={createForm.email}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="请输入邮箱地址"
                        type="email"
                        className="bg-dark-3 border-dark-4 text-light-1"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateForm(false);
                        setCreateForm({ name: '', phone: '', email: '' });
                      }}
                      className="flex-1 border-dark-4 text-light-2 hover:bg-dark-3"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleCreateContact}
                      disabled={isLoading || !createForm.name.trim() || !createForm.phone.trim()}
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white"
                    >
                      {isLoading ? '创建中...' : '创建联系人'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* 联系人列表 */
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredContacts.length > 0 ? (
                    filteredContacts.map(contact => {
                      const isSelected = selectedContacts.some(c => c.id === contact.id);
                      return (
                        <div
                          key={contact.id}
                          onClick={() => handleContactClick(contact)}
                          className={`
                            flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors
                            ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}
                          `}
                        >
                          <div className="w-6 h-6 flex items-center justify-center">
                            {multiple && (
                              <div className={`
                                w-5 h-5 rounded-full border-2 flex items-center justify-center
                                ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
                              `}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            )}
                          </div>
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl">
                            {contact.avatar}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{contact.name}</p>
                            <p className="text-sm text-gray-500">{contact.phone}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center text-gray-500 mt-8">没有找到联系人</p>
                  )}
                </div>
              )}
            </div>

            {/* 底部操作区 */}
            {!showCreateForm && (
              <div className="p-4 border-t">
                <Button 
                  onClick={handleSendContact}
                  disabled={selectedContacts.length === 0}
                  className="w-full"
                >
                  <Send className="mr-2 w-4 h-4" />
                  {multiple ? `发送给 ${selectedContacts.length} 个联系人` : '发送'}
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactPicker; 