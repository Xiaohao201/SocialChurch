import { useUserContext } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { updateUser } from '@/lib/appwrite/api';
import FileUploader from '@/components/shared/FileUploader';
import Loader from '@/components/shared/Loader';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Mail, 
  Church, 
  Heart, 
  Calendar,
  FileText,
  Camera,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';

interface ProfileFormData {
  name: string;
  email: string;
  bio: string;
  ministry: string;
  gender: 'male' | 'female' | 'unknown';
  dateOfFaith: string;
  faithTestimony: string;
  imageUrl: string;
}

const UpdateProfile = () => {
  const { user } = useUserContext();
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState<ProfileFormData>({
    name: user.name || '',
    email: user.email || '',
    bio: (user as any).bio || '',
    ministry: user.ministry || '',
    gender: user.gender || 'unknown',
    dateOfFaith: user.dateOfFaith ? new Date(user.dateOfFaith).toISOString().split('T')[0] : '',
    faithTestimony: user.faithTestimony || '',
    imageUrl: user.imageUrl || '',
  });

  const [errors, setErrors] = useState<Partial<ProfileFormData>>({});

  // 确保只有用户本人可以编辑自己的资料
  if (user.$id !== id) {
    navigate('/');
    return null;
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<ProfileFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = '姓名不能为空';
    } else if (formData.name.length < 2) {
      newErrors.name = '姓名至少需要2个字符';
    }

    if (!formData.email.trim()) {
      newErrors.email = '邮箱不能为空';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = '个人简介不能超过500字符';
    }

    if (formData.faithTestimony && formData.faithTestimony.length > 1000) {
      newErrors.faithTestimony = '信仰见证不能超过1000字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: '表单验证失败',
        description: '请检查并修正表单中的错误',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData = {
        name: formData.name,
        bio: formData.bio,
        ministry: formData.ministry,
        gender: formData.gender,
        dateOfFaith: formData.dateOfFaith ? new Date(formData.dateOfFaith) : undefined,
        faithTestimony: formData.faithTestimony,
        imageUrl: formData.imageUrl,
      };

      await updateUser(user.$id, updateData);
      
      toast({
        title: '更新成功',
        description: '您的个人资料已成功更新',
      });

      navigate(`/profile/${user.$id}`);
    } catch (error) {
      console.error('更新个人资料失败:', error);
      toast({
        title: '更新失败',
        description: '无法更新个人资料，请重试',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFileUpload = (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      const imageUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, imageUrl }));
    }
  };

  return (
    <div className="common-container">
      <div className="w-full max-w-4xl">
        {/* 页面标题 */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl hover:bg-dark-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="h2-bold text-left text-light-1">编辑个人资料</h2>
            <p className="text-light-3 mt-1">更新您的个人信息和设置</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 头像上传 */}
          <div className="bg-dark-2 rounded-2xl p-8 border border-dark-4/50">
            <div className="flex items-center gap-3 mb-6">
              <Camera className="w-6 h-6 text-primary-400" />
              <h3 className="text-xl font-bold text-light-1">头像设置</h3>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="relative">
                <img
                  src={formData.imageUrl || '/assets/icons/profile-placeholder.svg'}
                  alt="头像预览"
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary-500/30"
                />
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center border-4 border-dark-2">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div className="flex-1">
                <FileUploader
                  fieldChange={handleFileUpload}
                  mediaUrl={formData.imageUrl}
                />
                <p className="text-light-4 text-sm mt-2">
                  支持 JPG、PNG 格式，建议尺寸 400x400 像素，最大 2MB
                </p>
              </div>
            </div>
          </div>

          {/* 基本信息 */}
          <div className="bg-dark-2 rounded-2xl p-8 border border-dark-4/50">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-blue-400" />
              <h3 className="text-xl font-bold text-light-1">基本信息</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-light-2 font-medium mb-3">
                  姓名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 bg-dark-3 border rounded-xl text-light-1 placeholder-light-4 focus:outline-none focus:ring-2 transition-all ${
                    errors.name ? 'border-red-500 focus:ring-red-500' : 'border-dark-4 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                  placeholder="请输入您的姓名"
                />
                {errors.name && (
                  <p className="text-red-400 text-sm mt-2">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-light-2 font-medium mb-3">
                  邮箱 *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-4 py-3 bg-dark-3 border rounded-xl text-light-1 placeholder-light-4 focus:outline-none focus:ring-2 transition-all ${
                    errors.email ? 'border-red-500 focus:ring-red-500' : 'border-dark-4 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                  placeholder="请输入您的邮箱"
                  disabled
                />
                {errors.email && (
                  <p className="text-red-400 text-sm mt-2">{errors.email}</p>
                )}
                <p className="text-light-4 text-sm mt-2">邮箱地址无法修改</p>
              </div>

              <div>
                <label className="block text-light-2 font-medium mb-3">
                  性别
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full px-4 py-3 bg-dark-3 border border-dark-4 rounded-xl text-light-1 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 transition-all"
                >
                  <option value="unknown">不愿透露</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>

              <div>
                <label className="block text-light-2 font-medium mb-3">
                  事工
                </label>
                <input
                  type="text"
                  value={formData.ministry}
                  onChange={(e) => handleInputChange('ministry', e.target.value)}
                  className="w-full px-4 py-3 bg-dark-3 border border-dark-4 rounded-xl text-light-1 placeholder-light-4 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 transition-all"
                  placeholder="例如：敬拜团、青年团契、儿童主日学"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-light-2 font-medium mb-3">
                个人简介
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={4}
                className={`w-full px-4 py-3 bg-dark-3 border rounded-xl text-light-1 placeholder-light-4 focus:outline-none focus:ring-2 transition-all resize-none ${
                  errors.bio ? 'border-red-500 focus:ring-red-500' : 'border-dark-4 focus:border-primary-500 focus:ring-primary-500'
                }`}
                placeholder="简单介绍一下自己..."
              />
              <div className="flex justify-between items-center mt-2">
                {errors.bio && (
                  <p className="text-red-400 text-sm">{errors.bio}</p>
                )}
                <p className="text-light-4 text-sm ml-auto">
                  {formData.bio.length}/500
                </p>
              </div>
            </div>
          </div>

          {/* 信仰信息 */}
          <div className="bg-dark-2 rounded-2xl p-8 border border-dark-4/50">
            <div className="flex items-center gap-3 mb-6">
              <Heart className="w-6 h-6 text-red-400" />
              <h3 className="text-xl font-bold text-light-1">信仰信息</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-light-2 font-medium mb-3">
                  信主日期
                </label>
                <input
                  type="date"
                  value={formData.dateOfFaith}
                  onChange={(e) => handleInputChange('dateOfFaith', e.target.value)}
                  className="w-full px-4 py-3 bg-dark-3 border border-dark-4 rounded-xl text-light-1 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-light-2 font-medium mb-3">
                  信仰见证
                </label>
                <textarea
                  value={formData.faithTestimony}
                  onChange={(e) => handleInputChange('faithTestimony', e.target.value)}
                  rows={6}
                  className={`w-full px-4 py-3 bg-dark-3 border rounded-xl text-light-1 placeholder-light-4 focus:outline-none focus:ring-2 transition-all resize-none ${
                    errors.faithTestimony ? 'border-red-500 focus:ring-red-500' : 'border-dark-4 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                  placeholder="分享您的信仰历程和见证..."
                />
                <div className="flex justify-between items-center mt-2">
                  {errors.faithTestimony && (
                    <p className="text-red-400 text-sm">{errors.faithTestimony}</p>
                  )}
                  <p className="text-light-4 text-sm ml-auto">
                    {formData.faithTestimony.length}/1000
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4 justify-end pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="px-8 py-3 border-dark-4 hover:border-primary-500"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存更改
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateProfile; 