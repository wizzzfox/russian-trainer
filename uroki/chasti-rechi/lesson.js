(function () {
  'use strict';
  const content = window.LESSON_CONTENT;
  const core = window.LessonCore;
  const storageKey = 'russian-lesson-parts-of-speech-1';
  const $ = id => document.getElementById(id);
  const escape = text => String(text ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const icon = name => `<img src="icons/${name}.svg" alt="" width="18" height="18">`;
  // The browser may restore an old scroll position after initialization or from its page cache.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('pageshow', scrollToTop);
  let storageAvailable = true;
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch (_) { storageAvailable = false; }
  let state = core.parseState(saved, content);
  let baseline = core.parseState(saved, content);
  const questionById = Object.fromEntries(Object.values(content.groups).flatMap(group => group.questions).map(q => [q.id, q]));
  const groupByQuestion = Object.fromEntries(Object.values(content.groups).flatMap(group => group.questions.map(q => [q.id, group])));

  function answerFor(q) {
    return state.answers[q.id] || { selected: [], mapping: {}, text: '', reflection: '', checked: false, attempts: 0 };
  }
  function persist() {
    try {
      const latest = core.parseState(localStorage.getItem(storageKey), content);
      state = core.mergeState(baseline, state, latest);
      const serialized = JSON.stringify(state);
      localStorage.setItem(storageKey, serialized);
      baseline = JSON.parse(serialized);
      storageAvailable = true;
    } catch (_) { storageAvailable = false; }
    $('storage-status').hidden = storageAvailable;
    $('storage-status').textContent = 'Ответы доступны до закрытия страницы. Браузер не разрешил сохранить их на этом устройстве.';
  }
  function complete(step) {
    return core.isStepComplete(step, content, state);
  }
  function chapterSteps() {
    const chapter = content.steps[state.step].chapter;
    return content.steps.map((step, index) => ({ step, index })).filter(item => item.step.chapter === chapter);
  }
  function updateNavigation() {
    const steps = chapterSteps();
    const chapter = content.chapters.find(item => item.id === content.steps[state.step].chapter);
    const completed = steps.filter(item => complete(item.step)).length;
    $('chapter-title').textContent = chapter.title;
    document.title = `${chapter.title} | Части речи`;
    $('overall-count').textContent = `${completed} из ${steps.length}`;
    $('overall-progress').max = steps.length;
    $('overall-progress').value = completed;
    $('lesson-nav').innerHTML = `<p class="nav-chapter">${escape(chapter.title)}</p>` + steps.map(({ step, index }, position) => {
      return `<button class="nav-step${complete(step) ? ' done' : ''}" type="button" data-step="${index}"${state.step === index ? ' aria-current="step"' : ''}><span class="step-number">${complete(step) ? icon('check') : position + 1}</span><span>${escape(step.title)}</span></button>`;
    }).join('');
    $('section-select').innerHTML = `<optgroup label="${escape(chapter.title)}">${steps.map(({ step, index }, position) => `<option value="${index}"${index === state.step ? ' selected' : ''}>${position + 1}. ${escape(step.title)}</option>`).join('')}</optgroup>`;
    $('previous-section').disabled = state.step === steps[0].index;
    $('next-section').innerHTML = state.step === steps.at(-1).index ? `Все блоки${icon('arrowRight')}` : `Продолжить${icon('arrowRight')}`;
    document.body.classList.toggle('large', state.large);
    $('large-mode').setAttribute('aria-pressed', String(state.large));
  }
  function scrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
  function navigate(index) {
    if (!Number.isInteger(index) || index < 0 || index >= content.steps.length) return;
    state.step = index;
    state.stepId = content.steps[index].id;
    const url = new URL(location.href);
    url.searchParams.delete('chapter');
    url.searchParams.set('section', state.stepId);
    history.replaceState(null, '', url);
    persist();
    render();
    $('lesson-heading').focus({ preventScroll: true });
    scrollToTop();
  }
  function trustedTheory(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('table').forEach(table => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      const headers = [...table.querySelectorAll('th')];
      headers.forEach(th => th.scope = 'col');
      if (headers.length > 2) {
        wrapper.classList.add('wide-table');
        table.querySelectorAll('tbody tr').forEach(row => {
          [...row.querySelectorAll('td')].forEach((cell, i) => cell.dataset.label = headers[i]?.textContent || '');
        });
      }
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', 'Таблица примеров');
      table.replaceWith(wrapper);
      wrapper.append(table);
    });
    container.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    return container.innerHTML;
  }
  function feedback(q, answer, showStatus = true) {
    const correct = core.grade(q, answer);
    const answered = core.hasAnswer(q, answer);
    let difference = '';
    if (q.type === 'tokens') {
      const selected = answer?.selected || [];
      const missing = q.choices.filter(x => q.correct.includes(x.value) && !selected.includes(x.value));
      const extra = q.choices.filter(x => !q.correct.includes(x.value) && selected.includes(x.value));
      difference = [...missing.map(x => `<p class="answer-diff">Не выбрано: <strong>${escape(x.label)}</strong>. ${escape(content.labels[x.role])}.</p>`), ...extra.map(x => `<p class="answer-diff">Лишнее слово: <strong>${escape(x.label)}</strong>. ${escape(content.labels[x.role])}.</p>`)].join('');
    }
    return `<div class="feedback${correct ? ' correct' : ''}" role="status">${showStatus ? `<div class="feedback-title">${icon(correct ? 'check' : 'help')}${correct ? 'Верно' : answered ? 'Нужно исправить' : 'Нет ответа'}</div>` : ''}${difference}${q.explanationHtml}</div>`;
  }
  function questionControls(q, answer, locked) {
    const selected = answer.selected || [];
    if (q.type === 'choice') {
      return `<div class="choices${q.choices.some(x => x.label.length > 65) ? ' long-options' : ''}" role="radiogroup" aria-label="Варианты ответа">${q.choices.map((choice, i) => {
        const picked = selected.includes(choice.value);
        const result = locked && q.correct.includes(choice.value) ? ' correct' : locked && picked ? ' incorrect' : '';
        return `<label class="choice${picked ? ' selected' : ''}${result}${locked ? ' locked' : ''}"><input type="radio" name="${q.id}" value="${escape(choice.value)}" data-question="${q.id}"${picked ? ' checked' : ''}${locked ? ' disabled' : ''}><span>${escape(choice.label)}</span></label>`;
      }).join('')}</div>`;
    }
    if (q.type === 'tokens') return `<div class="word-sentence" role="group" aria-label="Слова предложения">${q.sentenceParts.map(part => {
      if (part.text !== undefined) return escape(part.text);
      const word = part.word;
      const picked = selected.includes(word.value);
      const result = locked && q.correct.includes(word.value) ? ' correct' : locked && picked ? ' incorrect' : '';
      return `<button type="button" class="word-button${picked ? ' selected' : ''}${result}" data-question="${q.id}" data-word="${word.value}" aria-pressed="${picked}"${locked ? ' disabled' : ''}>${escape(word.label)}</button>`;
    }).join('')}</div>`;
    if (q.type === 'input') return `<div class="input-answer"><label for="input-${q.id}">Ответ</label><input id="input-${q.id}" data-question="${q.id}" data-text type="text" value="${escape(answer.text)}" maxlength="1000" autocomplete="off" spellcheck="false"${locked ? ' disabled' : ''}></div>`;
    return `<div class="sort-rows">${q.rows.map(row => {
      const correct = answer.mapping[row.id] === row.correct;
      return `<div class="sort-row${locked && correct ? ' checked-correct' : ''}"><label class="sort-word" for="sort-${q.id}-${row.id}">${escape(row.label)}</label><select id="sort-${q.id}-${row.id}" data-question="${q.id}" data-row="${row.id}"${locked ? ' disabled' : ''}><option value="">${escape(q.sortLabel || 'Выберите часть речи')}</option>${q.choices.map(choice => `<option value="${choice.value}"${answer.mapping[row.id] === choice.value ? ' selected' : ''}>${escape(choice.label)}</option>`).join('')}</select>${locked ? `<p class="sort-answer-note">${correct ? 'Верно' : `Правильный ответ: ${escape(q.choices.find(choice => choice.value === row.correct)?.label)}`}</p>` : ''}</div>`;
    }).join('')}</div>`;
  }
  function assessmentResult(group) {
    const summary = core.summarize(group.questions, state.answers);
    const resultTitle = summary.unanswered ? 'Не все задания выполнены' : 'Проверка завершена';
    const links = group.questions.filter(q => core.hasAnswer(q, state.answers[q.id]) && !core.grade(q, state.answers[q.id])).map(q => {
      const i = group.questions.indexOf(q);
      const stepId = group.id === 'entry' ? ['independent', 'independent', 'independent', 'independent', 'independent', 'service'][i] : q.reviewStep;
      return content.steps.findIndex(step => step.id === stepId);
    });
    const recommendations = [...new Set(links)].map(i => `<button type="button" class="button secondary" data-step="${i}">${escape(content.steps[i].title)}</button>`).join('');
    return `<section class="result"><h3>${resultTitle}</h3><div class="result-numbers">${[['Верно', summary.correct], ['Ошибки', summary.incorrect], ['Без ответа', summary.unanswered]].map(([label, value]) => `<div class="result-number"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>${recommendations ? '<p>Можно вернуться к объяснениям:</p>' : summary.unanswered ? '' : `<p>${group.id === 'entry' ? 'Все ответы верны. Можно продолжить урок.' : 'Все ответы верны. Ниже можно ещё раз прочитать разбор.'}</p>`}<div class="result-actions">${summary.unanswered ? `<button type="button" class="button primary" data-action="resume-assessment" data-group="${group.id}">${icon('arrowRight')}Продолжить проверку</button>` : ''}${recommendations}<button type="button" class="button secondary" data-action="restart-assessment" data-group="${group.id}">${icon('rotate')}Пройти ещё раз</button></div></section><div class="review">${group.questions.map((q, i) => {
      const answer = answerFor(q);
      const answered = core.hasAnswer(q, answer);
      const correct = core.grade(q, answer);
      const status = !answered ? 'Нет ответа' : correct ? 'Верно' : 'Ошибка';
      const chosen = q.type === 'tokens' || q.type === 'choice' ? q.choices.filter(x => answer.selected.includes(x.value)).map(x => x.label).join(', ') : q.type === 'sort' ? q.rows.map(row => `${row.label}: ${q.choices.find(option => option.value === answer.mapping[row.id])?.label || 'не выбрано'}`).join('; ') : answer.text;
      return `<section class="review-item"><h4>${i + 1}. ${status}</h4>${q.contextHtml ? `<div class="question-context">${q.contextHtml}</div>` : ''}<div>${q.promptHtml}</div>${q.type === 'tokens' ? `<p>${q.sentenceParts.map(p => escape(p.text ?? p.word.label)).join('')}</p>` : ''}<p class="review-tags">Ваш ответ: ${escape(chosen || 'не дан')}</p>${answered ? `<details${!correct ? ' open' : ''}><summary>Разбор ответа</summary>${feedback(q, answer, false)}</details>` : ''}</section>`;
    }).join('')}</div>`;
  }
  function renderGroup(group) {
    if (group.assessment && state.submitted[group.id]) return assessmentResult(group);
    const cursor = state.cursors[group.id] || 0;
    const q = group.questions[cursor];
    const answer = answerFor(q);
    const locked = !group.assessment && answer.checked;
    const answered = group.questions.filter(x => core.hasAnswer(x, state.answers[x.id])).length;
    const intro = group.assessment ? `<div class="assessment-top"><span>Ответы: ${answered} из ${group.questions.length}</span><span>${cursor + 1} / ${group.questions.length}</span></div>` : '';
    return `${intro}<section class="exercise" data-group="${group.id}"><div class="exercise-header"><div><p class="exercise-label">${group.assessment ? 'Проверка' : 'Практика'}</p><h3>${escape(group.title)}</h3></div>${group.assessment ? '' : `<p class="question-count">${cursor + 1} / ${group.questions.length}</p>`}</div>${!group.assessment && group.instructionHtml && q.type !== 'sort' ? `<div class="group-instruction">${group.instructionHtml}</div>` : ''}${q.contextHtml ? `<div class="question-context">${q.contextHtml}</div>` : ''}<div class="question-prompt">${q.promptHtml}</div>${questionControls(q, answer, locked)}${q.reflectionLabel ? `<div class="reflection"><label for="reflection-${q.id}">${escape(q.reflectionLabel)}</label><textarea id="reflection-${q.id}" data-question="${q.id}" data-reflection maxlength="2000"${locked ? ' disabled' : ''}>${escape(answer.reflection)}</textarea><span class="reflection-note">Можно записать своё объяснение и сравнить его с разбором после проверки.</span></div>` : ''}${locked ? feedback(q, answer) : ''}<div class="question-actions"><div class="question-navigation"><button type="button" class="icon-button" data-action="previous-question" data-group="${group.id}" title="Предыдущее задание" aria-label="Предыдущее задание"${cursor === 0 ? ' disabled' : ''}>${icon('arrowLeft')}</button><button type="button" class="icon-button" data-action="next-question" data-group="${group.id}" title="Следующее задание" aria-label="Следующее задание"${cursor === group.questions.length - 1 ? ' disabled' : ''}>${icon('arrowRight')}</button></div>${group.assessment ? `<button type="button" class="button primary" data-action="submit-assessment" data-group="${group.id}">Завершить проверку</button>` : `<button type="button" class="button ${locked ? 'secondary' : 'primary'}" data-action="${locked ? 'retry' : 'check'}" data-question="${q.id}"${!locked && !core.hasAnswer(q, answer) ? ' disabled' : ''}>${icon(locked ? 'rotate' : 'check')}${locked ? 'Ответить ещё раз' : 'Проверить'}</button>`}</div></section>`;
  }
  function render() {
    const step = content.steps[state.step];
    const steps = chapterSteps();
    $('section-number').textContent = `Раздел ${steps.findIndex(item => item.index === state.step) + 1} из ${steps.length}`;
    $('lesson-heading').textContent = step.title;
    $('lesson-content').innerHTML = `${step.html ? `<div class="theory">${trustedTheory(step.html)}</div>` : ''}${step.groups.map(id => renderGroup(content.groups[id])).join('')}`;
    updateNavigation();
  }
  function refreshQuestion(q) {
    const group = groupByQuestion[q.id];
    const exercise = document.querySelector(`.exercise[data-group="${group.id}"]`);
    if (!exercise) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderGroup(group);
    if (group.assessment) { render(); return; }
    exercise.replaceWith(wrapper.firstElementChild);
    updateNavigation();
  }
  function updateAnswer(element) {
    const q = questionById[element.dataset.question];
    if (!q || answerFor(q).checked || state.submitted[groupByQuestion[q.id].id]) return;
    const answer = state.answers[q.id] ||= answerFor(q);
    if ('reflection' in element.dataset) answer.reflection = element.value;
    else if ('text' in element.dataset) answer.text = element.value;
    else if ('row' in element.dataset) answer.mapping[element.dataset.row] = element.value;
    else answer.selected = [element.value];
    persist();
    const check = document.querySelector(`[data-action="check"][data-question="${q.id}"]`);
    if (check) check.disabled = !core.hasAnswer(q, answer);
    if (q.type === 'choice') document.querySelectorAll(`input[name="${q.id}"]`).forEach(input => input.closest('.choice').classList.toggle('selected', input.checked));
    if (groupByQuestion[q.id].assessment) {
      const group = groupByQuestion[q.id];
      document.querySelector('.assessment-top span').textContent = `Ответы: ${group.questions.filter(x => core.hasAnswer(x, state.answers[x.id])).length} из ${group.questions.length}`;
    }
  }
  $('lesson-content').addEventListener('input', event => {
    if (event.target.matches('[data-text],[data-reflection]')) updateAnswer(event.target);
  });
  $('lesson-content').addEventListener('change', event => {
    if (event.target.matches('input[type=radio],select[data-row]')) updateAnswer(event.target);
  });
  document.addEventListener('click', event => {
    const stepButton = event.target.closest('[data-step]');
    if (stepButton) { navigate(Number(stepButton.dataset.step)); return; }
    const word = event.target.closest('[data-word]');
    if (word && !word.disabled) {
      const q = questionById[word.dataset.question];
      const answer = state.answers[q.id] ||= answerFor(q);
      const value = word.dataset.word;
      answer.selected = q.multiple ? answer.selected.includes(value) ? answer.selected.filter(x => x !== value) : [...answer.selected, value] : answer.selected.includes(value) ? [] : [value];
      persist();
      refreshQuestion(q);
      document.querySelector(`[data-question="${q.id}"][data-word="${value}"]`)?.focus({ preventScroll: true });
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    const group = content.groups[button.dataset.group];
    const q = questionById[button.dataset.question];
    if (action === 'previous-question' || action === 'next-question') {
      state.cursors[group.id] = (state.cursors[group.id] || 0) + (action === 'next-question' ? 1 : -1);
      persist();
      render();
      const prompt = document.querySelector(`.exercise[data-group="${group.id}"] .question-prompt`);
      prompt.tabIndex = -1;
      prompt.focus({ preventScroll: true });
      prompt.scrollIntoView({ block: 'center', behavior: 'instant' });
    } else if (action === 'check' || action === 'retry') {
      const answer = state.answers[q.id] ||= answerFor(q);
      if (action === 'check' && !core.hasAnswer(q, answer)) return;
      answer.checked = action === 'check';
      if (answer.checked) answer.attempts++;
      persist();
      refreshQuestion(q);
      const target = document.querySelector(`.exercise[data-group="${groupByQuestion[q.id].id}"] ${answer.checked ? '.feedback' : '.question-prompt'}`);
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    } else if (action === 'submit-assessment') {
      state.submitted[group.id] = true;
      persist();
      render();
      $('lesson-heading').focus({ preventScroll: true });
      $('lesson-main').scrollIntoView({ block: 'start', behavior: 'instant' });
    } else if (action === 'resume-assessment') {
      const missing = group.questions.findIndex(question => !core.hasAnswer(question, state.answers[question.id]));
      if (missing < 0) return;
      state.submitted[group.id] = false;
      state.cursors[group.id] = missing;
      persist();
      render();
      $('lesson-heading').focus({ preventScroll: true });
      $('lesson-main').scrollIntoView({ block: 'start', behavior: 'instant' });
    } else if (action === 'restart-assessment') {
      state.submitted[group.id] = false;
      state.cursors[group.id] = 0;
      for (const question of group.questions) delete state.answers[question.id];
      persist();
      render();
    }
  });
  $('section-select').addEventListener('change', event => navigate(Number(event.target.value)));
  $('previous-section').addEventListener('click', () => navigate(state.step - 1));
  $('next-section').addEventListener('click', () => {
    const step = content.steps[state.step];
    if (!step.groups.length && !state.read.includes(step.id)) state.read.push(step.id);
    const steps = chapterSteps();
    if (state.step === steps.at(-1).index) { persist(); location.assign('./'); }
    else navigate(state.step + 1);
  });
  $('large-mode').addEventListener('click', () => { state.large = !state.large; persist(); updateNavigation(); });
  $('reset-lesson').addEventListener('click', () => {
    $('reset-dialog').returnValue = '';
    $('reset-dialog').showModal();
  });
  $('reset-dialog').addEventListener('close', () => {
    if ($('reset-dialog').returnValue !== 'confirm') return;
    try {
      const latest = core.parseState(localStorage.getItem(storageKey), content);
      state = core.mergeState(baseline, state, latest);
      baseline = JSON.parse(JSON.stringify(state));
    } catch (_) { /* Local reset still works when browser storage is unavailable. */ }
    const steps = chapterSteps();
    const ids = new Set(steps.map(item => item.step.id));
    state.read = state.read.filter(id => !ids.has(id));
    for (const { step } of steps) for (const id of step.groups) {
      delete state.cursors[id];
      delete state.submitted[id];
      for (const question of content.groups[id].questions) delete state.answers[question.id];
    }
    navigate(steps[0].index);
  });
  const url = new URL(location.href);
  const requestedStep = content.steps.findIndex(step => step.id === url.searchParams.get('section'));
  const requestedChapter = content.chapters.find(chapter => chapter.id === url.searchParams.get('chapter'));
  if (requestedStep >= 0) {
    navigate(requestedStep);
  } else if (requestedChapter) {
    const steps = content.steps.map((step, index) => ({ step, index })).filter(item => item.step.chapter === requestedChapter.id);
    const lastVisited = steps.find(item => item.step.id === state.stepId);
    const nextUnread = steps.find(item => !complete(item.step));
    navigate((lastVisited || nextUnread || steps[0]).index);
  } else {
    navigate(state.step);
  }
})();
