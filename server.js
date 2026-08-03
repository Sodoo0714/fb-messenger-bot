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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // Шинэ: Claude AI түлхүүр
const GRAPH_API_VERSION = 'v20.0';

// ---------------------------------------------------------------------------
// ЭМНЭЛГИЙН МЭДЭЭЛЭЛ
// ---------------------------------------------------------------------------
const INFO = {
  phone: '7035-0888, 9935-2335',
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
  rooms:
    'Хэвтэн эмчилгээний өрөөний үнэ (1 хоног):\n' +
    '\n🛏 4 ортой өрөө — 100,000₮\n' +
    '🛏 3 ортой өрөө — 110,000₮\n' +
    '🛏 2 ортой өрөө — 120,000₮\n' +
    '🛏 1 ортой өрөө — 140,000₮\n' +
    '\nДэлгэрэнгүй мэдээлэл, өрөө захиалгын талаар лавлах утсаар холбогдоно уу.',
};

const LOCATION_IMAGE_URL = 'https://badarhundaga.mn/bairshil.jpg';
const PAGE_ID = '221185958767806'; // Бадархундага Рашаан эмнэлгийн Page ID — өөрийн коммент давталтаас сэргийлнэ

// Коммент дотор эдгээр үгсийн аль нэг байвал автоматаар хариулна (жижиг үсгээр харьцуулна)
const COMMENT_KEYWORDS = [
  // Үнэ, төлбөр
  'үнэ', 'une', 'үнийн', 'unii', 'төлбөр', 'tulbur', 'хэд', 'hed', 'хэдээр', 'hedeer',

  // Цаг, хугацаа
  'цаг', 'tsag', 'ажиллах', 'ajillah', 'нээлттэй', 'neelttei', 'хаагдах', 'haagdah',

  // Байршил, хаяг
  'хаяг', 'hayag', 'байршил', 'bairshil', 'хаана', 'haana', 'ошиж', 'ochij',

  // Холбоо барих
  'утас', 'utas', 'дугаар', 'dugaar', 'холбогдох', 'holbogdoh', 'залгах', 'zalgah',

  // Хэрхэн, яаж
  'яаж', 'yaj', 'хэрхэн', 'herhen', 'болох', 'boloh', 'болдог', 'boldog',

  // Эмчилгээ, үйлчилгээ
  'хэвт', 'hevt', 'эмчилгээ', 'emchilgee', 'үзлэг', 'uzleg', 'шинжилгээ', 'shinjilgee',
  'бариа', 'baria', 'үзүүлэх', 'uzuuleh', 'үзүүлдэг', 'uzuuldeg',

  // Асуулт, мэдээлэл хүсэх
  'асуулт', 'asuult', 'мэдээлэл', 'medeelel', 'зөвлөгөө', 'zovlogoo',
  'тусла', 'tusla', 'ирж бол', 'irj bol', 'авч бол', 'avch bol',
  'хийдэг үү', 'hiideg uu', 'байдаг уу', 'baidag uu',
];

// Сүүлд боловсруулсан коммент ID-г санаж давхардал шүүнэ
const seenCommentIds = new Set();
const seenCommentOrder = [];
function isDuplicateComment(commentId) {
  if (!commentId) return false;
  if (seenCommentIds.has(commentId)) return true;
  seenCommentIds.add(commentId);
  seenCommentOrder.push(commentId);
  if (seenCommentOrder.length > 300) seenCommentIds.delete(seenCommentOrder.shift());
  return false;
}


// ---------------------------------------------------------------------------
// CLAUDE AI ТОХИРГОО
// ---------------------------------------------------------------------------
const CLAUDE_MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Чи бол Эрдэнэт хотын "Бадархундага Рашаан" хувийн эмнэлгийн Facebook чатын туслах.

