const express = require("express");
const app = express();

app.use(express.json());

// Обработка запросов от Яндекс.Алисы
app.post("/", (req, res) => {
  const body = req.body;

  // Если это первое обращение — Алиса скажет "Доброе утро"
  const response = {
    version: body.version,
    session: body.session,
    response: {
      text: "Доброе утро!",
      tts: "Доброе утро!",
      end_session: true
    }
  };

  res.json(response);
});

// Запуск локального сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
