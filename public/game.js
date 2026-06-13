/* =========================================================================
   TREINACONDA - cliente (lobby, guarda-roupa, render do jogo, podio)
   ========================================================================= */
'use strict';

/* Conecta priorizando polling (mais confiavel no Render Free durante cold start).
   O Socket.io faz upgrade automatico para WebSocket apos a conexao inicial.
   Isso evita a tela preta que ocorre quando o WebSocket falha no wake-up do servidor. */
const socket = io({
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1500,
  timeout: 20000,
});

/* aviso discreto de status da conexao */
const netStatus = document.createElement('div');
netStatus.id = 'netStatus';
document.body.appendChild(netStatus);
function setNet(txt, show) {
  netStatus.textContent = txt;
  netStatus.classList.toggle('show', show);
}
let connectAttempt = 0;
socket.on('connect', () => { connectAttempt = 0; setNet('', false); });
socket.io.on('reconnect_attempt', (n) => {
  connectAttempt = n;
  setNet('🐍 Acordando o servidor...\nAguarde alguns segundos (' + n + 'ª tentativa)', true);
});
socket.io.on('error', () => setNet('🐍 Acordando o servidor...\nAguarde alguns segundos', true));
socket.on('connect_error', () => setNet('🐍 Conectando ao servidor...\nO servidor pode estar iniciando, aguarde!', true));
socket.on('disconnect', () => setNet('🐍 Reconectando…', true));

/* ----------------------------- Skins ------------------------------------ */
function skinColor(skin, i) {
  switch (skin) {
    case 0:  return '#e0392b';
    case 1:  return '#2f8f3e';
    case 2:  return (i % 8 < 4) ? '#161616' : '#e0392b';
    case 3:  return (i % 10 < 5) ? '#6b4423' : '#3b7a2e';
    case 4:  return 'hsl(45,85%,' + (48 + 12 * Math.sin(i * 0.25)) + '%)';
    case 5:  return 'hsl(280,55%,' + (50 + 12 * Math.sin(i * 0.22)) + '%)';
    case 6:  return (i % 8 < 4) ? '#c8e000' : '#2f8f3e';
    case 7:  return 'hsl(' + (18 + 10 * Math.sin(i * 0.15)) + ',90%,52%)';
    case 8:  return (i % 12 < 6) ? '#7a5230' : '#5a3a20';
    case 9:  return (i % 14 < 7) ? '#16110f' : '#2a1412';
    case 10: return 'hsl(' + ((i * 7) % 360) + ',78%,56%)';
    case 11: return 'hsl(330,70%,' + (60 + 10 * Math.sin(i * 0.2)) + '%)';
    default: return '#e0392b';
  }
}
const SKIN_HEADS = ['#ff5544','#46c95a','#e0392b','#7a9e3e','#ffcd5a','#b06fd6',
                    '#d8ff4d','#ff7a2e','#9a6a40','#3a1a18','#ff5566','#ff8ec0'];
const SKIN_NAMES = ['Brasa Treinador','Verde Mata','Coral Listrado','Jiboia',
                    'Ouro','Ametista','Veneno','Fogo','Casca','Sombra','Arco-íris','Rosa'];
const FOOD_COLORS = ['#ff6a5a','#ffd05a','#7ad06a','#6ac9ff','#c88aff','#ff8ad0','#f3e9dc','#9affc0'];

let mySkin = 0;
let SKIN_COUNT = 12;

/* --------------------------- Elementos DOM ------------------------------ */
const $ = (id) => document.getElementById(id);
const lobbyEl = $('lobby'), gameEl = $('game'), podiumEl = $('podium');
const nickIn = $('nick'), habboIn = $('habbo'), habboPrev = $('habboPreview');
const joinBtn = $('joinBtn'), joinMsg = $('joinMsg');
const roomBox = $('roomBox'), roomCount = $('roomCount'), playerList = $('playerList');
const hostControls = $('hostControls'), startBtn = $('startBtn'), waitHost = $('waitHost');