ЭМНЭЛГИЙН МЭДЭЭЛЭЛ:
- Утас: ${INFO.phone}
- Ажиллах цаг: ${INFO.hours}
- Хаяг: Эрдэнэт хот, 11-р хороолол, хойд дугуй дэлгүүрийн баруун хойшоо шороон замаар өгсөх замд
- Вэбсайт: ${INFO.website}
- Үйлчилгээнүүд:
  * Хэвтэн эмчилгээ: дотрын эмчилгээ, уламжлалт эмчилгээ
  * Өдрийн эмчилгээ: эмийн эмчилгээ, бариа засал
  * Амбулаторийн үзлэг: дотрын эмчийн үзлэг, уламжлалт эмчилгээний үзлэг
  * Лабораторийн шинжилгээ: цусны дэлгэрэнгүй, биохими, шээсний ерөнхий, В/С вирус, цусан дахь сахар
- Хэвтэн эмчилгээний өрөөний үнэ (1 хоногийн):
  * 4 ортой өрөө — 100,000₮
  * 3 ортой өрөө — 110,000₮
  * 2 ортой өрөө — 120,000₮
  * 1 ортой өрөө — 140,000₮

ДҮРМҮҮД:
1. Зөвхөн монголоор, кирилл үсгээр, эелдэг найрсаг хариул. Хэрэглэгч латин галигаар бичсэн ч ойлгож, кириллээр хариул.
2. Товч бөгөөд тодорхой хариул — 2-4 өгүүлбэрт багтаа.
3. ЗӨВХӨН дээрх мэдээлэлд тулгуурла. Жагсаалтад байхгүй үйлчилгээ (жишээ нь ЭХО, рентген, мэс засал г.м.) асуувал: "Энэ талаар лавлах утаснаас (${INFO.phone}) тодруулна уу" гэж чиглүүл. Байхгүй үйлчилгээг байгаа мэтээр бүү хэл.
4. Онош тавихгүй, эмчилгээ зөвлөхгүй, эм бичихгүй. Өвчний шинж тэмдэг, эрүүл мэндийн зөвлөгөө асуувал: эмчид үзүүлэхийг зөвлөж, манай дотрын эмчийн үзлэгт ирэхийг эсвэл утсаар цаг захиалахыг санал болго.
5. Өрөөний үнэ асуувал дээрх өрөөний үнийн жагсаалтыг шууд хэл. Бусад үйлчилгээний (эмчилгээ, шинжилгээ г.м.) үнэ асуувал: үнийн мэдээллийг лавлах утаснаас авахыг зөвлө.
6. Цаг захиалах хүсэлтэд: утсаар (${INFO.phone}) залгаж захиалахыг зөвлө.
7. Эмнэлэгтэй огт хамааралгүй сэдвээр асуувал эелдгээр татгалзаж, эмнэлгийн асуудлаар туслахад бэлэн гэдгээ хэл.`;

// Хэрэглэгч бүрийн сүүлийн харилцан яриаг богино хугацаанд санах (сервер unтарвал арилна)
const chatHistory = new Map();
const HISTORY_LIMIT = 6; // хэрэглэгч бүрд хадгалах мессежийн тоо
const MAX_USERS = 500;

function getHistory(senderId) {
  return chatHistory.get(senderId) || [];
}

function pushHistory(senderId, role, content) {
  const hist = chatHistory.get(senderId) || [];
  hist.push({ role, content });
  while (hist.length > HISTORY_LIMIT) hist.shift();
  chatHistory.set(senderId, hist);
  // Санах ойн хамгаалалт: хэт олон хэрэглэгч болбол хамгийн хуучныг устгана
  if (chatHistory.size > MAX_USERS) {
    const firstKey = chatHistory.keys().next().value;
    chatHistory.delete(firstKey);
  }
}

async function askClaude(senderId, userText) {
  const messages = [...getHistory(senderId), { role: 'user', content: userText }];
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    },
    {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 15000,
    }
  );
  const parts = response.data.content || [];
  const text = parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
    .trim();
  if (text) {
    pushHistory(senderId, 'user', userText);
    pushHistory(senderId, 'assistant', text);
  }
  return text;
}

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
    // Коммент event-үүд (feed field-ээр ирнэ)
    const changes = entry.changes || [];
    changes.forEach((change) => {
      if (change.field !== 'feed') return;
      const value = change.value || {};
      if (value.item !== 'comment' || value.verb !== 'add') return;
      handleNewComment(value);
    });

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
      } else if (event.referral) {
        // Зарын "Send message" товчоор шууд орж ирсэн хэрэглэгч
        console.log('Ad referral received:', JSON.stringify(event.referral));
        return sendMainMenu(senderId);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 3. REPLY LOGIC
// ---------------------------------------------------------------------------
async function handleMessage(senderId, text) {
  const msg = text.trim().toLowerCase();
  const hasAny = (keywords) => keywords.some((k) => msg.includes(k));

  // Мессежийн үгийн тоо (богино мэндчилгээ эсэхийг ялгахад ашиглана)
  const wordCount = msg.split(/\s+/).filter(Boolean).length;

  // Энгийн мэндчилгээ — AI дуудалгүйгээр шууд цэс (хурдан, үнэгүй).
  // ЗАСВАР: Хуучин код "сайн" гэдэг үг агуулагдсан эсэхийг л шалгадаг байсан тул,
  // "Сайн бна уу, элэгний өвчтэй хүн эмчилдэг үү?" мэтийн БОДИТ асуулт ч мэндчилгээ
  // гэж таарч, Claude AI-руу огт хүрэлгүй ерөнхий цэс рүү буруу чиглэдэг байлаа.
  // Одоо ЗӨВХӨН мессеж богино (4 үгээс цөөн) үед л мэндчилгээ гэж үзнэ; урт/бодит
  // асуулт бол доош Claude AI-руу дамжина.
  if (
    wordCount <= 4 &&
    hasAny([
      'сайн уу',
      'сайн байна уу',
      'сайн',
      'sain uu',
      'sain baina uu',
      'sain bn u',
      'sain bna',
      'sainu',
      'sainuu',
      'sain',
      'hi',
      'hello',
      'hey',
      'menu',
      'меню',
      'start',
      'эхлэх',
    ])
  ) {
    return sendMainMenu(senderId);
  }

  // Зар сурталчилгаанаас орж ирсэн хэрэглэгчдийн түгээмэл хэллэгүүд
  if (
    hasAny([
      'мэдээлэл',
      'дэлгэрэнгүй',
      'сонирхож',
      'автомат хариулагч',
      'medeelel',
      'delgerengui',
      'sonirhoj',
      'дэлгэрэнгий',
    ])
  ) {
    return sendTextWithMenu(
      senderId,
      `Сайн байна уу! Бадархундага Рашаан эмнэлэгт тавтай морил. 🏥\n\n🕘 ${INFO.hours}\n📞 ${INFO.phone}\n\nДоорх цэснээс сонирхсон мэдээллээ сонгоно уу:`
    );
  }

  // Өрөөний үнэ асуувал шууд жагсаалт (AI дуудалгүй, хурдан бөгөөд алдаагүй)
  if (
    hasAny([
      'өрөө',
      'өрөөний',
      'ортой',
      'ор той',
      'oroo',
      'oroonii',
      'ortoi',
      'хоног',
      'honog',
      'палат',
    ])
  ) {
    return sendTextWithMenu(senderId, INFO.rooms);
  }

  // Байршил асуувал зурагтай хариулт (AI-аас илүү бүрэн)
  if (hasAny(['хаяг', 'байршил', 'хаана байдаг', 'hayag', 'bairshil', 'haana baidag', 'location'])) {
    return sendLocation(senderId);
  }

  // Бусад бүх чөлөөт асуултыг Claude AI хариулна
  if (ANTHROPIC_API_KEY) {
    try {
      await sendTypingOn(senderId);
      const aiReply = await askClaude(senderId, text);
      if (aiReply) {
        return sendTextWithMenu(senderId, aiReply);
      }
    } catch (err) {
      console.error(
        'Claude API error:',
        err.response ? JSON.stringify(err.response.data) : err.message
      );
    }
  }

  // AI ажиллаагүй үеийн нөөц хариулт
  return sendTextWithMenu(
    senderId,
    `Уучлаарай, яг одоо хариулж чадсангүй. Доорх сонголтуудаас сонгох эсвэл лавлах утсаар холбогдоно уу:\n📞 ${INFO.phone}`
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
    case 'GET_ROOMS':
      return sendTextWithMenu(senderId, INFO.rooms);
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

function sendLocation(senderId) {
  return sendImage(senderId, LOCATION_IMAGE_URL).then(() =>
    sendTextWithMenu(senderId, `Манай хаяг:\n📍 ${INFO.address}\n🌐 ${INFO.website}`)
  );
}

// ---------------------------------------------------------------------------
// 4. SENDING HELPERS
// ---------------------------------------------------------------------------
const MENU_QUICK_REPLIES = [
  { content_type: 'text', title: 'Өрөөний үнэ', payload: 'GET_ROOMS' },
  { content_type: 'text', title: 'Үнийн мэдээлэл', payload: 'GET_PRICES' },
  { content_type: 'text', title: 'Хаяг, байршил', payload: 'GET_LOCATION' },
  { content_type: 'text', title: 'Ажиллах цаг', payload: 'GET_HOURS' },
  { content_type: 'text', title: 'Цаг захиалах', payload: 'BOOK_APPT' },
  { content_type: 'text', title: 'Ажилтантай холбогдох', payload: 'TALK_HUMAN' },
  { content_type: 'text', title: 'Үйлчилгээ', payload: 'GET_SERVICES' },
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

// "Бичиж байна..." гэсэн indicator харуулах (AI бодох хооронд)
function sendTypingOn(senderId) {
  return callSendAPI({
    recipient: { id: senderId },
    sender_action: 'typing_on',
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
// 5b. COMMENT HANDLING (Facebook feed comments -> auto reply + private message)
// ---------------------------------------------------------------------------
function handleNewComment(value) {
  const commentId = value.comment_id;
  const text = (value.message || '').toLowerCase();

  if (!commentId || isDuplicateComment(commentId)) return;

  // МААШ ЧУХАЛ: Page-ийн ӨӨРИЙН комментыг (манай ботын хариу оролцуулаад) огт бүү боловсрол.
  // Үгүй бол бот өөрийн хариу коммент дээрээ дахин үйлдэл хийж хязгааргүй давталтад орно.
  if (value.from && value.from.id === PAGE_ID) {
    console.log('Ignored: comment from our own Page, id =', commentId);
    return;
  }

  const matched = COMMENT_KEYWORDS.some((k) => text.includes(k));
  if (!matched) return;

  console.log('Matched comment:', commentId, '-', value.message);

  // Komментод нийтийн хариу бичих (private_replies нь Advanced Access шаарддаг тул
  // одоогоор зөвхөн нийтийн хариулт ашиглана — энэ нь хэрэглэгчийг Messenger руу чиглүүлнэ,
  // тэгээд манай ердийн messages webhook үргэлжлүүлж хариулна).
  //
  // ЗАСВАР v2: Зүгээр нэрийг текст болгон бичих нь бодит "tag" болохгүй тул notification
  // явуулдаггүй нь тогтоогдсон (зөвхөн profile-руу шилждэг цэнхэр mention л notify хийдэг).
  // Иймд Facebook-ийн "@[user-id]" mention синтаксыг ашиглаж, коммент бичигчийн PSID/ID-г
  // шууд tag болгож оруулна. Хэрэв ID байхгүй бол хуучин нэр-текст хувилбар руу буцна.
  const commenterId = value.from && value.from.id ? value.from.id : null;
  const commenterName = value.from && value.from.name ? value.from.name : '';
  const mentionOrName = commenterId
    ? `@[${commenterId}] `
    : commenterName
    ? `${commenterName} `
    : '';

  callGraphAPI(`/${commentId}/comments`, {
    message: `${mentionOrName}Сайн байна уу! Манай чатны автомат хариулагчаас дэлгэрэнгүй мэдээлэл аваарай 😊`,
  });

  // Коммент дээр Like дарах (ManyChat-ийн хийдэг байсан зан төлөв).
  // pages_manage_engagement эрхтэй бол шууд ажиллана — нэмэлт App Review шаардахгүй.
  callGraphAPI(`/${commentId}/likes`, {});

  // Хэрэглэгчийн Messenger рүү шууд private reply илгээх (ManyChat-д байсан "chat руу бичих" функц).
  // ЭНЭ НЬ pages_messaging permission-ий Advanced Access шаарддаг. Одоогоор App Review
  // дуусаагүй тул permission error өгч болзошгүй — Render лог дотор
  // "Graph API error (/{commentId}/private_replies): ..." гэж харагдвал яг энэ шалтгаан.
  // App Review batlagdsanii daraa энэ мөр нэмэлт өөрчлөлтгүйгээр ажиллаж эхэлнэ.
  callGraphAPI(`/${commentId}/private_replies`, {
    message: `Сайн байна уу! Бадархундага Рашаан эмнэлэгт тавтай морил. 🏥\n\n🕘 ${INFO.hours}\n📞 ${INFO.phone}\n\nДоорх цэснээс сонирхсон мэдээллээ сонгоно уу:`,
  });
}

async function callGraphAPI(path, body) {
  try {
    await axios.post(`https://graph.facebook.com/${GRAPH_API_VERSION}${path}`, body, {
      params: { access_token: PAGE_ACCESS_TOKEN },
    });
  } catch (err) {
    console.error(
      `Graph API error (${path}):`,
      err.response ? JSON.stringify(err.response.data) : err.message
    );
  }
}

