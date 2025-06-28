import React from 'react';
import FileMessage from './FileMessage';
import { 
  ImageIcon,
  VideoIcon,
  Music
} from 'lucide-react';

interface MediaMessageBubblesProps {
  className?: string;
}

const MediaMessageBubbles: React.FC<MediaMessageBubblesProps> = ({ className = "" }) => {
  // 示例媒体文件数据
  const imageFileData = {
    name: 'beautiful_sunset.jpg',
    size: 2048000, // 2MB
    type: 'image/jpeg',
    url: '/assets/images/dog.jpg',
  };

  const videoFileData = {
    name: 'vacation_highlights.mp4',
    size: 25600000, // 25MB
    type: 'video/mp4',
    url: '/assets/images/profile.png', // 作为缩略图
  };

  const audioFileData = {
    name: 'morning_voice_note.mp3',
    size: 1536000, // 1.5MB
    type: 'audio/mp3',
  };

  return (
    <div className={`flex flex-col gap-6 p-6 bg-gradient-to-b from-dark-1 to-dark-2 min-h-screen ${className}`}>
      <h2 className="text-2xl font-bold text-light-1 text-center mb-8">
        媒体消息气泡展示
      </h2>
      
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* 图片消息气泡 */}
        <div className="flex justify-start">
          <div className="flex items-start gap-3 max-w-md">
            {/* 用户头像 */}
            <img
              src="/assets/icons/profile-placeholder.svg"
              alt="用户头像"
              className="w-8 h-8 rounded-full border border-dark-4 mt-1"
            />
            
            {/* 消息内容 */}
            <div className="flex flex-col">
              <div className="text-primary-400 text-sm font-medium mb-2 px-1">
                张小明
              </div>
              
              {/* 使用实际的 FileMessage 组件 */}
              <FileMessage 
                fileData={imageFileData}
                isMyMessage={false}
                onDownload={(file) => console.log('下载图片:', file.name)}
              />
              
              {/* 时间戳 */}
              <div className="text-light-4 text-xs mt-2 px-1">
                14:23
              </div>
            </div>
          </div>
        </div>

        {/* 视频消息气泡 */}
        <div className="flex justify-end">
          <div className="flex items-start gap-3 max-w-md">
            {/* 消息内容 */}
            <div className="flex flex-col">
              {/* 使用实际的 FileMessage 组件 */}
              <FileMessage 
                fileData={videoFileData}
                isMyMessage={true}
                onDownload={(file) => console.log('下载视频:', file.name)}
              />
              
              {/* 时间戳 */}
              <div className="text-light-4 text-xs mt-2 px-1 text-right">
                14:25
              </div>
            </div>
            
            {/* 我的头像 */}
            <img
              src="/assets/icons/profile-placeholder.svg"
              alt="我的头像"
              className="w-8 h-8 rounded-full border border-primary-500 mt-1"
            />
          </div>
        </div>

        {/* 音频消息气泡 */}
        <div className="flex justify-start">
          <div className="flex items-start gap-3 max-w-md">
            {/* 用户头像 */}
            <img
              src="/assets/icons/profile-placeholder.svg"
              alt="用户头像"
              className="w-8 h-8 rounded-full border border-dark-4 mt-1"
            />
            
            {/* 消息内容 */}
            <div className="flex flex-col">
              <div className="text-primary-400 text-sm font-medium mb-2 px-1">
                李小红
              </div>
              
              {/* 使用实际的 FileMessage 组件 */}
              <FileMessage 
                fileData={audioFileData}
                isMyMessage={false}
                onDownload={(file) => console.log('下载音频:', file.name)}
              />
              
              {/* 时间戳 */}
              <div className="text-light-4 text-xs mt-2 px-1">
                14:26
              </div>
            </div>
          </div>
        </div>

        {/* 说明文字 */}
        <div className="bg-dark-3/50 rounded-xl p-6 border border-dark-4/50 mt-12">
          <h3 className="text-light-1 font-semibold mb-4">媒体消息组件特性：</h3>
          <div className="space-y-4 text-light-3 text-sm">
            <div className="flex items-start gap-3">
              <ImageIcon className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-light-2">图片消息：</strong>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  <li>在气泡中直接完整地显示图片内容</li>
                  <li>右上角有下载图标按钮</li>
                  <li>点击图片可以查看大图预览</li>
                  <li>支持各种常见图片格式</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <VideoIcon className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-light-2">视频消息：</strong>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  <li>渲染视频的封面帧（缩略图）</li>
                  <li>中央叠加大的播放图标，表示可内联预览</li>
                  <li>右上角提供下载图标按钮</li>
                  <li>左下角显示视频时长，右下角显示文件大小</li>
                  <li>悬停时有视觉反馈效果</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Music className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-light-2">音频消息：</strong>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  <li>渲染为静态的文件信息UI元素</li>
                  <li>包含音乐符号文件类型图标</li>
                  <li>显示文件名和元数据（时长、文件格式）</li>
                  <li>右侧包含下载功能入口</li>
                  <li>排除所有播放控制元素（播放/暂停按钮、进度条、波形图）</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-primary-500/10 rounded-lg border border-primary-500/20">
            <p className="text-primary-400 text-sm">
              💡 <strong>提示：</strong>这些组件已经完全集成到您的聊天系统中。当用户发送媒体文件时，会自动使用相应的气泡样式进行展示。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaMessageBubbles; 