/* --------------------- Guarda-roupa (preview skins) --------------------- */
function buildWardrobe() {
  const grid = $('skinGrid');
  grid.innerHTML = '';
  for (let s = 0; s < SKIN_COUNT; s++) {
    const cell = document.createElement('div');
    cell.className = 'skin-cell' + (s === mySkin ? ' sel' : '');
    cell.title = SKIN_NAMES[s] || ('Skin ' + s);
    const c = document.createElement('canvas');
    c.width = 120; c.height = 120;
    drawSkinPreview(c.getContext('2d'), s);
    cell.appendChild(c);
    cell.addEventListener('click', () => {
      mySkin = s;
      socket.emit('setSkin', s);
      [...grid.children].forEach((ch, idx) => ch.classList.toggle('sel', idx === s));
    });
    grid.appendChild(cell);
  }
}
function drawSkinPreview(g, skin) {
  g.fillStyle = '#0c0805'; g.fillRect(0, 0, 120, 120);
  // cobrinha em S
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    pts.push({ x: 16 + t * 88, y: 60 + Math.sin(t * Math.PI * 2) * 26 });
  }
  const r = 11;
  g.lineJoin = g.lineCap = 'round';
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) g.lineTo(p.x, p.y);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = r * 2 + 4; g.stroke();
  g.strokeStyle = skinColor(skin, 0); g.lineWidth = r * 2; g.stroke();
  for (let i = pts.length - 1; i >= 0; i -= 2) {
    g.beginPath(); g.arc(pts[i].x, pts[i].y, r, 0, 6.2832);
    g.fillStyle = skinColor(skin, i); g.fill();
  }
  const h = pts[pts.length - 1];
  g.beginPath(); g.arc(h.x, h.y, r * 1.1, 0, 6.2832);
  g.fillStyle = SKIN_HEADS[skin]; g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(h.x + 3, h.y - 4, 3, 0, 6.28); g.fill();
  g.beginPath(); g.arc(h.x + 3, h.y + 4, 3, 0, 6.28); g.fill();
  g.fillStyle = '#111';
  g.beginPath(); g.arc(h.x + 5, h.y - 4, 1.5, 0, 6.28); g.fill();
  g.beginPath(); g.arc(h.x + 5, h.y + 4, 1.5, 0, 6.28); g.fill();
}

/* --------------------------- Avatar do Habbo ---------------------------- */
function habboFace(user, size) {
  size = size || 'm';
  return 'https://www.habbo.com.br/habbo-imaging/avatarimage?user=' +
    encodeURIComponent(user) + '&headonly=1&size=' + size +
    '&direction=2&head_direction=3&gesture=sml';
}
let habboTimer = null;
habboIn.addEventListener('input', () => {
  clearTimeout(habboTimer);
  const v = habboIn.value.trim();
  if (!v) { habboPrev.classList.remove('show'); return; }
  habboTimer = setTimeout(() => {
    habboPrev.onerror = () => habboPrev.classList.remove('show');
    habboPrev.onload = () => habboPrev.classList.add('show');
    habboPrev.src = habboFace(v, 's');
  }, 350);
});

/* ------------------------------- Entrar --------------------------------- */
let joined = false, amHost = false, myId = null;

joinBtn.addEventListener('click', () => {
  const nick = (nickIn.value || '').trim() || 'Treinador';
  const habbo = (habboIn.value || '').trim();
  socket.emit('join', { nick, habbo, skin: mySkin });
  joinBtn.disabled = true;
  joinMsg.textContent = 'Conectando…';
});

socket.on('full', () => { joinBtn.disabled = false; joinMsg.textContent = 'A sala está cheia (50/50).'; });

socket.on('joined', (d) => {
  joined = true; amHost = d.host; myId = d.id;
  SKIN_COUNT = d.skinCount || SKIN_COUNT;
  buildWardrobe();
  joinMsg.textContent = '';
  joinBtn.disabled = true; joinBtn.textContent = 'Na sala ✓';
  nickIn.disabled = true; habboIn.disabled = true;
  roomBox.classList.remove('hidden');
});

