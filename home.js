(function () {
  'use strict';
  const storageKey = 'russian-lesson-parts-of-speech-1';
  const content = window.LESSON_CONTENT;
  const core = window.LessonCore;
  const link = document.getElementById('parts-of-speech-link');
  if (!content || !core || !link) return;

  function updateProgress() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) { saved = null; }
    const state = core.cleanState(saved, content);
    const completed = content.steps.filter(step => core.isStepComplete(step, content, state)).length;
    const done = completed === content.steps.length;
    const started = completed > 0 || state.step > 0 || Object.values(content.groups).some(group => group.questions.some(q => core.hasAnswer(q, state.answers[q.id])));
    link.classList.toggle('completed', done);
    link.querySelector('.lesson-check').hidden = !done;
    link.querySelector('.lesson-arrow').hidden = done;
    document.getElementById('parts-of-speech-status').textContent = done ? 'Пройдено' : started ? `${completed} из ${content.steps.length} разделов` : 'Начать';
  }

  updateProgress();
  window.addEventListener('pageshow', updateProgress);
  window.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) updateProgress(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateProgress(); });
})();
