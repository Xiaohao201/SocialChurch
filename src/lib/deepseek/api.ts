import { deepseekConfig, defaultSystemPrompt, defaultMaxTokens, defaultTemperature } from './config';
import { ChatMessage } from './config';
import { DEEPSEEK_API_KEY } from "./config";

async function callDeepSeekAPI(messages: ChatMessage[], maxTokens = defaultMaxTokens, temperature = defaultTemperature) {
  try {
    const response = await fetch(`${deepseekConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: maxTokens,
        temperature: temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw error;
  }
}

export async function polishTestimony(testimony: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: defaultSystemPrompt },
    { role: 'user', content: `请帮我润色以下信仰经历描述：\n\n${testimony}` }
  ];

  return callDeepSeekAPI(messages);
}

export async function suggestReply(context: {
  previousMessages: ChatMessage[];
  lastMessage: string;
  relationship: string;
  userFaith: string;
}): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: defaultSystemPrompt },
    { role: 'user', content: `
请为以下聊天场景提供回复建议：

聊天对象：${context.relationship}
我的信仰状况：${context.userFaith}
最新消息：${context.lastMessage}
    ` }
  ];

  return callDeepSeekAPI(messages);
}

export async function recommendFriends(
  userProfile: {
    testimony: string;
    interests: string[];
    ministry?: string;
  },
  potentialFriends: Array<{
    id: string;
    name: string;
    testimony: string;
    interests: string[];
    ministry?: string;
  }>
): Promise<string> {
  const friendRecommendationPrompt = `你是一个专业的基督教社区好友推荐专家。请根据用户的信仰背景、兴趣爱好和事工参与情况，从候选人中推荐最合适的2-3位好友。

推荐标准：
1. 信仰经历的相似性或互补性
2. 兴趣爱好的匹配程度
3. 事工参与的协同可能
4. 人格特质的互补性

请按以下格式输出推荐结果：

推荐好友1：[姓名]
推荐理由：[详细说明为什么推荐此人，包括具体的匹配点]

推荐好友2：[姓名] 
推荐理由：[详细说明为什么推荐此人，包括具体的匹配点]

请确保推荐理由具体、中肯，能够帮助用户理解为什么这些人可能成为好朋友。`;

  const messages: ChatMessage[] = [
    { role: 'system', content: friendRecommendationPrompt },
    { role: 'user', content: `
我的个人信息：
- 信仰经历：${userProfile.testimony}
- 兴趣爱好：${userProfile.interests.length > 0 ? userProfile.interests.join(', ') : '暂无'}
${userProfile.ministry ? `- 事工参与：${userProfile.ministry}` : '- 事工参与：暂无'}

可推荐的候选好友：
${potentialFriends.map((friend, index) => `
${index + 1}. ${friend.name}
   - 信仰经历：${friend.testimony}
   - 兴趣爱好：${friend.interests.length > 0 ? friend.interests.join(', ') : '暂无'}
   - 事工参与：${friend.ministry}
`).join('\n')}

请从以上候选人中为我推荐2-3位最合适的好友，并详细说明推荐理由。
    ` }
  ];

  return callDeepSeekAPI(messages, 1000, 0.7);
}

export async function polishText(text: string): Promise<string> {
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是一个专业的文字润色助手，专门帮助用户优化他们的信仰经历描述。你需要保持原文的核心内容和情感，同时提升表达的流畅性和感染力。请用更优美、真诚的方式重写文本，但要确保不改变原意。"
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error('AI服务请求失败');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Polish text error:', error);
    throw new Error('文本润色失败，请稍后重试');
  }
} 