(function () {
  'use strict';
  const content = window.LESSON_CONTENT;
  const core = window.LessonCore;
  const key = 'russian-lesson-parts-of-speech-1';
  const url = new URL(location.href);
  const section = url.searchParams.get('section');
  const chapter = url.searchParams.get('chapter');
  if (content.steps.some(step => step.id === section) || content.chapters.some(item => item.id === chapter)) {
    url.pathname = url.pathname.replace(/(?:index\.html)?$/, 'blok.html');
    location.replace(url);
    return;
  }
  let state, baseline;
  function refresh() {
    let saved;
    try {
      saved = localStorage.getItem(key);
      document.getElementById('storage-status').hidden = true;
    } catch (_) {
      document.getElementById('storage-status').hidden = false;
      document.getElementById('storage-status').textContent = 'Браузер не разрешил сохранить прогресс на этом устройстве.';
    }
    state = core.parseState(saved, content);
    baseline = core.parseState(saved, content);
    const completed = content.steps.filter(step => core.isStepComplete(step, content, state)).length;
    document.getElementById('hub-count').textContent = `${completed} из ${content.steps.length} разделов`;
    const progress = document.getElementById('hub-progress');
    progress.max = content.steps.length;
    progress.value = completed;
    for (const card of document.querySelectorAll('[data-chapter]')) {
      const steps = content.steps.filter(step => step.chapter === card.dataset.chapter);
      const done = steps.filter(step => core.isStepComplete(step, content, state)).length;
      const finished = done === steps.length;
      const started = done > 0 || steps.some(step => step.groups.some(id => content.groups[id].questions.some(q => core.hasAnswer(q, state.answers[q.id]))));
      card.classList.toggle('completed', finished);
      card.querySelector('[data-status]').textContent = finished ? 'Пройдено' : started ? `${done} из ${steps.length} разделов` : 'Начать';
      card.querySelector('.chapter-check').hidden = !finished;
      card.querySelector('.chapter-arrow').hidden = finished;
      const chapterProgress = card.querySelector('.chapter-progress');
      chapterProgress.max = steps.length;
      chapterProgress.value = done;
      chapterProgress.setAttribute('aria-label', `${content.chapters.find(item => item.id === card.dataset.chapter).title}: ${done} из ${steps.length} разделов`);
    }
    document.body.classList.toggle('large', state.large);
    document.getElementById('large-mode').setAttribute('aria-pressed', String(state.large));
  }
  document.getElementById('large-mode').addEventListener('click', () => {
    state.large = !state.large;
    document.body.classList.toggle('large', state.large);
    document.getElementById('large-mode').setAttribute('aria-pressed', String(state.large));
    try {
      const latest = core.parseState(localStorage.getItem(key), content);
      state = core.mergeState(baseline, state, latest);
      localStorage.setItem(key, JSON.stringify(state));
      refresh();
    } catch (_) {
      document.getElementById('storage-status').hidden = false;
      document.getElementById('storage-status').textContent = 'Браузер не разрешил сохранить прогресс на этом устройстве.';
    }
  });
  refresh();
  window.addEventListener('pageshow', refresh);
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
