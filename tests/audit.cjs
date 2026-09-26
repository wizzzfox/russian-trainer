const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

function load(section) {
  const html = fs.readFileSync(path.join(root, section, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${section}: duplicate IDs`);
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {value: '10', style: {}, dataset: {}, children: [], textContent: '', innerHTML: '',
      classList: {add: (...xs) => xs.forEach(x => classes.add(x)), remove: (...xs) => xs.forEach(x => classes.delete(x)), contains: x => classes.has(x), toggle(x, on = !classes.has(x)) {on ? classes.add(x) : classes.delete(x); return on;}},
      addEventListener() {}, setAttribute() {}, focus() {}, appendChild(child) {this.children.push(child);if(child.id)elements.set(child.id,child);},
    };
  }
  ids.forEach(id => elements.set(id, element()));
  const document = {
    getElementById(id) {if (!elements.has(id)) throw Error(`${section}: missing element ${id}`); return elements.get(id);},
    querySelectorAll() {return [];}, addEventListener() {}, createElement: element,
    createTextNode(text) {return {textContent: text};}, activeElement: null,
  };
  const context = vm.createContext({document, window: {location: {}, addEventListener() {}}, getComputedStyle() {return {fontSize:'48px'};}, localStorage: {getItem() {return null;}, setItem() {}}, setTimeout() {}, console});
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], context);
  return {html, run: code => vm.runInContext(code, context)};
}

function inspect() {
  for (const section of ['udareniya', 'paronimy', 'frazeologizmy']) {
    const site = load(section);
    const modes = site.run('Object.keys(MODES).filter(x=>x!=="team")');
    for (const mode of modes) {
      const questions = site.run(`buildQuestionSet(${JSON.stringify(mode)},100)`);
      const invalid = questions.filter(q => q.choices?.length && typeof q.choices[0] === 'string' && (!q.choices.includes(q.correct) || new Set(q.choices).size !== q.choices.length));
      console.log(section, mode, 'count:', questions.length, 'invalid choices:', invalid.length);
      assert.equal(invalid.length, 0, `${section}/${mode}: missing or duplicate answer`);
    }
    if (section === 'paronimy') {
      const all = site.run('ITEMS.filter(hasParonym).map(paronymChoiceQuestion)');
      const invalid = all.filter(q => !q.choices.includes(q.correct));
      assert.equal(invalid.length, 0, 'Every paronym task must offer its correct answer');
      console.log('All paronym combinations checked:', all.length);
      for(const form of ['адресата','гордыню','информацией','наличности','обхватил','охватила','поделки','проделки']) {
        assert.ok(all.some(q=>q.correct.toLowerCase()===form), `Missing form: ${form}`);
      }
      assert.equal(site.run('inflectAdjective("Красящий","neut")'), 'Красящее');
      assert.equal(site.run('inflectAdjective("Соседний","plur")'), 'Соседние');
      assert.equal(site.run('blankContextFromExample({word:"Охватить"},"О чувствах").replaced'), false);
      for(const mode of ['meaning','findError','ege']) for(let i=0;i<10;i++) {
        const qs=site.run(`buildQuestionSet('${mode}',100)`);
        assert.equal(qs.length,100);
        const keys=qs.map(q=>q.task?.id||`${q.item.groupIndex}:${q.item.itemIndex}`);
        assert.equal(new Set(keys).size,100, `Repeated task: ${mode}`);
      }
    }
    if (section === 'udareniya') {
      assert.equal(site.run('WORDS.filter(x=>!QUIZ_WORDS.includes(x)).length'),0);
      assert.equal(site.run('WORDS.filter(x=>stressedIndex(x.accent)<0).length'),0);
      assert.equal(site.run('EGE_WORDS.filter(x=>!plausibleWrongVariants(x).length||plausibleWrongVariants(x).some(y=>y===x.accent)).length'),0);
      for(let i=0;i<10;i++) {
        const cards=site.run('buildQuestionSet("stress",100)');
        assert.equal(new Set(cards.map(q=>q.correct)).size,100);
      }
      site.run('state.questions=[buildEgeQuestion()];state.index=0;renderEgeQuestion(state.questions[0])');
      assert.ok(site.run('$("answers").children.every(b=>b.innerHTML.startsWith(\'<span class="choice-word">\'))'));
      console.log('Stress coverage:',site.run('QUIZ_WORDS.length'));
    }
    if(section==='frazeologizmy') {
      for(let i=0;i<10;i++) for(const mode of modes) {
        const qs=site.run(`buildQuestionSet('${mode}',100)`);
        for(const q of qs) if(q.choices?.length) {
          assert.equal(new Set(q.choices).size,q.choices.length,'Duplicate phrase choice');
          assert.ok(q.choices.includes(q.correct));
        }
        assert.ok(site.run(`(()=>{const qs=buildQuestionSet('${mode}',100);return qs.every((q,i)=>qs.slice(i+1).every(other=>!questionsShareExample(q,other)))})()`), `Repeated example in ${mode}`);
      }
    }
    if(section!=='frazeologizmy') {
      site.run('state.questions=[{answered:true},{answered:false}];state.index=0;state.answered=false;updateProgress()');
      assert.equal(site.run('$("progress").style.width'),'50%','Progress must include the current answer');
    }
    for(const mode of modes) {
      site.run(`startQuiz('${mode}')`);
      if(section==='udareniya') {
        if(mode==='stress')site.run('answerCard(state.questions[0].correctIndex,document.createElement("button"));answerCard(0,document.createElement("button"))');
        else site.run('state.questions[0].selected=state.questions[0].choices.flatMap((x,i)=>x.isCorrect?[i]:[]);checkEgeAnswer();checkEgeAnswer()');
      } else if(site.run('!!state.questions[0].inputMode')) {
        site.run(`$('${section==='paronimy'?'typedAnswer':'textAnswer'}').value=state.questions[0].correct`);
        site.run(section==='paronimy'?'checkTypedAnswer();checkTypedAnswer()':'checkTextAnswer();checkTextAnswer()');
      } else site.run('answer(state.questions[0].correct,document.createElement("button"));answer(state.questions[0].correct,document.createElement("button"))');
      assert.equal(site.run('state.score'),1,`${section}/${mode}: score or duplicate submission`);
      site.run('nextQuestion();previousQuestion()');
      assert.equal(site.run('state.questions[0].answered'),true);
      site.run('showResult()');
    }
  }
  const pages=['index.html',...['udareniya','paronimy','frazeologizmy'].map(x=>`${x}/index.html`)];
  const footers=[];
  for(const page of pages){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    footers.push(html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/)[1].trim());
    for(const [,link] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      if(/^(https?:|#|data:)/.test(link))continue;
      assert.ok(fs.existsSync(path.resolve(root,path.dirname(page),link)),`Broken local link: ${page}: ${link}`);
    }
  }
  assert.equal(new Set(footers).size,1,'Footers must match');
  console.log('PASS: regression checks, local links and footers');
}
if (require.main === module) inspect();
module.exports = {load};