socket.on('lobby', (d) => {
  roomCount.textContent = d.count + '/' + d.max;
  // host controls
  const meEntry = d.players.find(p => p.id === myId);
  amHost = !!(meEntry && meEntry.host);
  if (joined) {
    hostControls.classList.toggle('hidden', !amHost);
    waitHost.classList.toggle('hidden', amHost);
  }
  // lista
  playerList.innerHTML = '';
  for (const p of d.players) {
    const li = document.createElement('li');
    if (p.id === myId) li.classList.add('me');
    if (p.habbo) {
      const img = document.createElement('img');
      img.className = 'pf'; img.src = habboFace(p.habbo, 's');
      img.onerror = () => { img.replaceWith(makeSwatch(p.skin)); };
      li.appendChild(img);
    } else {
      li.appendChild(makeSwatch(p.skin));
    }
    const nm = document.createElement('span');
    nm.className = 'pn';
    nm.textContent = p.nick;
    li.appendChild(nm);
    if (p.host) { const c = document.createElement('span'); c.className = 'crown'; c.textContent = '👑 host'; li.appendChild(c); }
    playerList.appendChild(li);
  }
});
function makeSwatch(skin) {
  const s = document.createElement('span');
  s.className = 'swatch';
  s.style.background = skinColor(skin, 0);
  return s;
}

startBtn.addEventListener('click', () => socket.emit('start'));

/* ---------------------------- Mudança de fase --------------------------- */
let phase = 'lobby';
socket.on('phase', (d) => {
  phase = d.phase;
  if (phase === 'playing') {
    lobbyEl.classList.add('hidden');
    podiumEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    enterGame();
  } else if (phase === 'lobby') {
    gameEl.classList.add('hidden');
    podiumEl.classList.add('hidden');
    lobbyEl.classList.remove('hidden');
    joinBtn.textContent = 'Na sala ✓';
  }
});

/* ============================== JOGO ==================================== */
const cv = $('cv');
const ctx = cv.getContext('2d');
const mm = $('minimap');
const mmx = mm.getContext('2d');
let W = 0, H = 0, DPR = 1;

// dispositivos de toque rodam num modo mais leve (menos pixels e menos detalhe)
const LOW = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;

function resize() {
  const cap = LOW ? 1.25 : 1.75;   // limita a densidade de pixels p/ ganhar desempenho
  DPR = Math.min(window.devicePixelRatio || 1, cap);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  vignette = null; // recria a vinheta no proximo quadro
}
window.addEventListener('resize', resize);
resize();

let world = null;            // ultimo snapshot do servidor (HUD e checagens)
let cam = { x: 0, y: 0 };
let scale = 1;

/* buffer de snapshots para interpolacao: o servidor manda 15 quadros/s,
   aqui renderizamos a 60fps suavizando entre eles (movimento continuo) */
const buf = [];
const INTERP_MS = 100;       // renderiza ~1,5 tick no passado e interpola
let frame = null;            // estado ja interpolado do quadro atual
let vignette = null;         // gradiente da vinheta em cache (recriado no resize)

function enterGame() {
  world = null; frame = null; buf.length = 0;
  $('spectBanner').classList.add('hidden');
  $('scoreTag').textContent = '0';
  $('boardList').innerHTML = '';
  $('myRank').textContent = '';
}

socket.on('s', (st) => {
  st._t = performance.now();
  st._byId = {};
  for (const s of st.snakes) st._byId[s.id] = s;
  buf.push(st);
  if (buf.length > 16) buf.shift();
  world = st;
  updateHud(st);
});

socket.on('died', () => {
  $('spectBanner').classList.remove('hidden');
});

/* --------------------------- HUD (DOM) ---------------------------------- */
function updateHud(st) {
  // timer
  const left = Math.max(0, st.tLeft | 0);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const tEl = $('timer');
  tEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  tEl.classList.toggle('urgent', left <= 15000);

  // score
  $('scoreTag').textContent = st.me.score;

  // espectador
  $('spectBanner').classList.toggle('hidden', !!st.me.alive);
  if (!st.me.alive) {
    $('spectSub').textContent = st.me.spectName ? ('Assistindo ' + st.me.spectName + ' • aguarde o fim') : 'Aguarde o fim da partida';
  }

  // ranking
  const list = $('boardList');
  list.innerHTML = '';
  st.lb.forEach((p) => {
    const li = document.createElement('li');
    if (!p.alive) li.classList.add('dead');
    if (p.nick === (myNick())) li.classList.add('self');
    if (p.habbo) {
      const img = document.createElement('img');
      img.src = habboFace(p.habbo, 's');
      img.onerror = () => img.remove();
      li.appendChild(img);
    }
    const nm = document.createElement('span'); nm.className = 'bn'; nm.textContent = p.nick;
    const sc = document.createElement('span'); sc.className = 'bs'; sc.textContent = p.score;
    li.appendChild(nm); li.appendChild(sc);
    list.appendChild(li);
  });
  $('myRank').textContent = st.me.rank ? ('Você: #' + st.me.rank + ' de ' + st.me.total) : '';
}
function myNick() {
  const e = playerList.querySelector('li.me .pn');
  return e ? e.textContent : (nickIn.value || '').trim();
}

