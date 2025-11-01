const { Alice, Reply } = require('yandex-dialogs-sdk');
const fetch = require('node-fetch'); // Для push-уведомлений

// Замените на ваши реальные значения из консоли Яндекс.Диалогов
const SKILL_ID = 'your_skill_id_here'; // ID вашего навыка
const OAUTH_TOKEN = 'your_oauth_token_here'; // OAuth-токен для API

// Создаём экземпляр навыка
const alice = new Alice();

// Функция для отправки push-уведомления
async function sendPushNotification(userId, message) {
  try {
    const response = await fetch(`https://dialogs.yandex.net/api/v1/skills/${SKILL_ID}/push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OAUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId, // userId из req
        message: {
          text: message,
          tts: message, // TTS для голосового воспроизведения
          end_session: false, // Не закрывать сессию
        },
      }),
    });
    if (!response.ok) {
      console.error('Ошибка push:', await response.text());
    }
  } catch (error) {
    console.error('Ошибка отправки push:', error);
  }
}

// Обработчик запросов
alice.command('', async (ctx) => { // Запуск навыка (пустая команда)
  const userId = ctx.request.user_id; // Получаем userId для push
  const initialMessage = 'Доброе утро!';

  // Отвечаем сразу
  ctx.reply(initialMessage);

  // Через 3 минуты отправляем push
  setTimeout(async () => {
    await sendPushNotification(userId, 'Вы проснулись?');
  }, 180000); // 3 минуты = 180000 мс

  // Возвращаем ответ без закрытия сессии
  return Reply.text(initialMessage, { endSession: false });
});

// Обработчик для любых других команд (опционально)
alice.any(async (ctx) => {
  return Reply.text('Я не понимаю. Скажите "запуск" для приветствия.');
});

// Запуск сервера
const port = process.env.PORT || 3000;
alice.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}. Используйте ngrok для HTTPS.`);
});