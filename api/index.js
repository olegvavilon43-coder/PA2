// api/index.js
module.exports = (req, res) => {
  console.log('Запрос получен:', new Date().toISOString());

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Читаем тело запроса
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const userMessage = (data.request?.command || data.request?.original_utterance || '').trim();

      const response = {
        response: {
          text: userMessage ? `Ты сказал: "${userMessage}"` : 'Скажи что-нибудь!',
          end_session: false
        },
        version: '1.0'
      };

      console.log('Ответ отправлен:', response.response.text);
      res.status(200).json(response);
    } catch (error) {
      console.error('Ошибка парсинга:', error);
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
};