// ---------------------------------------------------------------------------
// 5c. MESSENGER PROFILE SETUP (Get Started товч + persistent menu)
// ---------------------------------------------------------------------------
// Graph API Explorer дээр permission асуудалтай тул, серверийн өөрийн
// PAGE_ACCESS_TOKEN-оор шууд тохируулна. Браузераасаа нэг удаа дуудахад хангалттай:
//   https://<таны-render-хаяг>/setup-profile
// Шалгахдаа:
//   https://<таны-render-хаяг>/check-profile

app.get('/check-profile', async (req, res) => {
  try {
    const r = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messenger_profile`,
      {
        params: {
          fields: 'get_started,persistent_menu,ice_breakers',
          access_token: PAGE_ACCESS_TOKEN,
        },
      }
    );
    res.json(r.data);
  } catch (err) {
    res.status(500).json(err.response ? err.response.data : { error: err.message });
  }
});

// Талбар бүрийг ТУСДАА илгээнэ. Нэг дуудалтаар илгээхэд Facebook нэгийг нь чимээгүй
// хаячихаад ерөнхийдөө "success" буцаадаг тул аль нь унасныг харах боломжгүй байсан.
async function setProfileField(name, body) {
  try {
    const r = await axios.post(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messenger_profile`,
      body,
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    return { field: name, ok: true, result: r.data };
  } catch (err) {
    return {
      field: name,
      ok: false,
      error: err.response ? err.response.data : err.message,
    };
  }
}

app.get('/setup-profile', async (req, res) => {
  const results = [];

  results.push(
    await setProfileField('get_started', { get_started: { payload: 'GET_STARTED' } })
  );

  results.push(
    await setProfileField('ice_breakers', {
      ice_breakers: [
        {
          locale: 'default',
          call_to_actions: [
            { question: 'Ямар үйлчилгээ үзүүлдэг вэ?', payload: 'GET_SERVICES' },
            { question: 'Өрөөний үнэ хэд вэ?', payload: 'GET_ROOMS' },
            { question: 'Хаана байрладаг вэ?', payload: 'GET_LOCATION' },
            { question: 'Цаг захиалмаар байна', payload: 'BOOK_APPT' },
          ],
        },
      ],
    })
  );

  results.push(
    await setProfileField('persistent_menu', {
      persistent_menu: [
        {
          locale: 'default',
          composer_input_disabled: false,
          call_to_actions: [
            { type: 'postback', title: 'Үндсэн цэс', payload: 'GET_STARTED' },
            { type: 'postback', title: 'Хаяг, байршил', payload: 'GET_LOCATION' },
            { type: 'postback', title: 'Цаг захиалах', payload: 'BOOK_APPT' },
          ],
        },
      ],
    })
  );

  res.json({ results });
});

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
