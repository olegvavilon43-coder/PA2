// api/index.js
let alarmConfig = {
  time: null,           // "07:30"
  reminderTime: null,   // "07:33" — через 3 минуты
  days: [],             // [1,2,3,4,5] — пн-пт
  sessionId: null,
  triggered: false      // чтобы не повторять
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
      const currentTime = now.toTimeString().slice(0, 5); // "07:30"
      const currentDay = now.getDay(); // 0=вс, 1=пн...

      let responseText = '';
      let endSession = false;

      // === 1. Первый будильник: "Доброе утро!" ===
      if (
        alarmConfig.time &&
        alarmConfig.sessionId === sessionId &&
        currentTime === alarmConfig.time &&
        (alarmConfig.days.length === 0 || alarmConfig.days.includes(currentDay)) &&
        !alarmConfig.triggered
      ) {
        responseText = 'Доброе утро! Пора вставать!';
        alarmConfig.triggered = true; // чтобы не повторять
        endSession = false;
      }

      // === 2. Напоминание через 3 минуты: "Вы встали?" ===
      else if (
        alarmConfig.reminderTime &&
        alarmConfig.sessionId === sessionId &&
        currentTime === alarmConfig.reminderTime &&
        (alarmConfig.days.length === 0 || alarmConfig.days.includes(currentDay))
      ) {
        responseText = 'Вы встали?';
        // Сбрасываем всё
        alarmConfig = { time: null, reminderTime: null, days: [], sessionId: null, triggered: false };
        endSession = false;
      }

      // === 3. Установка будильника ===
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
            if (reminderDate.getDate() !== now.getDate()) {
              reminderDate.setDate(reminderDate.getDate() - 1); // если перешло за полночь
            }
            const reminderTime = reminderDate.toTimeString().slice(0, 5);

            // Дни недели
            const days = [];
            if (userMessage.includes('будни') || userMessage.includes('по будням')) days.push(1,2,3,4,5);
            else if (userMessage.includes('выходные')) days.push(0,6);
            else {
              const dayMap = { 'понедельник':1, 'вторник':2, 'среду':3, 'четверг':4, 'пятницу':5, 'субботу':6, 'воскресенье':0 };
              for (const [k, v] of Object.entries(dayMap)) {
                if (userMessage.includes(k)) days.push(v);
              }
            }

            alarmConfig = {
              time: timeStr,
              reminderTime,
              days: [...new Set(days)],
              sessionId,
              triggered: false
            };

            const dayList = alarmConfig.days.length > 0
              ? alarmConfig.days.map(d => ['вс','пн','вт','ср','чт','пт','сб'][d]).join(', ')
              : 'каждый день';

            responseText = `Будильник на ${timeStr}, напомню в ${reminderTime} — ${dayList}`;
          }
        }
      }

      // === 4. Отмена ===
      else if (userMessage.includes('отмени')) {
        if (alarmConfig.sessionId === sessionId) {
          alarmConfig = { time: null, reminderTime: null, days: [], sessionId: null, triggered: false };
          responseText = 'Будильник отменён.';
        } else {
          responseText = 'Будильник не установлен.';
        }
      }

      // === 5. Статус ===
      else if (userMessage.includes('статус') || userMessage.includes('когда')) {
        if (alarmConfig.sessionId === sessionId && alarmConfig.time) {
          const dayList = alarmConfig.days.length > 0
            ? alarmConfig.days.map(d => ['вс','пн','вт','ср','чт','пт','сб'][d]).join(', ')
            : 'каждый день';
          responseText = `Будильник: ${alarmConfig.time}, напомню в ${alarmConfig.reminderTime} — ${dayList}`;
        } else {
          responseText = 'Будильник не установлен.';
        }
      }

      // === 6. Эхо ===
      else {
        responseText = `Ты сказал: "${data.request?.original_utterance}"\nСкажи: "разбуди в 7:30"`;
      }

      // === Ответ ===
      const response = {
        response: { text: responseText, end_session: endSession },
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