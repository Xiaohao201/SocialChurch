import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';
import cors from 'cors';
import dotenv from 'dotenv';

// 加载 .env 文件中的环境变量
dotenv.config();

const app = express();
const port = 3001;

// Twilio 凭证
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// 检查凭证是否存在
if (!accountSid || !authToken) {
  console.error('错误：未在 .env 文件中配置 TWILIO_ACCOUNT_SID 和/或 TWILIO_AUTH_TOKEN');
  process.exit(1); // 退出进程
}

const client = twilio(accountSid, authToken);

// 为您的 React 应用启用 CORS
app.use(cors({
  origin: 'http://localhost:5173' 
}));

// Endpoint to fetch TURN credentials
app.get('/api/get-turn-credentials', async (req, res) => {
  try {
    console.log("收到 /api/get-turn-credentials 请求");
    // 请求 Twilio 生成临时的 TURN 服务器凭证
    const token = await client.tokens.create();
    console.log("成功从 Twilio 获取 token");
    res.json({ iceServers: token.iceServers });
  } catch (error) {
    console.error('获取 TURN 凭证时出错:', error);
    res.status(500).send('获取 TURN 凭证失败');
  }
});

app.listen(port, () => {
  console.log(`TURN 服务器凭证代理正在监听 http://localhost:${port}`);
}); 