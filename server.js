<<<<<<< HEAD
import 'dotenv/config';
import express from 'express';
import twilio from 'twilio';
import cors from 'cors';
=======
require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
>>>>>>> 191bc58a3eae79c25f0b01b267e74f10ed17df76

const app = express();
const port = 3001;

<<<<<<< HEAD
// .env 文件中需要有这些变量
=======
// Your Twilio credentials
>>>>>>> 191bc58a3eae79c25f0b01b267e74f10ed17df76
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
<<<<<<< HEAD
  console.error("错误：TWILIO_ACCOUNT_SID 和 TWILIO_AUTH_TOKEN 必须在 .env 文件中设置。");
=======
  console.error('Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in your .env file');
>>>>>>> 191bc58a3eae79c25f0b01b267e74f10ed17df76
  process.exit(1);
}

const client = twilio(accountSid, authToken);

// Enable CORS for your React app
app.use(cors({
  origin: 'http://localhost:5173' 
}));

// Endpoint to fetch TURN credentials
app.get('/api/get-turn-credentials', async (req, res) => {
  try {
<<<<<<< HEAD
    console.log("收到 /api/get-turn-credentials 请求");
    // 请求 Twilio 生成临时的 TURN 服务器凭证
    const token = await client.tokens.create();
    console.log("成功从 Twilio 获取 token");
    res.json({ iceServers: token.iceServers });
  } catch (error) {
    console.error('获取 TURN 凭证时出错:', error);
    res.status(500).send('获取 TURN 凭证失败');
=======
    // Ask Twilio for a new set of temporary credentials
    const token = await client.tokens.create();
    // Send the credentials back to the frontend
    res.json(token.iceServers);
  } catch (error) {
    console.error('Error fetching TURN credentials from Twilio:', error);
    res.status(500).send('Failed to fetch TURN credentials');
>>>>>>> 191bc58a3eae79c25f0b01b267e74f10ed17df76
  }
});

app.listen(port, () => {
<<<<<<< HEAD
  console.log(`TURN 服务器凭证代理正在监听 http://localhost:${port}`);
=======
  console.log(`Twilio token server listening on port ${port}`);
>>>>>>> 191bc58a3eae79c25f0b01b267e74f10ed17df76
}); 