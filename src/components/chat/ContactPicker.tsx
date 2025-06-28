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
  onContactSelect: (contact: ContactData) => void;
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
  onContactSelect
}) => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ContactData[]>(mockContacts);
  const [filteredContacts, setFilteredContacts] = useState<ContactData[]>(mockContacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<ContactData | null>(null);
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
      setSelectedContact(newContact);
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
    if (selectedContact) {
      onContactSelect(selectedContact);
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
              <h3 className="text-lg font-semibold text-light-1">选择联系人</h3>
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-light-4" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索联系人..."
                    className="pl-10 bg-dark-3 border-dark-4 text-light-1"
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
                <div className="h-96 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-light-4 mx-auto mb-3" />
                      <p className="text-light-3">
                        {searchQuery ? '未找到匹配的联系人' : '暂无联系人'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreateForm(true)}
                        className="mt-3 border-primary-500 text-primary-500 hover:bg-primary-500/10"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        添加联系人
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      {filteredContacts.map((contact) => (
                        <motion.div
                          key={contact.id}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedContact?.id === contact.id
                              ? 'bg-primary-500/20 border-primary-500'
                              : 'bg-dark-3 border-dark-4 hover:bg-dark-2'
                          }`}
                          onClick={() => setSelectedContact(contact)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center text-lg">
                              {contact.avatar || '👤'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-light-1 truncate">{contact.name}</h4>
                                {selectedContact?.id === contact.id && (
                                  <Check className="w-4 h-4 text-primary-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-light-3">
                                <Phone className="w-3 h-3" />
                                <span>{contact.phone}</span>
                              </div>
                              {contact.email && (
                                <div className="flex items-center gap-1 text-sm text-light-4">
                                  <Mail className="w-3 h-3" />
                                  <span className="truncate">{contact.email}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 操作栏 */}
            {!showCreateForm && (
              <div className="p-4 border-t border-dark-4 bg-dark-1">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 border-dark-4 text-light-2 hover:bg-dark-3"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSendContact}
                    disabled={!selectedContact}
                    className="flex-1 bg-primary-500 hover:bg-primary-600 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    发送联系人
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactPicker; 