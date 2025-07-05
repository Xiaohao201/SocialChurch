import { useUserContext } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Link, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getUserById, updateUser, uploadFile, getFilePreview, getUserAvatarUrl } from '@/lib/appwrite/api';
import { useToast } from '@/components/ui/use-toast';
import Loader from '@/components/shared/Loader';
import { 
  Calendar, 
  Church, 
  Heart, 
  MessageCircle, 
  User,
  Star,
  Cross,
  Camera,
  Edit2,
  Check,
  X,
  Save,
  Share2,
  ChevronDown,
  ChevronUp,
  Baby,
  UserIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user: currentUser, setUser } = useUserContext();
  const { id } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profileUser, setProfileUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTestimonyExpanded, setIsTestimonyExpanded] = useState(false);
  
  const isOwnProfile = currentUser.$id === id;

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setIsLoading(true);
        
        if (isOwnProfile) {
          // 对于当前用户，使用 getUserAvatarUrl 函数处理头像URL
          const processedUser = {
            ...currentUser,
            imageUrl: getUserAvatarUrl(currentUser.imageUrl)
          };
          setProfileUser(processedUser);
          setEditValues({
            name: currentUser.name || '',
            ministry: currentUser.ministry || '',
            dateOfFaith: currentUser.dateOfFaith ? new Date(currentUser.dateOfFaith).toISOString().split('T')[0] : '',
            faithTestimony: currentUser.faithTestimony || '',
            gender: currentUser.gender || 'unknown'
          });
        } else {
          const userData = await getUserById(id!);
          setProfileUser(userData);
        }

      } catch (error) {
        console.error('加载个人资料失败:', error);
        toast({
          title: '加载失败',
          description: '无法加载个人资料',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadProfileData();
    }
  }, [id, currentUser, isOwnProfile, toast]);

  const handleStartChat = () => {
    if (profileUser && !isOwnProfile) {
      navigate(`/home?with=${profileUser.$id}`);
    }
  };

  const handleAvatarClick = () => {
    if (isOwnProfile && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast({
        title: '文件类型错误',
        description: '请选择图片文件',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingAvatar(true);

    try {
      // 创建本地URL预览 - 立即显示
      const localImageUrl = URL.createObjectURL(file);
      setProfileUser((prev: any) => ({ ...prev, imageUrl: localImageUrl }));
      
      console.log('开始上传头像文件...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        currentUserId: currentUser.$id
      });
      
      // 上传文件到Appwrite Storage
      const uploadedFile = await uploadFile(file);
      console.log('文件上传成功:', {
        fileId: uploadedFile.$id,
        fileSize: uploadedFile.sizeOriginal,
        fileName: uploadedFile.name
      });
      
      // 获取文件的预览URL
      const imageUrl = getFilePreview(uploadedFile.$id);
      console.log('获取文件预览URL:', imageUrl);
      
      // 更新用户数据库记录，保存完整的预览URL
      await updateUser(currentUser.$id, { imageUrl: imageUrl });
      console.log('用户数据库记录更新成功，保存的预览URL:', imageUrl);
      
      // 更新本地状态
      setProfileUser((prev: any) => ({ ...prev, imageUrl }));
      
      // 同时更新AuthContext中的用户信息，保存文件ID用于内部处理
      if (isOwnProfile) {
        setUser((prev: any) => ({ ...prev, imageUrl: uploadedFile.$id }));
      }
      
      toast({
        title: '头像更新成功',
        description: '您的头像已成功更新',
      });
      
      // 清理本地URL
      URL.revokeObjectURL(localImageUrl);

    } catch (error: any) {
      console.error('更新头像失败:', error);
      
      // 根据错误类型提供更详细的错误信息
      let errorMessage = '无法更新头像，请重试';
      if (error.message && error.message.includes('Invalid document structure')) {
        errorMessage = '头像文件格式不支持，请选择其他图片';
      } else if (error.message && error.message.includes('网络')) {
        errorMessage = '网络连接问题，请检查网络后重试';
      }
      
      toast({
        title: '更新失败',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // 恢复原头像
      setProfileUser((prev: any) => ({ ...prev, imageUrl: getUserAvatarUrl(currentUser.imageUrl) }));
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleEditStart = (field: string) => {
    if (!isOwnProfile) return;
    setEditingField(field);
  };

  const handleEditCancel = () => {
    setEditingField(null);
    // 恢复原值
    setEditValues({
      name: profileUser.name || '',
      ministry: profileUser.ministry || '',
      dateOfFaith: profileUser.dateOfFaith ? new Date(profileUser.dateOfFaith).toISOString().split('T')[0] : '',
      faithTestimony: profileUser.faithTestimony || '',
      gender: profileUser.gender || 'unknown'
    });
  };

  const handleEditSave = async (field: string) => {
    setIsSaving(true);
    
    try {
      const updateData: any = {};
      
      if (field === 'dateOfFaith') {
        updateData[field] = editValues[field] ? new Date(editValues[field]) : undefined;
      } else {
        updateData[field] = editValues[field];
      }

      await updateUser(currentUser.$id, updateData);
      
      // 更新本地状态
      setProfileUser((prev: any) => ({ ...prev, ...updateData }));
      
      // 同时更新AuthContext中的用户信息
      if (isOwnProfile) {
        setUser((prev: any) => ({ ...prev, ...updateData }));
      }
      
      setEditingField(null);
      
      toast({
        title: '更新成功',
        description: '个人信息已更新',
      });

    } catch (error) {
      console.error('更新失败:', error);
      toast({
        title: '更新失败',
        description: '无法更新信息，请重试',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const getGenderDisplay = (gender?: string) => {
    switch (gender) {
      case 'male': return { text: '弟兄', color: 'text-blue-600', icon: UserIcon };
      case 'female': return { text: '姊妹', color: 'text-pink-600', icon: UserIcon };
      default: return { text: '保密', color: 'text-gray-600', icon: UserIcon };
    }
  };

  const formatFaithDate = (dateString?: string | Date) => {
    if (!dateString) return '期待分享属灵生日';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const truncateTestimony = (text: string, maxLines: number = 3) => {
    const words = text.split(' ');
    const wordsPerLine = 15; // 估算每行单词数
    const maxWords = maxLines * wordsPerLine;
    
    if (words.length <= maxWords) return text;
    
    return words.slice(0, maxWords).join(' ') + '...';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 mx-auto mb-4 text-soft-gray" />
          <p className="text-warm-gray font-opensans">用户不存在</p>
        </div>
      </div>
    );
  }

  const genderInfo = getGenderDisplay(profileUser.gender);

  return (
    <div className="min-h-screen minimalist-profile">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* 个人头像区域 */}
        <div className="text-center mb-16">
          <div className="relative inline-block mb-8">
            <div 
              className={`relative w-32 h-32 profile-avatar-hover ${
                isOwnProfile ? 'cursor-pointer group' : ''
              }`}
              onClick={handleAvatarClick}
            >
              {/* 淡金色外圈 */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-warm-gold to-soft-gold p-1">
                <img
                  src={profileUser.imageUrl || '/assets/icons/profile-placeholder.svg'}
                  alt="profile"
                  className="w-full h-full rounded-full object-cover bg-white"
                />
              </div>
              
              {/* 更新头像加载状态 */}
              {isUpdatingAvatar && (
                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                  <Loader />
                </div>
              )}
              
              {/* 拍照图标 */}
              {isOwnProfile && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-warm-gold rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform icon-hover">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* 用户名称 */}
          <div className="mb-8">
            {editingField === 'name' ? (
              <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
                <input
                  type="text"
                  value={editValues.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="flex-1 px-4 py-2 text-center text-2xl font-semibold bg-white border border-light-gray rounded-lg focus:outline-none focus:border-warm-gold text-warm-gray font-montserrat profile-input"
                  placeholder="请输入姓名"
                />
                <Button
                  size="sm"
                  onClick={() => handleEditSave('name')}
                  disabled={isSaving}
                  className="w-10 h-10 p-0 bg-green-500 hover:bg-green-600 rounded-lg icon-hover"
                >
                  {isSaving ? <Loader /> : <Check className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditCancel}
                  className="w-10 h-10 p-0 border-light-gray hover:bg-gray-50 rounded-lg icon-hover"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <h1 
                className={`text-3xl font-semibold text-warm-gray font-montserrat profile-title ${
                  isOwnProfile ? 'cursor-pointer hover:text-warm-gold transition-colors' : ''
                }`}
                onClick={() => handleEditStart('name')}
              >
                {profileUser.name}
                {isOwnProfile && (
                  <Edit2 className="w-5 h-5 inline-block ml-2 opacity-0 hover:opacity-100 transition-opacity icon-hover" />
                )}
              </h1>
            )}
          </div>

          {/* 基本信息标签 */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {/* 性别 */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-light-gray profile-tag card-hover">
              <genderInfo.icon className={`w-4 h-4 ${genderInfo.color} icon-hover`} />
              {editingField === 'gender' ? (
                <div className="flex items-center gap-2">
                  <select
                    value={editValues.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="bg-transparent focus:outline-none text-warm-gray text-sm font-opensans"
                  >
                    <option value="unknown">保密</option>
                    <option value="male">弟兄</option>
                    <option value="female">姊妹</option>
                  </select>
                  <Check 
                    className="w-3 h-3 text-green-500 cursor-pointer icon-hover" 
                    onClick={() => handleEditSave('gender')}
                  />
                  <X 
                    className="w-3 h-3 text-soft-gray cursor-pointer icon-hover" 
                    onClick={handleEditCancel}
                  />
                </div>
              ) : (
                <span 
                  className={`text-sm font-medium ${genderInfo.color} ${
                    isOwnProfile ? 'cursor-pointer' : ''
                  } font-opensans profile-text`}
                  onClick={() => handleEditStart('gender')}
                >
                  {genderInfo.text}
                </span>
              )}
            </div>

            {/* 所属事工 */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-light-gray profile-tag card-hover">
              <Church className="w-4 h-4 text-warm-gold icon-hover" />
              {editingField === 'ministry' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValues.ministry}
                    onChange={(e) => handleInputChange('ministry', e.target.value)}
                    className="bg-transparent focus:outline-none text-warm-gray text-sm w-24 font-opensans"
                    placeholder="事工"
                  />
                  <Check 
                    className="w-3 h-3 text-green-500 cursor-pointer icon-hover" 
                    onClick={() => handleEditSave('ministry')}
                  />
                  <X 
                    className="w-3 h-3 text-soft-gray cursor-pointer icon-hover" 
                    onClick={handleEditCancel}
                  />
                </div>
              ) : (
                <span 
                  className={`text-sm font-medium text-warm-gray ${
                    isOwnProfile ? 'cursor-pointer' : ''
                  } font-opensans profile-text`}
                  onClick={() => handleEditStart('ministry')}
                >
                  {profileUser.ministry || (isOwnProfile ? '设置事工' : '暂无事工')}
                </span>
              )}
            </div>

            {/* 坚信日期 */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-light-gray profile-tag card-hover">
              <Baby className="w-4 h-4 text-church-blue icon-hover" />
              {editingField === 'dateOfFaith' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={editValues.dateOfFaith}
                    onChange={(e) => handleInputChange('dateOfFaith', e.target.value)}
                    className="bg-transparent focus:outline-none text-warm-gray text-sm font-opensans"
                  />
                  <Check 
                    className="w-3 h-3 text-green-500 cursor-pointer icon-hover" 
                    onClick={() => handleEditSave('dateOfFaith')}
                  />
                  <X 
                    className="w-3 h-3 text-soft-gray cursor-pointer icon-hover" 
                    onClick={handleEditCancel}
                  />
                </div>
              ) : (
                <span 
                  className={`text-sm font-medium text-warm-gray ${
                    isOwnProfile ? 'cursor-pointer' : ''
                  } font-opensans profile-text`}
                  onClick={() => handleEditStart('dateOfFaith')}
                >
                  {profileUser.dateOfFaith ? 
                    formatFaithDate(profileUser.dateOfFaith).replace('年', '/').replace('月', '/').replace('日', '') :
                    (isOwnProfile ? '设置生日' : '期待分享')
                  }
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 信仰见证卡片 */}
        <div className="bg-white rounded-lg shadow-sm border border-light-gray p-8 mb-12 profile-card card-hover">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-warm-gray font-montserrat profile-title">我的见证</h2>
            <div className="flex items-center gap-2">
              {isOwnProfile && (
                <Edit2 
                  className="w-4 h-4 text-soft-gray cursor-pointer hover:text-warm-gold transition-colors icon-hover"
                  onClick={() => handleEditStart('faithTestimony')}
                />
              )}
              <Share2 className="w-4 h-4 text-soft-gray cursor-pointer hover:text-warm-gold transition-colors icon-hover" />
            </div>
          </div>

          {editingField === 'faithTestimony' ? (
            <div className="space-y-4">
              <textarea
                value={editValues.faithTestimony}
                onChange={(e) => handleInputChange('faithTestimony', e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-gray-50 border border-light-gray rounded-lg focus:outline-none focus:border-warm-gold text-warm-gray resize-none font-opensans profile-input"
                placeholder="分享您的信仰见证..."
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => handleEditSave('faithTestimony')}
                  disabled={isSaving}
                  className="bg-warm-gold hover:bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium font-montserrat profile-button-primary"
                >
                  {isSaving ? <Loader /> : '保存'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEditCancel}
                  className="border-light-gray hover:bg-gray-50 text-warm-gray px-6 py-2 rounded-lg font-medium font-montserrat profile-button-secondary"
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="testimony-expand">
              {profileUser.faithTestimony ? (
                <div>
                  <p className="text-warm-gray leading-relaxed mb-4 font-opensans profile-text">
                    {isTestimonyExpanded ? 
                      profileUser.faithTestimony : 
                      truncateTestimony(profileUser.faithTestimony)
                    }
                  </p>
                  {profileUser.faithTestimony.length > 200 && (
                    <button
                      onClick={() => setIsTestimonyExpanded(!isTestimonyExpanded)}
                      className="flex items-center gap-1 text-warm-gold hover:text-yellow-600 transition-colors text-sm font-medium font-montserrat icon-hover"
                    >
                      {isTestimonyExpanded ? (
                        <>收起 <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>展开阅读 <ChevronDown className="w-4 h-4" /></>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <p 
                  className={`text-soft-gray italic ${
                    isOwnProfile ? 'cursor-pointer hover:text-warm-gold transition-colors' : ''
                  } font-opensans profile-secondary-text`}
                  onClick={() => isOwnProfile && handleEditStart('faithTestimony')}
                >
                  {isOwnProfile ? '点击分享您的生命故事...' : '期待听到这位肢体的美好见证'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 操作按钮 - 只对他人显示 */}
        {!isOwnProfile && (
          <div className="text-center mb-12">
            <Button
              onClick={handleStartChat}
              className="bg-warm-gold hover:bg-yellow-600 text-white px-8 py-3 rounded-lg font-medium shadow-sm font-montserrat profile-button-primary"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              发送消息
            </Button>
          </div>
        )}

        {/* 祝福语 */}
        <div className="text-center py-8">
          <div className="inline-block bg-white px-8 py-6 rounded-lg shadow-sm border border-light-gray profile-card card-hover">
            <Cross className="w-6 h-6 text-warm-gold mx-auto mb-3 icon-hover" />
            <p className="text-warm-gray italic font-opensans mb-2 profile-text">
              "愿恩惠、平安从神我们的父和主耶稣基督归与你们！"
            </p>
            <p className="text-soft-gray text-sm font-opensans profile-secondary-text">— 哥林多前书 1:3</p>
          </div>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default Profile;