/* --------------------------- Render loop -------------------------------- */
function toScreen(wx, wy) { return [(wx - cam.x) * scale + W / 2, (wy - cam.y) * scale + H / 2]; }
function lerp(a, b, t) { return a + (b - a) * t; }

/* Monta o quadro interpolado entre dois snapshots do servidor.
   A engine so adiciona uma cabeca nova por tick e mantem o corpo parado,
   entao basta crescer a cabeca de A ate B e manter o corpo de A. */
function buildFrame() {
  if (!buf.length) return null;
  const renderT = performance.now() - INTERP_MS;
  const last = buf[buf.length - 1];
  if (buf.length === 1 || renderT >= last._t) return frameFrom(last, last, 1);
  if (renderT <= buf[0]._t) return frameFrom(buf[0], buf[0], 0);

  let A = buf[0], B = buf[1];
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i]._t <= renderT && buf[i + 1]._t > renderT) { A = buf[i]; B = buf[i + 1]; break; }
  }
  const span = (B._t - A._t) || 1;
  let alpha = (renderT - A._t) / span;
  alpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return frameFrom(A, B, alpha);
}

function frameFrom(A, B, alpha) {
  const me = {
    x: lerp(A.me.x, B.me.x, alpha),
    y: lerp(A.me.y, B.me.y, alpha),
    score: B.me.score, alive: B.me.alive,
  };
  const snakes = [];
  const seen = {};
  for (const sa of A.snakes) {
    seen[sa.id] = 1;
    const sb = (A !== B) ? B._byId[sa.id] : null;
    if (sb && sa.pts.length >= 2 && sb.pts.length >= 2) {
      // corpo = pontos de A (estaticos); cabeca nova cresce suavemente ate B
      const ax = sa.pts;
      const pts = new Array(ax.length + 2);
      pts[0] = lerp(ax[0], sb.pts[0], alpha);
      pts[1] = lerp(ax[1], sb.pts[1], alpha);
      for (let i = 0; i < ax.length; i++) pts[i + 2] = ax[i];
      snakes.push({ id: sa.id, nick: sb.nick, skin: sb.skin,
        r: lerp(sa.r, sb.r, alpha), b: sb.b, me: sb.me, pts });
    } else {
      snakes.push(sa);
    }
  }
  for (const sb of B.snakes) if (!seen[sb.id]) snakes.push(sb);
  return { me, snakes, food: B.food, worldR: B.worldR };
}

function render() {
  requestAnimationFrame(render);
  if (gameEl.classList.contains('hidden')) return;
  frame = buildFrame();
  if (!frame) return;

  // camera trava na cabeca ja interpolada: scroll continuo do mundo
  cam.x = frame.me.x;
  cam.y = frame.me.y;
  scale = Math.max(0.72, 1.12 - Math.sqrt(frame.me.score) * 0.009);

  drawBackground();
  drawFood();
  for (const s of frame.snakes) if (!s.me) drawSnake(s);
  for (const s of frame.snakes) if (s.me) drawSnake(s);

  drawMinimap();
}
requestAnimationFrame(render);

