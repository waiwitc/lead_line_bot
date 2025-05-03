require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const bodyParser = require('body-parser');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new Client(config);
const app = express();
app.use(middleware(config));
app.use(bodyParser.json());

const sessions = {};
const questions = [
  '1. คุณมีงบประมาณเท่าไหร่ครับ? (บาท)',
  '2. วางแผนชำระเงินแบบไหน? (เงินสด/กู้)',
  '3. รายได้ต่อเดือนของคุณประมาณเท่าไหร่?',
  '4. เอกสารกู้พร้อมหรือยังครับ?',
  '5. ตั้งใจจะซื้อภายในกี่เดือน?'
];

app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      await handleMessage(event);
    }
  }
  res.sendStatus(200);
});

async function handleMessage(event) {
  const userId = event.source.userId;
  const msg = event.message.text.trim();
  let session = sessions[userId] || { step: 0, answers: [] };

  if (session.step > 0) session.answers[session.step - 1] = msg;

  if (session.step < questions.length) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: questions[session.step]
    });
    session.step++;
  } else {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ขอบคุณครับ! ข้อมูลของคุณถูกบันทึกแล้ว ✅\n' +
        session.answers.map((a, i) => `ข้อ ${i + 1}: ${questions[i]}\nตอบ: ${a}`).join('\n\n')
    });
    delete sessions[userId];
  }
  sessions[userId] = session;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
