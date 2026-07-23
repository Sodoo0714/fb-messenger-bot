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
// ЭМНЭЛГИЙН МЭДЭЭЛЭЛ — ЗАСАХ ХЭСЭГ (өөрийн бодит мэдээллээр шинэчилнэ үү!)
// ---------------------------------------------------------------------------
const INFO = {
  phone: '7035-0888, 9935-2335', // ЗАСАХ: лавлах утас зөв эсэхийг шалгана уу
  hours: 'Даваа–Ням 24 цаг ажиллана.', // ЗАСАХ: ажлын цаг, амралтын өдрөөр ажилладаг бол нэмнэ үү
  address:
    'Орхон аймаг, Баян-Өндөр сум, Хүрэнбулаг баг, 4 байр\n(Бадархундага Рашаан эмнэлэг)', // ЗАСАХ
  website: 'https://badarhundaga.mn',
  services:
    'Манай эмнэлэг дараах үйлчилгээг үзүүлдэг:\n• Рашаан эмчилгээ\n• Дотрын үзлэг, оношилгоо\n• Сэргээн засах эмчилгээ', // ЗАСАХ: бодит тасаг/үйлчилгээгээ жагсаана уу
};

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

// Health check / keep-alive ping (cron-job.org энэ зам руу ping хийнэ)
app.get('/', (req, res) => res.status(200).send('OK'));

// ---------------------------------------------------------------------------
// 2. RECEIVING MESSAGES
// ---------------------------------------------------------------------------

// Давхардсан илгээлтийг шүүх: Meta нэг мессежийг retry хийж давтан илгээдэг
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
  // Meta-д ЭХЛЭЭД 200 хариу өгнө (5 секундын дүрэм) — дараа нь боловсруулна
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
        if (event.message.is_echo) return; // Page-ийн өөрийн илгээсэн мессежийг алгасах
        if (isDuplicate(event.message.mid)) {
          console.log('Duplicate skipped:', event.message.mid);
          return;
        }
        // ЧУХАЛ: quick_reply-г text-ээс ӨМНӨ шалгана (quick reply нь хоёуланг агуулдаг)
        if (event.message.quick_reply) {
          return handleQuickReply(senderId, event.message.quick_reply.payload);
        }
        if (event.message.text) {
          return handleMessage(senderId, event.message.text);
        }
        // Зураг, стикер г.м. текстгүй мессеж
        return sendText(senderId, 'Таны илгээсэн зүйлийг хүлээж авлаа. Асуух зүйл байвал бичээрэй!', () =>
          sendMainMenu(senderId)
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
    return sendText(
      senderId,
      `Цаг захиалахын тулд манай лавлах утас руу залгана уу:\n📞 ${INFO.phone}\n${INFO.hours}`
    );
  }

  if (hasAny(['ажиллах цаг', 'хэдэн цаг', 'нээлттэй', 'хаагдах', 'ажилладаг'])) {
    return sendText(senderId, `Манай ажиллах цаг:\n🕘 ${INFO.hours}`);
  }

  if (hasAny(['хаяг', 'байршил', 'хаана', 'очих', 'location'])) {
    return sendText(senderId, `Манай хаяг:\n📍 ${INFO.address}\n🌐 ${INFO.website}`);
  }

  if (hasAny(['үнэ', 'үнийн', 'төлбөр', 'хэд вэ', 'хэдээр', 'price'])) {
    return sendText(
      senderId,
      `Үйлчилгээний үнийн дэлгэрэнгүй мэдээллийг лавлах утаснаас авна уу:\n📞 ${INFO.phone}\nЭсвэл ямар үйлчилгээ сонирхож байгаагаа бичээрэй.`
    );
  }

  if (hasAny(['утас', 'дугаар', 'залгах', 'холбогдох'])) {
    return sendText(senderId, `Манай лавлах утас:\n📞 ${INFO.phone}`);
  }

  if (hasAny(['үйлчилгээ', 'эмчилгээ', 'рашаан', 'тасаг', 'үзлэг', 'оношилгоо'])) {
    return sendText(senderId, INFO.services, () => sendMainMenu(senderId));
  }

  if (hasAny(['баярлалаа', 'баярлаа', 'thanks', 'thank you', 'гоё'])) {
    return sendText(senderId, 'Баярлалаа! Өөр асуух зүйл байвал бичээрэй. 😊');
  }

  // Ойлгоогүй үед: цэсээ санал болгоно
  return sendText(
    senderId,
    'Уучлаарай, таны асуултыг сайн ойлгосонгүй. Доорх сонголтуудаас сонгох эсвэл асуултаа өөрөөр бичээд үзээрэй.',
    () => sendMainMenu(senderId)
  );
}

function handleQuickReply(senderId, payload) {
  switch (payload) {
    case 'BOOK_APPT':
      return sendText(
        senderId,
        `Цаг захиалахын тулд манай лавлах утас руу залгана уу:\n📞 ${INFO.phone}\n${INFO.hours}`
      );
    case 'GET_HOURS':
      return sendText(senderId, `Манай ажиллах цаг:\n🕘 ${INFO.hours}`);
    case 'GET_LOCATION':
      return sendText(senderId, `Манай хаяг:\n📍 ${INFO.address}\n🌐 ${INFO.website}`);
    case 'GET_PRICES':
      return sendText(
        senderId,
        `Үйлчилгээний үнийн дэлгэрэнгүй мэдээллийг лавлах утаснаас авна уу:\n📞 ${INFO.phone}\nЭсвэл ямар үйлчилгээ сонирхож байгаагаа бичээрэй.`
      );
    case 'GET_SERVICES':
      return sendText(senderId, INFO.services);
    case 'TALK_HUMAN':
      return sendText(
        senderId,
        `Манай ажилтан тантай удахгүй холбогдох болно. Яаралтай бол утсаар холбогдоорой:\n📞 ${INFO.phone}\nХүлээцтэй хандсанд баярлалаа!`
      );
    case 'GET_STARTED':
      return sendMainMenu(senderId);
    default:
      return sendMainMenu(senderId);
  }
}

function sendMainMenu(senderId) {
  const payload = {
    recipient: { id: senderId },
    message: {
      text: 'Сайн байна уу! Бадархундага Рашаан эмнэлэгт тавтай морил. Танд юугаар туслах вэ?',
      quick_replies: [
        { content_type: 'text', title: 'Цаг захиалах', payload: 'BOOK_APPT' },
        { content_type: 'text', title: 'Ажиллах цаг', payload: 'GET_HOURS' },
        { content_type: 'text', title: 'Хаяг, байршил', payload: 'GET_LOCATION' },
        { content_type: 'text', title: 'Үйлчилгээ', payload: 'GET_SERVICES' },
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

// ---------------------------------------------------------------------------
// 5. PRIVACY POLICY PAGE
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
