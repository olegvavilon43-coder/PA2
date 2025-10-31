// api/index.js
const SESSION_KEY = 'wakeUp';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { request, session, version, state } = req.body;
  const userId = session.user_id;
  const now = new Date();

  // Хранилище состояний (в реальном продакшене — Redis, но для Vercel используем глобальный объект)
  if (!global.wakeUpStates) global.wakeUpStates = {};

  const userState = global.wakeUpStates[userId] || {
    targetTime: null,
    stage: 'idle', // idle, waiting, asked_once, asked_twice, playing_music
    timeoutId: null
  };

  let response = {
    text: '',
    end_session: false,
    tts: '',
    buttons: []
  };

  // --- Парсинг команды "разбуди в 7:30" ---
  if (request.command.toLowerCase().includes('разбуди') || request.command.toLowerCase().includes('будильник')) {
    const timeMatch = request.command.match(/(\d{1,2})[.:]?(\d{2})?/);
    if (!timeMatch) {
      response.text = 'Скажи время, например: "разбуди в 7:30"';
      return send(res, { response, version, session });
    }

    let [_, hours, minutes = '00'] = timeMatch;
    hours = parseInt(hours);
    minutes = parseInt(minutes);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      response.text = 'Неверное время. Попробуй: "разбуди в 8:15"';
      return send(res, { response, version, session });
    }

    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // Если время уже прошло — на завтра
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    userState.targetTime = target.getTime();
    userState.stage = 'waiting';
    global.wakeUpStates[userId] = userState;

    // Установка таймаута
    const delay = target - now;
    userState.timeoutId = setTimeout(() => triggerWakeUp(userId), delay);

    response.text = `Хорошо, разбужу в ${hours}:${minutes.toString().padStart(2, '0')}. Спокойной ночи!`;
    response.tts = response.text;
    return send(res, { response, version, session, state: { session: { ...state.session, ...userState } } });
  }

  // --- СТАДИИ ПРОБУЖДЕНИЯ ---
  if (userState.stage === 'waiting' && userState.targetTime && now.getTime() >= userState.targetTime) {
    userState.stage = 'waking';
    response.text = 'Вставай с добрым утром!';
    response.tts = 'Вставай с добрым утром!';
    userState.timeoutId = setTimeout(() => askIfAwake(userId, 1), 30000); // 30 сек
    global.wakeUpStates[userId] = userState;
    return send(res, { response, version, session, state: { session: userState } });
  }

  // --- Ответ на "Проснулся?" ---
  if (userState.stage === 'asked_once' || userState.stage === 'asked_twice') {
    if (request.command && !request.command.toLowerCase().includes('нет')) {
      response.text = 'Отлично! Хорошего дня!';
      response.end_session = true;
      clearTimeout(userState.timeoutId);
      delete global.wakeUpStates[userId];
      return send(res, { response, version, session });
    }
  }

  // --- Автоматические триггеры (вызываются через setTimeout) ---
  if (request.command === '__TRIGGER__') {
    const trigger = request.payload?.trigger;
    if (trigger === 'ask1') {
      response.text = 'Проснулся?';
      userState.stage = 'asked_once';
      userState.timeoutId = setTimeout(() => askIfAwake(userId, 2), 60000); // 1 минута
    } else if (trigger === 'ask2') {
      response.text = 'Проснулся?';
      userState.stage = 'asked_twice';
      userState.timeoutId = setTimeout(() => playMusic(userId), 60000);
    } else if (trigger === 'music') {
      response.text = 'Включаю бодрую музыку!';
      response.directives = [{
        name: 'start_music',
        payload: {
          content: {
            type: 'playlist',
            id: 'popular_morning' // можно заменить на реальный плейлист
          }
        }
      }];
      response.end_session = true;
      delete global.wakeUpStates[userId];
    }
    global.wakeUpStates[userId] = userState;
    return send(res, { response, version, session });
  }

  // --- По умолчанию ---
  response.text = 'Скажи: "разбуди меня в 7:30"';
  return send(res, { response, version, session });
}

// --- Вспомогательные функции ---
function triggerWakeUp(userId) {
  sendTrigger(userId, 'waking');
}

function askIfAwake(userId, attempt) {
  sendTrigger(userId, attempt === 1 ? 'ask1' : 'ask2');
}

function playMusic(userId) {
  sendTrigger(userId, 'music');
}

async function sendTrigger(userId, trigger) {
  const payload = { trigger };
  await fetch('https://your-vercel-app.vercel.app/api/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: { command: '__TRIGGER__', payload, version: '1.0' },
      session: { user_id: userId, new: false },
      version: '1.0'
    })
  }).catch(() => {});
}

function send(res, data) {
  res.json({
    response: data.response,
    session_state: data.state?.session || {},
    version: data.version,
    session: data.session
  });
}