require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

// LINE bot config
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new Client(config);
const app = express();
app.use(middleware(config));
app.use(bodyParser.json());

// Session store per userId
const sessions = {};
const questions = [
  '1. คุณมีงบประมาณเท่าไหร่ครับ? (บาท)',
  '2. วางแผนชำระเงินแบบไหน? (เงินสด/กู้)',
  '3. รายได้ต่อเดือนของคุณประมาณเท่าไหร่?',
  '4. เอกสารกู้พร้อมหรือยังครับ?',
  '5. ตั้งใจจะซื้อภายในกี่เดือน?'
];

// LINE webhook
app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      await handleMessage(event);
    }
  }
  res.sendStatus(200);
});

// Handle messages
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

    await saveToGoogleSheet(session.answers);
    delete sessions[userId];
  }

  sessions[userId] = session;
}

// Save to Google Sheets
async function saveToGoogleSheet(answers) {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const spreadsheetId = '1JZUBNdIxGlVBmNo2EcNN5aYS_n6qvcesuYfDp8ENW4U';
  const sheetName = 'Line Chat Bot';

  const row = [new Date().toISOString(), ...answers];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row]
    }
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LINE bot running on port ${PORT}`));
