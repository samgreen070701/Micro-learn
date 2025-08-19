// MicroLearn — localStorage flashcards with spaced repetition (SM-2 lite)

const $ = sel => document.querySelector(sel);
const state = {
  current: null,
  startedAt: null,
  goalMin: parseInt(localStorage.getItem('ml.goalMin') || '5', 10),
  streak: parseInt(localStorage.getItem('ml.streak') || '0', 10),
  lastDay: localStorage.getItem('ml.lastDay') || null,
  timerInterval: null,
  filter: localStorage.getItem('ml.filter') || 'all'
};

const defaultDeck = [
  { id: uid(), front: "Prefix: bio-", back: "Meaning: life. Example: biology.", tags: ["morphemes","literacy"], due: Date.now(), ivl: 0, ef: 2.5, reps: 0 },
  { id: uid(), front: "Science: Why is the sky blue?", back: "Rayleigh scattering. Short blue wavelengths scatter more in the atmosphere.", tags: ["science"], due: Date.now(), ivl: 0, ef: 2.5, reps: 0 },
  { id: uid(), front: "Fitness cue: Squat brace", back: "Inhale, ribs down, 360° brace, spread the floor.", tags: ["fitness"], due: Date.now(), ivl: 0, ef: 2.5, reps: 0 },
];

function uid(){ return Math.random().toString(36).slice(2,10) }

function getDeck(){
  const raw = localStorage.getItem('ml.deck');
  if(!raw){
    localStorage.setItem('ml.deck', JSON.stringify(defaultDeck));
    return defaultDeck;
  }
  try { return JSON.parse(raw); } catch(e){ return [] }
}

function setDeck(deck){
  localStorage.setItem('ml.deck', JSON.stringify(deck));
  refreshTopics(deck);
}

function refreshTopics(deck){
  const select = $('#topicFilter');
  const tags = new Set(['all']);
  deck.forEach(c => (c.tags||[]).forEach(t => tags.add(t)));
  const value = state.filter;
  select.innerHTML = '';
  [...tags].forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    select.appendChild(opt);
  });
  if ([...tags].includes(value)) select.value = value; else select.value = 'all';
}

function nextCard(){
  const deck = getDeck();
  const now = Date.now();
  let candidates = deck.filter(c => c.due <= now);
  if(state.filter !== 'all'){
    candidates = candidates.filter(c => (c.tags||[]).includes(state.filter));
  }
  if(candidates.length === 0){
    // pick the nearest upcoming card
    candidates = deck.slice().sort((a,b)=>a.due-b.due).slice(0,1);
  }
  state.current = candidates[Math.floor(Math.random()*candidates.length)] || null;
  renderCardFront();
}

function renderCardFront(){
  const c = state.current;
  if(!c){ $('#cardTitle').textContent = 'No cards'; $('#cardBody').textContent='Add some in the editor.'; $('#cardTags').textContent=''; return; }
  $('#cardTitle').textContent = c.front;
  $('#cardBody').textContent = 'Tap Reveal when ready.';
  $('#cardTags').innerHTML = (c.tags||[]).map(t=>`<span class="pill">${t}</span>`).join('');
  $('#gradeBtns').classList.add('hidden');
}

function renderCardBack(){
  const c = state.current;
  if(!c) return;
  $('#cardBody').textContent = c.back;
  $('#gradeBtns').classList.remove('hidden');
}

function gradeCard(grade){
  const deck = getDeck();
  const idx = deck.findIndex(x => x.id === state.current.id);
  if(idx === -1) return;
  const c = deck[idx];
  // SM-2 lite
  const q = grade === 'again' ? 0 : grade === 'hard' ? 3 : 5;
  if(q < 3){
    c.reps = 0;
    c.ivl = 1;
  }else{
    c.reps = (c.reps || 0) + 1;
    if(c.reps === 1) c.ivl = 1;
    else if(c.reps === 2) c.ivl = 6;
    else c.ivl = Math.round(c.ivl * (c.ef || 2.5));
    // update ease
    c.ef = Math.max(1.3, (c.ef || 2.5) + (0.1 - (5 - q)*(0.08 + (5 - q)*0.02)));
  }
  // schedule
  const now = Date.now();
  const day = 24*60*60*1000;
  c.due = now + c.ivl * day;
  deck[idx] = c;
  setDeck(deck);
  tickStreak();
  nextCard();
}

function tickStreak(){
  const today = new Date().toISOString().slice(0,10);
  if(state.lastDay !== today){
    // first study of the day
    if(state.lastDay){
      const y = new Date(Date.now()-86400000).toISOString().slice(0,10);
      if(state.lastDay === y) state.streak += 1;
      else state.streak = 1;
    } else {
      state.streak = 1;
    }
    state.lastDay = today;
    localStorage.setItem('ml.lastDay', state.lastDay);
    localStorage.setItem('ml.streak', String(state.streak));
    $('#streakCount').textContent = state.streak;
  }
}

function startTimer(){
  if(state.timerInterval) clearInterval(state.timerInterval);
  state.startedAt = Date.now();
  state.timerInterval = setInterval(()=>{
    const elapsed = Math.floor((Date.now() - state.startedAt)/1000);
    const m = String(Math.floor(elapsed/60)).padStart(2,'0');
    const s = String(elapsed%60).padStart(2,'0');
    $('#timer').textContent = `${m}:${s}`;
  }, 500);
}

function addCard(front, back, tagsStr){
  const deck = getDeck();
  const tags = tagsStr ? tagsStr.split(',').map(t=>t.trim()).filter(Boolean) : [];
  deck.push({ id: uid(), front, back, tags, due: Date.now(), ivl: 0, ef: 2.5, reps: 0 });
  setDeck(deck);
}

function exportJSON(){
  const data = { deck: getDeck(), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'microlearn_deck.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const parsed = JSON.parse(e.target.result);
      if(parsed.deck) setDeck(parsed.deck);
      alert('Imported.');
      nextCard();
    }catch(err){ alert('Invalid file.'); }
  };
  reader.readAsText(file);
}

function init(){
  // UI bindings
  $('#startBtn').addEventListener('click', ()=>{ startTimer(); nextCard(); });
  $('#skipBtn').addEventListener('click', nextCard);
  $('#revealBtn').addEventListener('click', renderCardBack);
  $('#gradeBtns').addEventListener('click', e => {
    if(e.target.dataset.grade) gradeCard(e.target.dataset.grade);
  });
  $('#addBtn').addEventListener('click', ()=>{
    const f = $('#newTitle').value.trim();
    const b = $('#newBack').value.trim();
    if(!f || !b) return alert('Front and back required.');
    addCard(f,b,$('#newTags').value);
    $('#newTitle').value=''; $('#newBack').value=''; $('#newTags').value='';
  });
  $('#exportBtn').addEventListener('click', exportJSON);
  $('#importFile').addEventListener('change', e=>{
    if(e.target.files && e.target.files[0]) importJSON(e.target.files[0]);
  });
  $('#streakCount').textContent = state.streak;
  $('#goalMin').textContent = state.goalMin;
  refreshTopics(getDeck());
  $('#topicFilter').addEventListener('change', e=>{
    state.filter = e.target.value;
    localStorage.setItem('ml.filter', state.filter);
    nextCard();
  });
  nextCard();
}
document.addEventListener('DOMContentLoaded', init);
