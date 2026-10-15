(() => {
  const $ = s => document.querySelector(s);
  const LS = { get:(k,d)=>{try{return JSON.parse(localStorage.getItem('rk_'+k))??d}catch{return d}}, set:(k,v)=>{try{localStorage.setItem('rk_'+k,JSON.stringify(v))}catch{}} };
  const LABELS = { focus:'وقت التركيز', short:'استراحة قصيرة', long:'استراحة طويلة' };
  const today = new Date().toDateString();

  let durations = LS.get('dur', { focus:25, short:5, long:15 });
  let stats = LS.get('stats', { day:today, sessions:0, minutes:0 });
  if (stats.day !== today) stats = { day:today, sessions:0, minutes:0 };
  let tasks = LS.get('tasks', []);
  let mode = 'focus', total = durations.focus*60, left = total, timer = null, endAt = 0;

  const ring = $('#progress'), C = 2*Math.PI*88;
  ring.style.strokeDasharray = C;

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  function render(){
    $('#time').textContent = fmt(left);
    ring.style.strokeDashoffset = C * (1 - left/total);
    document.title = timer ? `${fmt(left)} · ${LABELS[mode]}` : 'ركيزة — مؤقت التركيز';
  }
  function renderStats(){
    $('#sessions').textContent = stats.sessions;
    $('#minutes').textContent = stats.minutes;
    $('#done').textContent = tasks.filter(t=>t.done).length;
  }

  function setMode(m){
    stop(); mode = m; total = left = durations[m]*60;
    document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active', b.dataset.mode===m));
    document.body.classList.toggle('break', m!=='focus');
    $('#label').textContent = LABELS[m];
    render();
  }
  function start(){
    if (timer) return;
    endAt = Date.now() + left*1000;
    timer = setInterval(tick, 250);
    $('#startBtn').textContent = 'إيقاف مؤقت';
    render();
  }
  function stop(){
    clearInterval(timer); timer = null;
    $('#startBtn').textContent = left < total ? 'تابع' : 'ابدأ';
    render();
  }
  function tick(){
    left = Math.max(0, Math.round((endAt - Date.now())/1000));
    render();
    if (left === 0) finish();
  }
  function finish(){
    stop(); chime();
    if (mode === 'focus'){
      stats.sessions++; stats.minutes += durations.focus; LS.set('stats', stats); renderStats();
      notify('خلصت جلسة التركيز', 'خذلك استراحة صغيرة.');
      setMode(stats.sessions % 4 === 0 ? 'long' : 'short');
    } else {
      notify('خلصت الاستراحة', 'يلا نرجع للتركيز.');
      setMode('focus');
    }
  }
  function chime(){
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      [660, 880, 990].forEach((f,i)=>{
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0, ctx.currentTime + i*.18);
        g.gain.linearRampToValueAtTime(.25, ctx.currentTime + i*.18 + .02);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i*.18 + .6);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i*.18); o.stop(ctx.currentTime + i*.18 + .7);
      });
    }catch{}
  }
  function notify(title, body){
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
  }

  $('#startBtn').onclick = () => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    timer ? stop() : start();
  };
  $('#resetBtn').onclick = () => setMode(mode);
  $('#skipBtn').onclick = () => { left = 0; finish(); };
  document.querySelectorAll('.mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){ e.preventDefault(); $('#startBtn').click(); }
  });

  // durations
  [['focus','#dFocus'],['short','#dShort'],['long','#dLong']].forEach(([k,id])=>{
    const el = $(id); el.value = durations[k];
    el.onchange = () => {
      const v = Math.min(+el.max, Math.max(1, parseInt(el.value)||durations[k]));
      el.value = v; durations[k] = v; LS.set('dur', durations);
      if (k === mode && !timer) setMode(mode);
    };
  });

  // tasks
  function renderTasks(){
    const ul = $('#taskList'); ul.innerHTML = '';
    tasks.forEach((t,i)=>{
      const li = document.createElement('li'); li.className = 'task' + (t.done?' done':'');
      li.innerHTML = `<button class="check" aria-label="إنجاز"></button><span class="txt"></span><button class="del" aria-label="حذف">×</button>`;
      li.querySelector('.txt').textContent = t.text;
      li.querySelector('.check').onclick = () => { t.done = !t.done; saveTasks(); };
      li.querySelector('.del').onclick = () => { tasks.splice(i,1); saveTasks(); };
      ul.appendChild(li);
    });
    $('#empty').hidden = tasks.length > 0;
    renderStats();
  }
  function saveTasks(){ LS.set('tasks', tasks); renderTasks(); }
  $('#taskForm').onsubmit = e => {
    e.preventDefault(); const v = $('#taskInput').value.trim(); if (!v) return;
    tasks.push({ text:v, done:false }); $('#taskInput').value = ''; saveTasks();
  };

  // theme
  const root = document.documentElement;
  root.dataset.theme = LS.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $('#themeBtn').onclick = () => { root.dataset.theme = root.dataset.theme==='dark'?'light':'dark'; LS.set('theme', root.dataset.theme); };

  setMode('focus'); renderTasks();
})();
