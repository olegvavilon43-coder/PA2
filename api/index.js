// index.js
const { Alice, Reply } = require('yandex-dialogs-sdk');
const alice = new Alice();

alice.command('', (ctx) => {
    const userMessage = ctx.message.trim();

    // Если пользователь ничего не сказал — просим ввести текст
    if (!userMessage) {
        return Reply.text('Скажите что-нибудь, и я повторю!');
    }

    // Повторяем сообщение пользователя
    return Reply.text(`Вы сказали: "${userMessage}"`);
});

// Для локального тестирования (необязательно)
if (require.main === module) {
    const port = process.env.PORT || 3000;
    const server = alice.createServer();
    server.listen(port, () => {
        console.log(`Сервер Алисы запущен на порту ${port}`);
    });
}

module.exports = alice;