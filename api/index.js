const express = require('express');
const app = express();
app.use(express.json());

let wakeupTimer;
let checkTimer;

// Store session states
const sessions = new Map();

// Clear timers for a session
const clearTimers = (sessionId) => {
  if (sessions.get(sessionId)?.wakeupTimer) {
    clearTimeout(sessions.get(sessionId).wakeupTimer);
  }
  if (sessions.get(sessionId)?.checkTimer) {
    clearTimeout(sessions.get(sessionId).checkTimer);
  }
};

// Helper to create response
const createResponse = (text, tts = text, buttons = [], endSession = false) => ({
  response: {
    text,
    tts,
    buttons: buttons.map(title => ({ title, hide: true })),
    end_session: endSession
  },
  version: '1.0'
});

// Main webhook handler
app.post('/', async (req, res) => {
  const { request, session, version } = req.body;
  const sessionId = session.session_id;
  const message = request.original_utterance.toLowerCase();

  // Initialize session state if not exists
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { state: null, timers: {} });
  }
  const sessionState = sessions.get(sessionId);

  // Clear existing timers
  clearTimers(sessionId);

  // Handle based on current state
  if (sessionState.state === 'waiting_for_wakeup_response') {
    // Handle response to "Вы встали?"
    sessionState.state = null;

    if (message.includes('да')) {
      return res.json(createResponse('Отлично! Хорошего дня!', 'Отлично! Хорошего дня!'));
    } else if (message.includes('5 минут')) {
      return res.json(createResponse('Ладно, дам ещё 5 минут...', 'Ладно, дам ещё 5 минут...'));
    } else {
      return res.json(createResponse('Тогда вставай скорее!', 'Тогда вставай скорее!'));
    }
  }

  // Default handler: start morning routine
  const response = createResponse('Доброе утро!', 'Доброе утро!');

  // Set timer for "Вы встали?" after 3 minutes
  sessionState.wakeupTimer = setTimeout(() => {
    sessionState.state = 'waiting_for_wakeup_response';
    const followupResponse = createResponse(
      'Вы встали?',
      'Вы встали?',
      ['Да', 'Ещё 5 минут', 'Не буди меня']
    );

    // Simulate sending followup (in real scenario, might need to store and handle via webhook)
    console.log('Sending followup:', followupResponse);

    // Set timer for loud wakeup if no response in 30 seconds
    sessionState.checkTimer = setTimeout(() => {
      if (sessionState.state === 'waiting_for_wakeup_response') {
        sessionState.state = null;
        console.log('Sending loud wakeup:', createResponse(
          'А ну вставай!',
          '<speaker audio="dialogs/upload/LOUD_А_НУ_ВСТАВАЙ_ПА2.opus"> А ну вставай ПА2'
        ));
      }
    }, 30 * 1000);

  }, 3 * 60 * 1000);

  res.json(response);
});

// Start server
app.listen(3000, () => {
  console.log('Навык запущен на http://localhost:3000/');
});