let alarmConfig = {
  time: null,           // "07:30"
  reminderTime: null,   // "07:33"
  days: [],             // [1,2,3,4,5]
  sessionId: null,
  triggered: false,
  awaitingResponse: false,
  lastReminderTime: null,
  lastTriggerDate: null  // Для сброса triggered по дню
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
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      const currentDay = now.getDay(); // 0=вс, 1=пн ...
      const todayStr = now.toDateString();

      let responseText = '';
      let tts = null;
      let endSession = false;

      // === СБРОС triggered В НОВЫЙ ДЕНЬ ===
      if (alarmConfig.sessionId === sessionId && alarmConfig.time && alarmConfig.lastTriggerDate !== todayStr) {
        alarmConfig.triggered = false;
        alarmConfig.awaitingResponse = false;
        alarmConfig.lastReminderTime = null;
      }

      // === 1. ОСНОВНОЙ БУДИЛЬНИК ===
      if (
        alarmConfig.time &&
        alarmConfig.sessionId === sessionId &&
        currentTime === alarmConfig.time &&
        (alarmConfig.days.length === 0 || alarmConfig.days.includes(currentDay)) &&
        !alarmConfig.triggered
      ) {
        responseText = 'Доброе утро! Пора вставать!';
        alarmConfig.triggered = true;
        alarmConfig.lastTriggerDate = todayStr;
        alarmConfig.awaitingResponse = false;
        alarmConfig.lastReminderTime = null;
      }

      // === 2. НАПОМИНАНИЕ ЧЕРЕЗ 3 МИНУТЫ ===
      else if (
        alarmConfig.reminderTime &&
        alarmConfig.sessionId === sessionId &&
        currentTime === alarmConfig.reminderTime &&
        (alarmConfig.days.length === 0 || alarmConfig.days.includes(currentDay)) &&
        alarmConfig.triggered
      ) {
        responseText = 'Вы встали?';
        alarmConfig.awaitingResponse = true;
        alarmConfig.lastReminderTime = now.getTime();
        tts = 'Вы встали?';
      }

      // === 3. ГРОМКОЕ НАПОМИНАНИЕ, ЕСЛИ НЕ ОТВЕТИЛ > 1 МИН ===
      else if (
        alarmConfig.awaitingResponse &&
        alarmConfig.sessionId === sessionId &&
        alarmConfig.lastReminderTime
      ) {
        const minutesSinceReminder = (now.getTime() - alarmConfig.lastReminderTime) / 60000;

        if (minutesSinceReminder >= 1) {
          responseText = 'ВСТАВАЙТЕ!';
          tts = '<speaker audio="dialogs-upload/..."/> ВСТАВАЙТЕ!'; // Замени на свой громкий звук
          alarmConfig.lastReminderTime = now.getTime(); // Сброс таймера
        } else {
          responseText = 'Я жду ответа...';
        }
      }

      // === 4. ПОЛЬЗОВАТЕЛЬ ОТВЕТИЛ НА "Вы встали?" ===
      else if (
        alarmConfig.awaitingResponse &&
        alarmConfig.sessionId === sessionId &&
        userMessage.length > 0
      ) {
        responseText = 'Отлично! Хорошего дня!';
        // Полный сброс
        alarmConfig = {
          time: null, reminderTime: null, days: [], sessionId: null,
          triggered: false, awaitingResponse: false,
          lastReminderTime: null, lastTriggerDate: null
        };
      }

      // === 5. УСТАНОВКА БУДИЛЬНИКА ===
      else if (userMessage.includes('разбуди') || userMessage.includes('будильник')) {
        const timeMatch = userMessage.match(/(\d{1,2})[.:h]?(\d{2})?/);
        if (!timeMatch) {
          responseText = 'На какое время? Например: "в 7:30" или "на 8"';
        } else {
          let hours = parseInt(timeMatch[1], 10);
          let minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            responseText = 'Неверное время. Укажи от 00:00 до 23:59.';
          } else {
            hours = hours.toString().padStart(2, '0');
            minutes = minutes.toString().padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;

            // === ВЫЧИСЛЕНИЕ reminderTime (+3 минуты, с переполнением) ===
            let remMin = parseInt(minutes, 10) + 3;
            let remHour = parseInt(hours, 10) + Math.floor(remMin / 60);
            remMin %= 60;
            remHour %= 24;
            const reminderTime = `${remHour.toString().padStart(2,'0')}:${remMin.toString().padStart(2,'0')}`;

            // === РАСПОЗНАВАНИЕ ДНЕЙ ===
            const normalize = (s) => s.toLowerCase()
              .replace(/й$/g, 'ь')     // среду → среда
              .replace(/у$/g, 'а')     // пятницу → пятница
              .replace(/по\s+/g, '')   // "по понедельникам" → "понедельникам"
              .replace(/в\s+/g, '')    // "в понедельник" → "понедельник"
              .replace(/на\s+/g, '');  // "на пятницу" → "пятницу"

            const normMsg = normalize(userMessage);

            const dayKeywords = {
              'воскресенье': 0, 'вс': 0, 'воскресень': 0,
              'понедельник': 1, 'пн': 1, 'понедельник': 1,
              'вторник': 2, 'вт': 2,
              'среда': 3, 'ср': 3,
              'четверг': 4, 'чт': 4,
              'пятница': 5, 'пт': 5,
              'суббота': 6, 'сб': 6
            };

            const detectedDays = new Set();

            // По ключевым словам
            for (const [word, day] of Object.entries(dayKeywords)) {
              if (normMsg.includes(word)) {
                detectedDays.add(day);
              }
            }

            // Будни / выходные
            if (/будн|рабочи/.test(normMsg)) {
              [1,2,3,4,5].forEach(d => detectedDays.add(d));
            } else if (/выходн/.test(normMsg)) {
              [0,6].forEach(d => detectedDays.add(d));
            }

            const daysArray = Array.from(detectedDays);

            // === СОХРАНЕНИЕ КОНФИГА ===
            alarmConfig = {
              time: timeStr,
              reminderTime,
              days: daysArray,
              sessionId,
              triggered: false,
              awaitingResponse: false,
              lastReminderTime: null,
              lastTriggerDate: null
            };

            // === ФОРМИРОВАНИЕ ОТВЕТА ===
            const dayList = daysArray.length > 0
              ? daysArray.map(d => ['вс','пн','вт','ср','чт','пт','сб'][d]).join(', ')
              : 'каждый день';

            responseText = `Будильник на ${timeStr}, напомню в ${reminderTime} — ${dayList}`;
          }
        }
      }

      // === 6. ОТМЕНА ===
      else if (userMessage.includes('отмени') || userMessage.includes('сбрось') || userMessage.includes('выключи')) {
        alarmConfig = {
          time: null, reminderTime: null, days: [], sessionId: null,
          triggered: false, awaitingResponse: false,
          lastReminderTime: null, lastTriggerDate: null
        };
        responseText = 'Будильник отменён.';
      }

      // === 7. СТАТУС ===
      else if (userMessage.includes('статус') || userMessage.includes('проверь')) {
        if (alarmConfig.sessionId === sessionId && alarmConfig.time) {
          const dayList = alarmConfig.days.length > 0
            ? alarmConfig.days.map(d => ['вс','пн','вт','ср','чт','пт','сб'][d]).join(', ')
            : 'каждый день';
          responseText = `Будильник: ${alarmConfig.time}, напомню в ${alarmConfig.reminderTime} — ${dayList}`;
        } else {
          responseText = 'Будильник не установлен.';
        }
      }

      // === 8. ЭХО (заглушка) ===
      else if (userMessage) {
        responseText = `Ты сказал: "${data.request?.original_utterance}"`;
      } else {
        responseText = 'Я тебя не поняла. Скажи: "разбуди в 7:30" или "отмени будильник".';
      }

      // === ФИНАЛЬНЫЙ ОТВЕТ ===
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
        response: { text: 'Произошла ошибка. Попробуй снова.' },
        version: '1.0'
      });
    }
  });
};