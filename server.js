require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.url}`);
  next();
});
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v20.0';

// ---------------------------------------------------------------------------
// ЭМНЭЛГИЙН МЭДЭЭЛЭЛ
// ---------------------------------------------------------------------------
const INFO = {
  phone: '7035-08888, 9935-2335',
  hours: 'Даваа–Баасан: 24 цагаар',
  address:
    'Эрдэнэт хот, 11-р хороолол,\nхойд дугуй дэлгүүрийн баруун хойшоо\nшороон замаар өгсөх замд',
  website: 'https://badarhundaga.mn',
  services:
    'Манай эмнэлгийн үйлчилгээнүүд:\n' +
    '\n🏥 Хэвтэн эмчилгээ\n' +
    '• Дотрын эмчилгээ\n' +
    '• Уламжлалт эмчилгээ\n' +
    '\n☀️ Өдрийн эмчилгээ\n' +
    '• Эмийн эмчилгээ\n' +
    '• Бариа засал\n' +
    '\n🩺 Амбулаторийн үзлэг\n' +
    '• Дотрын эмчийн үзлэг\n' +
    '• Уламжлалт эмчилгээний үзлэг\n' +
    '\n🔬 Лабораторийн шинжилгээ\n' +
    '• Цусны дэлгэрэнгүй шинжилгээ\n' +
    '• Биохимийн шинжилгээ\n' +
    '• Шээсний ерөнхий шинжилгээ\n' +
    '• В, С вирусын шинжилгээ\n' +
    '• Цусан дахь сахарын шинжилгээ',
};

// Байршлын зураг — badarhundaga-website repo-д bairshil.jpg нэрээр байршуулна
const LOCATION_IMAGE_URL = 'https://badarhundaga.mn/bairshil.jpg';

// ---------------------------------------------------------------------------
// 1. WEBHOOK VERIFICATION
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

// Health check / keep-alive ping
app.get('/', (req, res) => res.status(200).send('OK'));

// ---------------------------------------------------------------------------
// 2. RECEIVING MESSAGES
// ---------------------------------------------------------------------------
const seenMids = new Set();
const seenOrder = [];
function isDuplicate(mid) {
  if (!mid) return false;
  if (seenMids.has(mid)) return true;
  seenMids.add(mid);
  seenOrder.push(mid);
  if (seenOrder.length > 300) seenMids.delete(seenOrder.shift());
  return false;
}

app.post('/webhook', (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (body.object !== 'page') {
    console.log('Ignored: not a page event, object =', body.object);
    return;
  }

  body.entry.forEach((entry) => {
    const events = entry.messaging || [];
    events.forEach((event) => {
      const senderId = event.sender && event.sender.id;
      if (!senderId) return;

      if (event.message) {
        if (event.message.is_echo) return;
        if (isDuplicate(event.message.mid)) {
          console.log('Duplicate skipped:', event.message.mid);
          return;
        }
        if (event.message.quick_reply) {
          return handleQuickReply(senderId, event.message.quick_reply.payload);
        }
        if (event.message.text) {
          return handleMessage(senderId, event.message.text);
        }
        return sendTextWithMenu(
          senderId,
          'Таны илгээсэн зүйлийг хүлээж авлаа. Асуух зүйл байвал бичээрэй!'
        );
      } else if (event.postback) {
        return handleQuickReply(senderId, event.postback.payload);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 3. REPLY LOGIC
// ---------------------------------------------------------------------------
function handleMessage(senderId, text) {
  const msg = text.trim().toLowerCase();
  const hasAny = (keywords) => keywords.some((k) => msg.includes(k));

  if (hasAny(['сайн уу', 'сайн байна уу', 'hi', 'hello', 'menu', 'меню', 'start', 'эхлэх'])) {
    return sendMainMenu(senderId);
  }

  if (hasAny(['захиал', 'цаг ав', 'бүртгүүл', 'үзүүлье', 'үзүүлэх'])) {
    return sendTextWithMenu(
      senderId,
      `Цаг захиалахын тулд манай лавлах утас руу залгана уу:\n📞 ${INFO.phone}\n🕘 ${INFO.hours}`
    );
  }

  if (hasAny(['ажиллах цаг', 'хэдэн цаг', 'нээлттэй', 'хаагдах', 'ажилладаг', 'цагийн хуваарь'])) {
    return sendTextWithMenu(senderId, `Манай ажиллах цаг:\n🕘 ${INFO.hours}`);
  }

  if (hasAny(['хаяг', 'байршил', 'хаана', 'очих', 'location', 'зам'])) {
    return sendLocation(senderId);
  }

  if (hasAny(['үнэ', 'үнийн', 'төлбөр', 'хэд вэ', 'хэдээр', 'price'])) {
    return sendTextWithMenu(
      senderId,
      `Үйлчилгээний үнийн дэлгэрэнгүй мэдээллийг лавлах утаснаас авна уу:\n📞 ${INFO.phone}\nЭсвэл ямар үйлчилгээ сонирхож байгаагаа бичээрэй.`
    );
  }

  if (hasAny(['утас', 'дугаар', 'залгах', 'холбогдох'])) {
    return sendTextWithMenu(senderId, `Манай лавлах утас:\n📞 ${INFO.phone}`);
  }

  if (
    hasAny([
      'үйлчилгээ',
      'эмчилгээ',
      'тасаг',
      'үзлэг',
      'оношилгоо',
      'шинжилгээ',
      'бариа',
      'лаборатори',
      'хэвтэх',
      'хэвтэн',
    ])
  ) {
    return sendTextWithMenu(senderId, INFO.services);
  }

  if (hasAny(['баярлалаа', 'баярлаа', 'thanks', 'thank you', 'гоё'])) {
    return sendTextWithMenu(senderId, 'Баярлалаа! Өөр асуух зүйл байвал бичээрэй. 😊');
  }

  return sendTextWithMenu(
    senderId,
    'Уучлаарай, таны асуултыг сайн ойлгосонгүй. Доорх сонголтуудаас сонгох эсвэл асуултаа өөрөөр бичээд үзээрэй.'
  );
}

function handleQuickReply(senderId, payload) {
  switch (payload) {
    case 'BOOK_APPT':
      return sendTextWithMenu(
        senderId,
        `Цаг захиалахын тулд манай лавлах утас руу залгана уу:\n📞 ${INFO.phone}\n🕘 ${INFO.hours}`
      );
    case 'GET_HOURS':
      return sendTextWithMenu(senderId, `Манай ажиллах цаг:\n🕘 ${INFO.hours}`);
    case 'GET_LOCATION':
      return sendLocation(senderId);
    case 'GET_PRICES':
      return sendTextWithMenu(
        senderId,
        `Үйлчилгээний үнийн дэлгэрэнгүй мэдээллийг лавлах утаснаас авна уу:\n📞 ${INFO.phone}\nЭсвэл ямар үйлчилгээ сонирхож байгаагаа бичээрэй.`
      );
    case 'GET_SERVICES':
      return sendTextWithMenu(senderId, INFO.services);
    case 'TALK_HUMAN':
      return sendTextWithMenu(
        senderId,
        `Манай ажилтан тантай удахгүй холбогдох болно. Яаралтай бол утсаар холбогдоорой:\n📞 ${INFO.phone}\nХүлээцтэй хандсанд баярлалаа!`
      );
    case 'GET_STARTED':
      return sendMainMenu(senderId);
    default:
      return sendMainMenu(senderId);
  }
}

// Байршил: эхлээд зураг, дараа нь хаягийн текст (цэсний товчнуудтай хамт)
function sendLocation(senderId) {
  return sendImage(senderId, LOCATION_IMAGE_URL).then(() =>
    sendTextWithMenu(senderId, `Манай хаяг:\n📍 ${INFO.address}\n🌐 ${INFO.website}`)
  );
}

// ---------------------------------------------------------------------------
// 4. SENDING HELPERS
// ---------------------------------------------------------------------------
const MENU_QUICK_REPLIES = [
  { content_type: 'text', title: 'Цаг захиалах', payload: 'BOOK_APPT' },
  { content_type: 'text', title: 'Ажиллах цаг', payload: 'GET_HOURS' },
  { content_type: 'text', title: 'Хаяг, байршил', payload: 'GET_LOCATION' },
  { content_type: 'text', title: 'Үйлчилгээ', payload: 'GET_SERVICES' },
  { content_type: 'text', title: 'Үнийн мэдээлэл', payload: 'GET_PRICES' },
  { content_type: 'text', title: 'Хүнтэй ярих', payload: 'TALK_HUMAN' },
];

function sendMainMenu(senderId) {
  return callSendAPI({
    recipient: { id: senderId },
    message: {
      text: 'Сайн байна уу! Бадархундага Рашаан эмнэлэгт тавтай морил. Танд юугаар туслах вэ?',
      quick_replies: MENU_QUICK_REPLIES,
    },
  });
}

// Хариулт бүрд цэсний товчнууд дахин хавсарч очно
function sendTextWithMenu(senderId, text) {
  return callSendAPI({
    recipient: { id: senderId },
    message: { text, quick_replies: MENU_QUICK_REPLIES },
  });
}

function sendText(senderId, text) {
  return callSendAPI({
    recipient: { id: senderId },
    message: { text },
  });
}

function sendImage(senderId, imageUrl) {
  return callSendAPI({
    recipient: { id: senderId },
    message: {
      attachment: {
        type: 'image',
        payload: { url: imageUrl, is_reusable: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// 5. SEND API WRAPPER
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

// ---------------------------------------------------------------------------
// 6. PRIVACY POLICY PAGE
// ---------------------------------------------------------------------------
app.get('/privacy', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(`
    <html>
      <head><title>Privacy Policy</title></head>
      <body style="font-family: sans-serif; max-width: 700px; margin: 40px auto; line-height: 1.6;">
        <h1>Privacy Policy</h1>
        <p>This Messenger bot is operated to help people communicate with our Facebook Page.</p>
        <p>When you message our Page, we receive your Facebook user ID and the content of your
        messages. This information is used only to respond to your questions and provide
        customer support. We do not sell or share this information with third parties.</p>
        <p>You can stop this at any time by simply not messaging the Page. If you have questions
        about this policy, please contact us directly through the Page.</p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));
