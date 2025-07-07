import React, { useState } from 'react';
import { Clock, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DisappearingMessageDuration } from '@/types';

interface DisappearingMessageSettingsProps {
  currentDuration: DisappearingMessageDuration;
  onDurationChange: (duration: DisappearingMessageDuration) => void;
  onBack: () => void;
  isLoading?: boolean;
}

const DisappearingMessageSettings: React.FC<DisappearingMessageSettingsProps> = ({
  currentDuration,
  onDurationChange,
  onBack,
  isLoading = false
}) => {
  const [selectedDuration, setSelectedDuration] = useState<DisappearingMessageDuration>(currentDuration);

  const durationOptions = [
    { value: 'off' as const, label: '关闭', description: '消息不会自动删除' },
    { value: '1day' as const, label: '1 天', description: '消息将在1天后消失' },
    { value: '3days' as const, label: '3 天', description: '消息将在3天后消失' },
    { value: '7days' as const, label: '7 天', description: '消息将在7天后消失' },
    { value: '30days' as const, label: '30 天', description: '消息将在30天后消失' },
  ];

  const handleDurationSelect = (duration: DisappearingMessageDuration) => {
    setSelectedDuration(duration);
    onDurationChange(duration);
    // 设置立即生效，自动返回
    setTimeout(() => {
      onBack();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-dark-1 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-light-3 dark:border-dark-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          disabled={isLoading}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary-500" />
          <h1 className="text-lg font-semibold">消息定时清理</h1>
        </div>
      </div>

      {/* Description */}
      <div className="p-4 bg-light-2 dark:bg-dark-2 border-b border-light-3 dark:border-dark-3">
        <p className="text-sm text-light-4 dark:text-light-3">
          启用后，此聊天中的新消息将在指定时间后消失。该设置对所有聊天参与者生效。
        </p>
      </div>

      {/* Options */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {durationOptions.map((option) => (
            <div
              key={option.value}
              className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedDuration === option.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                  : 'border-light-3 dark:border-dark-3 hover:border-primary-300 dark:hover:border-primary-400'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !isLoading && handleDurationSelect(option.value)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedDuration === option.value
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-light-4 dark:border-dark-4'
                    }`}>
                      {selectedDuration === option.value && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-dark-1 dark:text-light-1">
                        {option.label}
                      </h3>
                      <p className="text-sm text-light-4 dark:text-light-3 mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </div>
                {isLoading && selectedDuration === option.value && (
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer info */}
      <div className="p-4 bg-light-2 dark:bg-dark-2 border-t border-light-3 dark:border-dark-3">
        <div className="flex items-start gap-2">
          <div className="text-orange-500 mt-0.5">⚠️</div>
          <div className="text-xs text-light-4 dark:text-light-3">
            <p className="font-medium mb-1">重要提醒：</p>
            <ul className="space-y-1">
              <li>• 仅对启用后发送的新消息生效</li>
              <li>• 历史消息不会被删除</li>
              <li>• 消息一旦过期将无法恢复</li>
              <li>• 该设置对所有参与者生效</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisappearingMessageSettings; 