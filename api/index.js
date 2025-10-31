const { Alice, Reply } = require('yandex-dialogs-sdk');

// Создаем экземпляр Алисы
const alice = new Alice();

// Обработчик для всех сообщений
alice.any(async (ctx) => {
    // Получаем текст пользователя
    const userMessage = ctx.message;
    
    // Возвращаем тот же текст, что и прислал пользователь
    return Reply.text(userMessage);
});

// Запускаем сервер (для Яндекс.Диалогов)
module.exports.handler = alice.handler;