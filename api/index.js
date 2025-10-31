// api/index.js
let alarmTime = null; // Хранит время будильника: "07:30"
let alarmSessionId = null; // Кому поставлен будильник

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

      // Текущая дата и время
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "07:30"
      const currentHourMinute = currentTime;

      let responseText = '';
      let endSession = false;

      // === 1. Проверяем, сработал ли будильник ===
      if (alarmTime && alarmSessionId === sessionId && currentHourMinute === alarmTime) {
        responseText = 'Доброе утро! Пора просыпаться!';
        // Сбрасываем будильник
        alarmTime = null;
        alarmSessionId = null;
        endSession = false; // Можно продолжить диалог
      }

      // === 2. Установка будильника: "разбуди в 7:30", "будильник на 8 утра" ===
      else if (userMessage.includes('разбуди') || userMessage.includes('будильник')) {
        const timeMatch = userMessage.match(/(\d{1,2})[.:]?(\d{2})?/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          let minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

          // Приводим к 24ч формату
          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            responseText = 'Неправильное время. Скажи, например: "разбуди в 7:30"';
          } else {
            hours = hours.toString().padStart(2, '0');
            minutes = minutes.toString().padStart(2, '0');
            alarmTime = `${hours}:${minutes}`;
            alarmSessionId = sessionId;

            responseText = `Будильник установлен на ${hours}:${minutes}. Я разбужу тебя!`;
          }
        } else {
          responseText = 'На какое время поставить будильник? Например: "в 7:30"';
        }
      }

      // === 3. Команда "отмени будильник" ===
      else if (userMessage.includes('отмени') || userMessage.includes('сбрось')) {
        if (alarmTime && alarmSessionId === sessionId) {
          alarmTime = null;
          alarmSessionId = null;
          responseText = 'Будильник отменён.';
        } else {
          responseText = 'Будильник не был установлен.';
        }
      }

      // === 4. Команда "какое время будильника" ===
      else if (userMessage.includes('время') || userMessage.includes('когда')) {
        if (alarmTime && alarmSessionId === sessionId) {
          responseText = `Будильник на ${alarmTime}.`;
        } else {
          responseText = 'Будильник не установлен.';
        }
      }

      // === 5. Эхо-режим (если ничего не подошло) ===
      else {
        responseText = `Ты сказал: "${data.request?.original_utterance}"\n\nСкажи: "разбуди в 7:30" — и я поставлю будильник!`;
      }

      // === Ответ ===
      const response = {
        response: {
          text: responseText,
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