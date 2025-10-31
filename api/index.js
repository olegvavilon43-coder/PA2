const { Alice, Reply, Stage } = require('alice-sdk');
const alice = new Alice();

let wakeupTimer;
let checkTimer;

// Очистка таймеров при выходе
const clearTimers = () => {
  if (wakeupTimer) clearTimeout(wakeupTimer);
  if (checkTimer) clearTimeout(checkTimer);
};

alice.command(() => true, (ctx) => {
  clearTimers();

  // Шаг 1: Доброе утро
  ctx.reply(
    Reply.text('Доброе утро!')
      .voice('Доброе утро!')
  );

  // Шаг 2: Через 3 минуты спросить "Вы встали?"
  wakeupTimer = setTimeout(() => {
    ctx.reply(
      Reply.text('Вы встали?')
        .voice('Вы встали?')
        .suggest(['Да', 'Ещё 5 минут', 'Не буди меня'])
    );

    // Ожидаем ответа 30 секунд
    ctx.stage.set('waiting_for_wakeup_response', 30 * 1000);

    // Если ответа нет — кричим
    checkTimer = setTimeout(() => {
      if (ctx.stage.get() === 'waiting_for_wakeup_response') {
        ctx.reply(
          Reply.text('<speaker audio="dialogs/upload/LOUD_А_НУ_ВСТАВАЙ_ПА2.opus">')
            .voice('А ну вставай ПА2', { loud: true })
        );
        ctx.stage.clear();
      }
    }, 30 * 1000);

  }, 3 * 60 * 1000); // 3 минуты
});

// Обработка ответа на "Вы встали?"
alice.stage('waiting_for_wakeup_response', (ctx) => {
  clearTimers();
  ctx.stage.clear();

  const text = ctx.message.toLowerCase();

  if (text.includes('да')) {
    ctx.reply(Reply.text('Отлично! Хорошего дня!').voice('Отлично! Хорошего дня!'));
  } else if (text.includes('5 минут')) {
    ctx.reply(Reply.text('Ладно, дам ещё 5 минут...').voice('Ладно, дам ещё 5 минут...'));
    // Можно добавить новый таймер на 5 минут
  } else {
    ctx.reply(Reply.text('Тогда вставай скорее!').voice('Тогда вставай скорее!'));
  }
});

// Обработка любых других команд
alice.any((ctx) => {
  if (ctx.stage.get() === 'waiting_for_wakeup_response') {
    alice.stage('waiting_for_wakeup_response')(ctx);
  } else {
    ctx.reply(Reply.text('Скажите "Доброе утро", чтобы начать.'));
  }
});

// Запуск
alice.listen(3000, '/');
console.log('Навык запущен на http://localhost:3000/');