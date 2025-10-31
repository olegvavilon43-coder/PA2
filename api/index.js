// api/index.js
let alarmConfig = {
  time: null,           // "07:30"
  reminderTime: null,   // "07:33"
  days: [],             // [1,2,3,4,5]
  sessionId: null,
  triggered: false,
  awaitingResponse: false,     // Ждём ли ответа на "Вы встали?"
  lastReminderTime: null       // Когда в последний раз напоминали
};

module.exports = (req, res) => {
  console.log('Запрос получен:', new Date().toISOString());

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const sessionId = data.session?.session_id;
      const userMessage = (data.request?.command || data.request?.original_utterance || '').toLowerCase().trim();

      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const currentDay = now.getDay();

      let responseText = '';
      let endSession = false;
      let tts = null; // Громкий голос

      // === 1. Первый будильник ===
      if (
        alarmConfig.time &&
        alarmConfig.sessionId === sessionId &&
        currentTime === alarmConfig.time &&
        (alarmConfig.days.length === 0 || alarmConfig.days.includes(currentDay)) &&
        !alarmConfig.triggered
      ) {
        responseText = 'Доброе утро! Пора вставать!';
        alarmConfig.triggered = true;
        alarmConfig.awaitingResponse = false;
        alarmConfig.lastReminderTime = null;
      }

      // === 2. Напоминание через 3 минуты ===
      else if (
        alarmConfig.reminderTime &&
        alarmConfig.sessionId === sessionId &&
        currentTime === alarmConfig.reminderTime &&
        (alarmConfig.days.length === 0 || alarmConfig.days.includes(currentDay))
      ) {
        responseText = 'Вы встали?';
        alarmConfig.awaitingResponse = true;
        alarmConfig.lastReminderTime = now.getTime();
        tts = 'Вы встали?'; // Обычный голос
      }

      // === 3. ГРОМКОЕ напоминание, если не ответил > 1 мин ===
      else if (
        alarmConfig.awaitingResponse &&
        alarmConfig.sessionId === sessionId &&
        alarmConfig.lastReminderTime
      ) {
        const minutesSinceReminder = (now.getTime() - alarmConfig.lastReminderTime) / 60000;

        if (minutesSinceReminder >= 1) {
          // Пользователь молчит → ГРОМКО!
          responseText = 'ВСТАВАЙТЕ!';
          tts = '<speaker audio="dialogs-upload/..." /> ВСТАВАЙТЕ!'; // Громкий TTS
          alarmConfig.lastReminderTime = now.getTime(); // Сброс таймера
        } else {
          // Ещё не прошло 1 мин → ждём
          responseText = 'Я жду ответа...';
        }
      }

      // === 4. Пользователь ответил на "Вы встали?" ===
      else if (
        alarmConfig.awaitingResponse &&
        alarmConfig.sessionId === sessionId &&
        userMessage.length > 0
      ) {
        responseText = 'Отлично! Хорошего дня!';
        // Сбрасываем всё
        alarmConfig = { time: null, reminderTime: null, days: [], sessionId: null, triggered: false, awaitingResponse: false, lastReminderTime: null };
      }

      // === 5. Установка будильника ===
      else if (userMessage.includes('разбуди') || userMessage.includes('будильник')) {
        const timeMatch = userMessage.match(/(\d{1,2})[.:]?(\d{2})?/);
        if (!timeMatch) {
          responseText = 'На какое время? Например: "в 7:30"';
        } else {
          let hours = parseInt(timeMatch[1], 10);
          let minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            responseText = 'Неверное время.';
          } else {
            hours = hours.toString().padStart(2, '0');
            minutes = minutes.toString().padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;

            // +3 минуты
            let reminderDate = new Date();
            reminderDate.setHours(parseInt(hours, 10));
            reminderDate.setMinutes(parseInt(minutes, 10) + 3);
            const reminderTime = reminderDate.toTimeString().slice(0, 5);

            // Дни
            const days = [];
            if (userMessage.includes('будни')) days.push(1,2,3,4,5);
            else if (userMessage.includes('выходные')) days.push(0,6);
            else {
              const dayMap = { 'понедельник':1, 'вторник':2, 'среду':3, 'четверг':4, 'пятницу':5, 'субботу':6, 'воскресенье':0 };
              for (const [k, v] of Object.entries(dayMap)) if (userMessage.includes(k)) days.push(v);
            }

            alarmConfig = {
              time: timeStr,
              reminderTime,
              days: [...new Set(days)],
              sessionId,
              triggered: false,
              awaitingResponse: false,
              lastReminderTime: null
            };

            const dayList = alarmConfig.days.length > 0
              ? alarmConfig.days.map(d => ['вс','пн','вт','ср','чт','пт','сб'][d]).join(', ')
              : 'каждый день';

            responseText = `Будильник на ${timeStr}, напомню в ${reminderTime} — ${dayList}`;
          }
        }
      }

      // === 6. Отмена ===
      else if (userMessage.includes('отмени')) {
        alarmConfig = { time: null, reminderTime: null, days: [], sessionId: null, triggered: false, awaitingResponse: false, lastReminderTime: null };
        responseText = 'Будильник отменён.';
      }

      // === 7. Статус ===
      else if (userMessage.includes('статус')) {
        if (alarmConfig.sessionId === sessionId && alarmConfig.time) {
          const dayList = alarmConfig.days.length > 0
            ? alarmConfig.days.map(d => ['вс','пн','вт','ср','чт','пт','сб'][d]).join(', ')
            : 'каждый день';
          responseText = `Будильник: ${alarmConfig.time}, напомню в ${alarmConfig.reminderTime} — ${dayList}`;
        } else {
          responseText = 'Будильник не установлен.';
        }
      }

      // === 8. Эхо ===
      else {
        responseText = `Ты сказал: "${data.request?.original_utterance}"`;
      }

      // === Ответ ===
      const response = {
        response: {
          text: responseText,
          tts: tts || responseText,
          end_session: endSession
        },
        session: data.session,
        version: '1.0'
      };

      console.log('Ответ:', responseText);
      res.status(200).json(response);

    } catch (error) {
      console.error('Ошибка:', error);
      res.status(500).json({
        response: { text: 'Ошибка.' },
        version: '1.0'
      });
    }
  });
};