function drawBackground() {
  ctx.fillStyle = '#0a0f0a';
  ctx.fillRect(0, 0, W, H);

  // grade da mata
  const grid = 110 * scale;
  const ox = ((-cam.x * scale) % grid + grid) % grid + (W / 2) % grid;
  const oy = ((-cam.y * scale) % grid + grid) % grid + (H / 2) % grid;
  ctx.strokeStyle = 'rgba(60,90,55,.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ox % grid; x < W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy % grid; y < H; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // limite da arena (perigo)
  const c = toScreen(0, 0);
  const R = frame.worldR * scale;
  ctx.beginPath();
  ctx.arc(c[0], c[1], R, 0, 6.2832);
  ctx.strokeStyle = 'rgba(224,57,43,.85)';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(224,57,43,.18)';
  ctx.lineWidth = 26;
  ctx.stroke();

  // vinheta (gradiente em cache para nao recriar a cada quadro)
  if (!vignette) {
    vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.55)');
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawFood() {
  const f = frame.food;
  const sc = Math.max(scale, 0.6);
  for (let i = 0; i < f.length; i += 4) {
    const x = (f[i] - cam.x) * scale + W / 2;
    const y = (f[i + 1] - cam.y) * scale + H / 2;
    if (x < -12 || x > W + 12 || y < -12 || y > H + 12) continue;
    const big = f[i + 3];
    const r = (big ? 7.5 : 3.4) * sc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = FOOD_COLORS[f[i + 2]] || '#ff6a5a';
    ctx.fill();
    if (big) {           // anel sutil so nas bolas grandes (poucas na tela)
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.stroke();
    }
  }
}

function drawSnake(s) {
  const pts = s.pts, n = pts.length / 2;
  if (n < 2) return;
  const r = Math.max(2.2, s.r * scale);

  ctx.lineJoin = ctx.lineCap = 'round';

  // caminho
  ctx.beginPath();
  let p0 = toScreen(pts[0], pts[1]);
  ctx.moveTo(p0[0], p0[1]);
  for (let i = 1; i < n; i++) { const p = toScreen(pts[i * 2], pts[i * 2 + 1]); ctx.lineTo(p[0], p[1]); }

  // brilho ao acelerar
  if (s.b) {
    ctx.strokeStyle = 'rgba(255,210,80,.35)';
    ctx.lineWidth = 2 * r + 10;
    ctx.stroke();
  }
  // contorno (pulado no modo leve do mobile)
  if (!LOW) {
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 2 * r + 5;
    ctx.stroke();
  }
  // preenchimento base
  ctx.strokeStyle = skinColor(s.skin, 0);
  ctx.lineWidth = 2 * r;
  ctx.stroke();

  // escamas / faixas de cor (so no desktop; no mobile fica a cor base, mais leve)
  if (!LOW) {
    for (let i = n - 1; i >= 0; i -= 4) {
      const px = (pts[i * 2] - cam.x) * scale + W / 2;
      const py = (pts[i * 2 + 1] - cam.y) * scale + H / 2;
      if (px < -r || px > W + r || py < -r || py > H + r) continue;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, 6.2832);
      ctx.fillStyle = skinColor(s.skin, i);
      ctx.fill();
    }
  }

  // cabeca
  const hx = p0[0], hy = p0[1];
  ctx.beginPath();
  ctx.arc(hx, hy, r * 1.14, 0, 6.2832);
  ctx.fillStyle = SKIN_HEADS[s.skin] || '#ff5544';
  ctx.fill();

  // olhos
  const dx = pts[0] - pts[2], dy = pts[1] - pts[3];
  const ang = Math.atan2(dy, dx);
  const ex = Math.cos(ang), ey = Math.sin(ang);
  const px = -ey, py = ex;
  const ef = r * 0.45, eo = r * 0.55, es = Math.max(1.6, r * 0.42);
  for (const side of [1, -1]) {
    const exX = hx + ex * ef + px * eo * side;
    const exY = hy + ey * ef + py * eo * side;
    ctx.beginPath(); ctx.arc(exX, exY, es, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(exX + ex * es * 0.4, exY + ey * es * 0.4, es * 0.5, 0, 6.2832); ctx.fillStyle = '#111'; ctx.fill();
  }

  // nome
  const fs = Math.max(11, r * 0.95);
  ctx.font = '700 ' + fs + 'px Inter, sans-serif';
  ctx.textAlign = 'center';
  if (!LOW) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(s.nick, hx, hy - r - 6 + 1); }
  ctx.fillStyle = s.me ? '#ffd27a' : '#fff';
  ctx.fillText(s.nick, hx, hy - r - 6);
}

