require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v20.0';

// ---------------------------------------------------------------------------
// 1. WEBHOOK VERIFICATION (Facebook calls this once, when you set up the webhook
//    in the Developer Console, to confirm you own the endpoint)
// ---------------------------------------------------------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------------------------------------------------------------------------
// 2. RECEIVING MESSAGES
// ---------------------------------------------------------------------------
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object !== 'page') {
    return res.sendStatus(404);
  }

  body.entry.forEach((entry) => {
    const event = entry.messaging[0];
    const senderId = event.sender.id;

    if (event.message && event.message.text) {
      handleMessage(senderId, event.message.text);
    } else if (event.message && event.message.quick_reply) {
      handleQuickReply(senderId, event.message.quick_reply.payload);
    } else if (event.postback) {
      handleQuickReply(senderId, event.postback.payload);
    }
  });

  // Must respond within a few seconds or Facebook will retry the webhook
  res.status(200).send('EVENT_RECEIVED');
});

// ---------------------------------------------------------------------------
// 3. REPLY LOGIC  (customize this section for your business)
// ---------------------------------------------------------------------------
function handleMessage(senderId, text) {
  const msg = text.trim().toLowerCase();

  if (['сайн уу', 'hi', 'hello', 'menu', 'start'].some((k) => msg.includes(k))) {
    return sendMainMenu(senderId);
  }

  if (msg.includes('цаг') || msg.includes('ажиллах')) {
    return sendText(senderId, 'Бид Даваа-Баасан 09:00-18:00 цагт ажилладаг.');
  }

  if (msg.includes('үнэ') || msg.includes('price')) {
    return sendText(senderId, 'Үнийн мэдээллийг авахын тулд ямар бүтээгдэхүүн сонирхож байгаагаа бичнэ үү.');
  }

  // Fallback: unknown message -> offer the menu again
  return sendText(
    senderId,
    'Уучлаарай, ойлгосонгүй. Доорх сонголтуудаас сонгоно уу.',
    () => sendMainMenu(senderId)
  );
}

function handleQuickReply(senderId, payload) {
  switch (payload) {
    case 'GET_HOURS':
      return sendText(senderId, 'Бид Даваа-Баасан 09:00-18:00 цагт ажилладаг.');
    case 'GET_PRICES':
      return sendText(senderId, 'Ямар бүтээгдэхүүн/үйлчилгээ сонирхож байгаагаа бичнэ үү.');
    case 'TALK_HUMAN':
      return sendText(senderId, 'Манай ажилтан тантай удахгүй холбогдох болно. Хүлээцтэй хандсанд баярлалаа!');
    default:
      return sendMainMenu(senderId);
  }
}

function sendMainMenu(senderId) {
  const payload = {
    recipient: { id: senderId },
    message: {
      text: 'Сайн байна уу! Танд юугаар туслах вэ?',
      quick_replies: [
        { content_type: 'text', title: 'Ажиллах цаг', payload: 'GET_HOURS' },
        { content_type: 'text', title: 'Үнийн мэдээлэл', payload: 'GET_PRICES' },
        { content_type: 'text', title: 'Хүнтэй ярих', payload: 'TALK_HUMAN' },
      ],
    },
  };
  return callSendAPI(payload);
}

function sendText(senderId, text, callback) {
  const payload = {
    recipient: { id: senderId },
    message: { text },
  };
  return callSendAPI(payload).then(() => {
    if (callback) callback();
  });
}

// ---------------------------------------------------------------------------
// 4. SEND API WRAPPER
// ---------------------------------------------------------------------------
async function callSendAPI(payload) {
  try {
    await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages`,
      payload,
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
  } catch (err) {
    console.error('Send API error:', err.response ? err.response.data : err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));
