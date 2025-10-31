// api/index.js
const SESSION_KEY = 'wakeUp';

// Vercel: используем globalThis
if (!globalThis.wakeUpStates) globalThis.wakeUpStates = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // --- ЗАЩИТА: проверяем все поля ---
  if (!body.request || !body.version) {
    return res.status(400).json({ error: 'Invalid request: missing request or version' });
  }

  const request = body.request;
  const version = body.version;
  const session = body.session || {};
  const userId = session.user_id || session.application?.application_id || 'unknown_user';

  const now = Date.now();
  const userState = globalThis.wakeUpStates[userId] || {
    targetTime: null,
    stage: 'idle',
    timeoutId: null
  };

  let response = { text: '', end_session: false, tts: '' };

  try {
    const cmd = (request.command || '').toString().toLowerCase().trim();

    // === КОМАНДА "разбуди в 7:30" ===
    if (cmd.includes('разбуди') || cmd.includes('будильник')) {
      const match = cmd.match(/(\d{1,2})[.:]?(\d{2})?/);
      if (!match) {
        response.text = 'Скажи время: "разбуди в 7:30"';
        return send(res, response, version, session);
      }

      let [_, h, m = '00'] = match;
      const hours = parseInt(h), minutes = parseInt(m);
      if (hours > 23 || minutes > 59) {
        response.text = 'Неверное время';
        return send(res, response, version, session);
      }

      let target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);

      userState.targetTime = target.getTime();
      userState.stage = 'waiting';
      globalThis.wakeUpStates[userId] = userState;

      const delay = target.getTime() - now;
      userState.timeoutId = setTimeout(() => triggerWakeUp(userId), Math.min(delay, 2147483647)); // max 24.8 дней

      response.text = `Разбужу в ${hours}:${m.padStart(2, '0')}. Спокойной ночи!`;
      return send(res, response, version, session, { wakeUp: userState });
    }

    // === ТЕСТ: "тест будильника" ===
    if (cmd.includes('тест будильника')) {
      userState.targetTime = now + 10000; // через 10 сек
      userState.stage = 'waiting';
      userState.timeoutId = setTimeout(() => triggerWakeUp(userId), 10000);
      globalThis.wakeUpStates[userId] = userState;
      response.text = 'Тест: разбужу через 10 секунд';
      return send(res, response, version, session, { wakeUp: userState });
    }

    // === СТАДИИ ПРОБУЖДЕНИЯ ===
    if (userState.stage === 'waiting' && userState.targetTime && now >= userState.targetTime) {
      userState.stage = 'waking';
      response.text = 'Вставай с добрым утром!';
      response.tts = 'Вставай с добрым утром!';
      userState.timeoutId = setTimeout(() => askAwake(userId, 1), 30000);
      globalThis.wakeUpStates[userId] = userState;
      return send(res, response, version, session, { wakeUp: userState });
    }

    // === Ответ на "Проснулся?" ===
    if (['asked_once', 'asked_twice'].includes(userState.stage)) {
      if (cmd && !cmd.includes('нет')) {
        response.text = 'Отлично! Хорошего дня!';
        response.end_session = true;
        clearTimeout(userState.timeoutId);
        delete globalThis.wakeUpStates[userId];
        return send(res, response, version, session);
      }
    }

    // === ВНУТРЕННИЕ ТРИГГЕРЫ ===
    if (cmd === '__trigger__' && request.payload?.type) {
      const type = request.payload.type;

      if (type === 'waking') {
        response.text = 'Вставай с добрым утром!';
        userState.stage = 'waking';
        userState.timeoutId = setTimeout(() => askAwake(userId, 1), 30000);
      } else if (type === 'ask1') {
        response.text = 'Проснулся?';
        userState.stage = 'asked_once';
        userState.timeoutId = setTimeout(() => askAwake(userId, 2), 60000);
      } else if (type === 'ask2') {
        response.text = 'Проснулся?';
        userState.stage = 'asked_twice';
        userState.timeoutId = setTimeout(() => playMusic(userId), 60000);
      } else if (type === 'music') {
        response.text = 'Включаю бодрую музыку!';
        response.directives = [{
          name: 'start_music',
          payload: { content: { type: 'playlist', id: 'popular_morning' }}
        }];
        response.end_session = true;
        delete globalThis.wakeUpStates[userId];
      }

      globalThis.wakeUpStates[userId] = userState;
      return send(res, response, version, session);
    }

    // === ПО УМОЛЧАНИЮ ===
    response.text = 'Скажи: "разбуди меня в 7:30" или "тест будильника"';
    return send(res, response, version, session);

  } catch (err) {
    console.error('Ошибка:', err);
    response.text = 'Ошибка. Попробуй позже.';
    return send(res, response, version, session);
  }
}

// === ТРИГГЕРЫ ===
function triggerWakeUp(userId) { sendTrigger(userId, 'waking'); }
function askAwake(userId, n) { sendTrigger(userId, `ask${n}`); }
function playMusic(userId) { sendTrigger(userId, 'music'); }

async function sendTrigger(userId, type) {
  const url = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/index`
    : 'http://localhost:3000/api/index';

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: { command: '__trigger__', payload: { type }, version: '1.0' },
      session: { user_id: userId },
      version: '1.0'
    })
  }).catch(err => console.error('Trigger error:', err));
}

function send(res, response, version, session, session_state = {}) {
  res.json({
    response,
    session_state,
    version,
    session
  });
}