function drawMinimap() {
  const w = mm.width, h = mm.height, cx = w / 2, cy = h / 2, R = w / 2 - 6;
  mmx.clearRect(0, 0, w, h);
  // mundo
  mmx.beginPath(); mmx.arc(cx, cy, R, 0, 6.2832);
  mmx.fillStyle = 'rgba(20,40,24,.55)'; mmx.fill();
  mmx.strokeStyle = 'rgba(224,57,43,.7)'; mmx.lineWidth = 2; mmx.stroke();
  // SOMENTE a posicao do jogador
  const wr = frame.worldR;
  const mxp = cx + (frame.me.x / wr) * R;
  const myp = cy + (frame.me.y / wr) * R;
  mmx.beginPath(); mmx.arc(mxp, myp, 4, 0, 6.2832);
  mmx.fillStyle = '#ff5544'; mmx.fill();
  mmx.strokeStyle = '#fff'; mmx.lineWidth = 1.5; mmx.stroke();
}

/* ------------------------------ Controles ------------------------------- */
let pointer = { x: 0, y: 0 };
let boosting = false;
const boostBtn = $('boostBtn');

window.addEventListener('mousemove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('mousedown', (e) => { if (e.target !== boostBtn) boosting = true; });
window.addEventListener('mouseup', () => { boosting = false; });
window.addEventListener('keydown', (e) => { if (e.code === 'Space') boosting = true; });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') boosting = false; });
window.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; if (t && t.target !== boostBtn) { pointer.x = t.clientX; pointer.y = t.clientY; }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  // usa o primeiro toque que nao for o botao de boost para mirar
  for (const t of e.touches) { if (t.target !== boostBtn) { pointer.x = t.clientX; pointer.y = t.clientY; break; } }
}, { passive: true });

// botao de boost (mobile)
const startBoost = (e) => { e.preventDefault(); boosting = true; };
const stopBoost = (e) => { if (e) e.preventDefault(); boosting = false; };
boostBtn.addEventListener('touchstart', startBoost, { passive: false });
boostBtn.addEventListener('touchend', stopBoost, { passive: false });
boostBtn.addEventListener('touchcancel', stopBoost, { passive: false });
boostBtn.addEventListener('mousedown', startBoost);
boostBtn.addEventListener('mouseup', stopBoost);

setInterval(() => {
  if (gameEl.classList.contains('hidden') || !world || !world.me.alive) return;
  const a = Math.atan2(pointer.y - H / 2, pointer.x - W / 2);
  socket.emit('input', { a, b: boosting });
}, 50);

/* ------------------------------- Pódio ---------------------------------- */
socket.on('podium', (d) => {
  gameEl.classList.add('hidden');
  lobbyEl.classList.add('hidden');
  podiumEl.classList.remove('hidden');
  renderPodium(d.podium || []);
});
function renderPodium(list) {
  const order = [1, 0, 2]; // 2o, 1o, 3o (visual)
  const spots = $('podiumSpots');
  spots.innerHTML = '';
  order.forEach((idx) => {
    const p = list[idx];
    if (!p) return;
    const place = p.rank;
    const spot = document.createElement('div');
    spot.className = 'spot p' + place;
    const sz = place === 1 ? 76 : 60;

    if (p.habbo) {
      const img = document.createElement('img');
      img.className = 'ava'; img.width = sz; img.height = sz + 8;
      img.src = habboFace(p.habbo, place === 1 ? 'l' : 'm');
      img.onerror = () => img.replaceWith(skinAvatar(p.skin, sz));
      spot.appendChild(img);
    } else {
      spot.appendChild(skinAvatar(p.skin, sz));
    }
    if (place === 1) { const cr = document.createElement('div'); cr.className = 'crown'; cr.textContent = '👑'; spot.appendChild(cr); }
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = p.nick; spot.appendChild(nm);
    const sc = document.createElement('div'); sc.className = 'sc'; sc.textContent = p.score + ' pts'; spot.appendChild(sc);
    const pillar = document.createElement('div'); pillar.className = 'pillar'; pillar.textContent = place; spot.appendChild(pillar);
    spots.appendChild(spot);
  });
  if (!list.length) spots.innerHTML = '<div class="nm">Sem pontuação nesta partida.</div>';
}
function skinAvatar(skin, sz) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz + 8; c.className = 'ava';
  drawSkinPreview(c.getContext('2d'), skin);
  return c;
}

/* foco automatico no nick ao abrir */
nickIn.focus();
buildWardrobe();
