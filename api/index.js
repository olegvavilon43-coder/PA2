const say = require('say');

// Функция, которая произносит "Доброе утро"
function sayGoodMorning() {
    console.log('Произношу: Доброе утро!');
    say.speak('Доброе утро', 'Microsoft Irina Desktop', 1.0, (err) => {
        if (err) {
            console.error('Ошибка при воспроизведении:', err);
            return;
        }
        console.log('Фраза "Доброе утро" произнесена успешно!');

        // Ждем 1 минуту (60 секунд) и произносим "Хули спишь"
        setTimeout(() => {
            console.log('Произношу: Хули спишь!');
            say.speak('Хули спишь', 'Microsoft Irina Desktop', 1.0, (err) => {
                if (err) {
                    console.error('Ошибка при воспроизведении:', err);
                    return;
                }
                console.log('Фраза "Хули спишь" произнесена успешно!');
            });
        }, 60 * 1000); // 60 секунд = 1 минута
    });
}

// Запускаем функцию
sayGoodMorning();