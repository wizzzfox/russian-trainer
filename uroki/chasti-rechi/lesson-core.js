(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.LessonCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = value => String(value ?? '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/^[\s.,!?«»"']+|[\s.,!?«»"']+$/g, '');
  function hasAnswer(question, answer) {
    if (!answer) return false;
    if (question.type === 'input') return normalize(answer.text).length > 0;
    if (question.type === 'sort') return question.rows.every(row => question.choices.some(choice => choice.value === answer.mapping?.[row.id]));
    return Array.isArray(answer.selected) && answer.selected.length > 0 && answer.selected.every(value => question.choices.some(choice => choice.value === value));
  }
  function grade(question, answer) {
    if (!hasAnswer(question, answer)) return false;
    if (question.type === 'input') return question.correct.some(value => normalize(value) === normalize(answer.text));
    if (question.type === 'sort') return question.rows.every(row => answer.mapping[row.id] === row.correct);
    const selected = new Set(answer.selected);
    return selected.size === question.correct.length && question.correct.every(value => selected.has(value));
  }
  function summarize(questions, answers) {
    let correct = 0, incorrect = 0, unanswered = 0;
    for (const question of questions) {
      if (!hasAnswer(question, answers[question.id])) unanswered++;
      else if (grade(question, answers[question.id])) correct++;
      else incorrect++;
    }
    return { correct, incorrect, unanswered, total: questions.length };
  }
  function isStepComplete(step, content, state) {
    if (!step.groups.length) return state.read.includes(step.id);
    return step.groups.every(id => {
      const group = content.groups[id];
      return group.assessment ? state.submitted[id] && group.questions.every(q => hasAnswer(q, state.answers[q.id])) : group.questions.every(q => state.answers[q.id]?.checked);
    });
  }
  function cleanState(saved, content) {
    const fresh = { version: content.version, theoryRevision: content.theoryRevision, finalRevision: content.finalRevision || 1, step: 0, stepId: content.steps[0].id, answers: {}, cursors: {}, read: [], submitted: Object.fromEntries(Object.values(content.groups).filter(group => group.assessment).map(group => [group.id, false])), large: false };
    if (!saved || saved.version !== content.version) return fresh;
    const sameTheory = saved.theoryRevision === content.theoryRevision;
    const stepId = typeof saved.stepId === 'string' ? saved.stepId : Number.isInteger(saved.step) ? (content.previousStepIds || content.steps.map(step => step.id))[saved.step] : undefined;
    const index = content.steps.findIndex(step => step.id === (content.stepAliases?.[stepId] || stepId));
    if (sameTheory && index >= 0) fresh.step = index;
    fresh.stepId = content.steps[fresh.step].id;
    fresh.large = saved.large === true;
    fresh.read = sameTheory && Array.isArray(saved.read) ? [...new Set(saved.read.filter(id => content.steps.some(step => step.id === id && step.groups.length === 0)))] : [];
    for (const group of Object.values(content.groups)) {
      const cursor = saved.cursors?.[group.id];
      fresh.cursors[group.id] = Number.isInteger(cursor) && cursor >= 0 && cursor < group.questions.length ? cursor : 0;
      for (const q of group.questions) {
        const a = saved.answers?.[q.id];
        if (!a || typeof a !== 'object') continue;
        const answer = { selected: [], mapping: {}, text: '', reflection: '', checked: false, attempts: 0 };
        if (Array.isArray(a.selected) && q.choices) answer.selected = [...new Set(a.selected.filter(value => typeof value === 'string' && q.choices.some(x => x.value === value)))];
        if (q.type === 'sort') for (const row of q.rows) if (q.choices.some(x => x.value === a.mapping?.[row.id])) answer.mapping[row.id] = a.mapping[row.id];
        if (typeof a.text === 'string') answer.text = a.text.slice(0, 1000);
        if (typeof a.reflection === 'string') answer.reflection = a.reflection.slice(0, 2000);
        answer.checked = !group.assessment && a.checked === true && hasAnswer(q, answer);
        answer.attempts = Number.isInteger(a.attempts) && a.attempts > 0 ? Math.min(a.attempts, 1000) : 0;
        fresh.answers[q.id] = answer;
      }
    }
    for (const id of Object.keys(fresh.submitted)) fresh.submitted[id] = saved.submitted?.[id] === true;
    // An expanded assessment resumes at the first new unanswered question.
    if (saved.finalRevision !== fresh.finalRevision && fresh.submitted.final) {
      const missing = content.groups.final.questions.findIndex(q => !hasAnswer(q, fresh.answers[q.id]));
      if (missing >= 0) {
        fresh.submitted.final = false;
        fresh.cursors.final = missing;
      }
    }
    return fresh;
  }
  return { normalize, hasAnswer, grade, summarize, cleanState, isStepComplete };
});
