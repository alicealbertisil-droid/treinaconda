/* =========================================================================
   TREINACONDA - Servidor de jogo autoritativo (estilo slither.io)
   - Sala unica, primeiro jogador a entrar vira host
   - Host inicia a partida; cada partida dura 4 minutos
   - Comer pontos pelo mapa = crescer e somar pontos
   - Bater na cobra de outro = morre e vira espectador ate o tempo acabar
   - No fim: podio do 1o lugar por 5s e volta para o lobby
   ========================================================================= */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.send('ok'));

/* ----------------------------- Configuracao ----------------------------- */
const TICK_HZ      = 15;                 // simulacao + rede
const TICK_MS      = 1000 / TICK_HZ;
const WORLD_RADIUS = 2200;               // arena circular (dimensionada p/ ~25 jogadores)
const ROUND_MS     = 4 * 60 * 1000;      // 4 minutos
const PODIUM_MS    = 5000;               // 5 segundos de podio
const MAX_PLAYERS  = 50;                 // bem acima dos 25 pedidos
const TARGET_FOOD  = 600;
const BIG_FOOD_VAL = 5;                  // bolas grandes valem mais pontos
const VIEW_RADIUS  = 1250;               // area de interesse enviada a cada cliente
const SKIN_COUNT   = 12;

const NORMAL_SPEED = 230 / TICK_HZ;      // px por tick
const BOOST_SPEED  = 400 / TICK_HZ;
const BOOST_MIN    = 5;                  // pontos minimos para conseguir acelerar
const BASE_R       = 14;
const MIN_LEN      = 240;                // comprimento (px) com score 0
const MAX_POINTS   = 380;

/* ------------------------------- Estado --------------------------------- */
let phase        = 'lobby';              // lobby | playing | podium
let roundEndsAt  = 0;
let podiumEndsAt = 0;
let podiumData   = null;
let spawnGraceAt = 0;

const players = new Map();               // socketId -> player
let food = [];
let foodSeq = 1;

/* ------------------------------ Utilidades ------------------------------ */
const rand = (a, b) => Math.random() * (b - a) + a;

function randPointInWorld(margin = 80) {
  const ang = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * (WORLD_RADIUS - margin);
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
}

function makeFood(x, y, val) {
  return {
    id: foodSeq++,
    x: Math.round(x),
    y: Math.round(y),
    val: val || 1,
    c: Math.floor(Math.random() * 8),
  };
}

function fillFood() {
  while (food.length < TARGET_FOOD) {
    const p = randPointInWorld();
    // ~9% viram bolas grandes que valem bem mais pontos
    if (Math.random() < 0.09) food.push(makeFood(p.x, p.y, BIG_FOOD_VAL));
    else food.push(makeFood(p.x, p.y, 1));
  }
}

function snakeRadius(score) {
  return Math.min(BASE_R + Math.sqrt(score) * 1.6, 60);
}
function targetLen(score) {
  return Math.min(MIN_LEN + Math.sqrt(score) * 42, MAX_POINTS * NORMAL_SPEED);
}
function maxTurn() {
  return 0.27; // rad por tick
}

/* ------------------------------- Cobras --------------------------------- */
function spawnSnake(p) {
  const start = randPointInWorld(300);
  const angle = Math.random() * Math.PI * 2;
  const pts = [];
  const steps = Math.ceil(MIN_LEN / NORMAL_SPEED);
  for (let i = 0; i < steps; i++) {
    pts.push({
      x: start.x - Math.cos(angle) * NORMAL_SPEED * i,
      y: start.y - Math.sin(angle) * NORMAL_SPEED * i,
    });
  }
  p.snake = { pts, angle, target: angle, boosting: false, minX:0,minY:0,maxX:0,maxY:0 };
  p.alive = true;
  p.spectating = false;
}

function stepSnake(p) {
  const s = p.snake;

  // virar suavemente em direcao ao alvo
  let diff = s.target - s.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const mt = maxTurn();
  if (diff > mt) diff = mt; else if (diff < -mt) diff = -mt;
  s.angle += diff;

  // velocidade / boost
  let speed = NORMAL_SPEED;
  if (s.boosting && p.score > BOOST_MIN) {
    speed = BOOST_SPEED;
    p.score = Math.max(0, p.score - 0.4);
    if (Math.random() < 0.5) {
      const tail = s.pts[s.pts.length - 1];
      food.push(makeFood(tail.x + rand(-6, 6), tail.y + rand(-6, 6), 1));
    }
  } else {
    s.boosting = false;
  }

  // nova cabeca
  const head = s.pts[0];
  s.pts.unshift({ x: head.x + Math.cos(s.angle) * speed, y: head.y + Math.sin(s.angle) * speed });

  // cortar cauda ate o comprimento alvo
  const tl = targetLen(p.score);
  let acc = 0, i = 1;
  for (; i < s.pts.length; i++) {
    acc += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
    if (acc >= tl) { i++; break; }
  }
  if (i < s.pts.length) s.pts.length = i;
  if (s.pts.length > MAX_POINTS) s.pts.length = MAX_POINTS;

  // bounding box (broad-phase)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of s.pts) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  s.minX = minX; s.minY = minY; s.maxX = maxX; s.maxY = maxY;
}

function eatFood(p) {
  const s = p.snake;
  const head = s.pts[0];
  const r = snakeRadius(p.score) + 12;
  const r2 = r * r;
  for (let i = food.length - 1; i >= 0; i--) {
    const f = food[i];
    const dx = f.x - head.x, dy = f.y - head.y;
    if (dx * dx + dy * dy < r2) {
      p.score += f.val;
      food[i] = food[food.length - 1];
      food.pop();
    }
  }
}

function killSnake(p) {
  const s = p.snake;
  if (s) {
    const step = 3;
    const orbs = Math.max(1, Math.floor(s.pts.length / step));
    // distribui o score (com bonus) em varias bolas grandes e valiosas
    const per = Math.max(4, Math.round((p.score * 1.25) / orbs));
    for (let i = 0; i < s.pts.length; i += step) {
      const pt = s.pts[i];
      food.push(makeFood(pt.x + rand(-16, 16), pt.y + rand(-16, 16), per));
    }
  }
  p.snake = null;
  p.alive = false;
  p.spectating = true;
  io.to(p.id).emit('died');
}

function checkCollisions() {
  const alive = [];
  for (const p of players.values()) if (p.alive && p.snake) alive.push(p);

  const deaths = [];
  for (const a of alive) {
    const head = a.snake.pts[0];

    // limite da arena
    if (Math.hypot(head.x, head.y) > WORLD_RADIUS) { deaths.push(a); continue; }

    for (const b of alive) {
      if (b === a) continue;
      const br = snakeRadius(b.score);
      const bs = b.snake;
      if (head.x < bs.minX - br || head.x > bs.maxX + br ||
          head.y < bs.minY - br || head.y > bs.maxY + br) continue;
      const lethal2 = (br + 2) * (br + 2);
      const pts = bs.pts;
      let hit = false;
      for (let i = 2; i < pts.length; i++) {
        const dx = pts[i].x - head.x, dy = pts[i].y - head.y;
        if (dx * dx + dy * dy < lethal2) { hit = true; break; }
      }
      if (hit) { deaths.push(a); break; }
    }
  }
  for (const a of deaths) killSnake(a);
}

/* --------------------------- Ranking / placar --------------------------- */
function rankedPlayers() {
  return [...players.values()].sort((a, b) => b.score - a.score);
}

function broadcastState() {
  const ranked = rankedPlayers();
  const rankIndex = new Map();
  ranked.forEach((p, i) => rankIndex.set(p.id, i + 1));
  const top = ranked.slice(0, 10).map(p => ({
    nick: p.nick, score: Math.round(p.score), alive: p.alive, habbo: p.habbo,
  }));
  const leader = ranked.find(p => p.alive && p.snake) || ranked[0];

  for (const p of players.values()) {
    const sock = io.sockets.sockets.get(p.id);
    if (!sock) continue;

    let camX = 0, camY = 0;
    if (p.alive && p.snake) { camX = p.snake.pts[0].x; camY = p.snake.pts[0].y; }
    else if (leader && leader.snake) { camX = leader.snake.pts[0].x; camY = leader.snake.pts[0].y; }

    const vx0 = camX - VIEW_RADIUS, vx1 = camX + VIEW_RADIUS;
    const vy0 = camY - VIEW_RADIUS, vy1 = camY + VIEW_RADIUS;

    const snakes = [];
    for (const q of players.values()) {
      if (!q.alive || !q.snake) continue;
      const s = q.snake;
      if (s.maxX < vx0 || s.minX > vx1 || s.maxY < vy0 || s.minY > vy1) continue;
      const arr = new Array(s.pts.length * 2);
      for (let i = 0; i < s.pts.length; i++) {
        arr[i * 2] = Math.round(s.pts[i].x);
        arr[i * 2 + 1] = Math.round(s.pts[i].y);
      }
      snakes.push({
        id: q.id, nick: q.nick, skin: q.skin,
        r: Math.round(snakeRadius(q.score)), b: s.boosting ? 1 : 0,
        me: q.id === p.id ? 1 : 0, pts: arr,
      });
    }

    const vf = [];
    for (const f of food) {
      if (f.x < vx0 || f.x > vx1 || f.y < vy0 || f.y > vy1) continue;
      vf.push(f.x, f.y, f.c, f.val > 1 ? 1 : 0);
    }

    sock.emit('s', {
      me: {
        alive: p.alive, spectating: p.spectating, score: Math.round(p.score),
        rank: rankIndex.get(p.id) || 0, total: players.size,
        x: Math.round(camX), y: Math.round(camY),
        spectName: (!p.alive && leader && leader.snake) ? leader.nick : null,
      },
      snakes, food: vf, lb: top, worldR: WORLD_RADIUS,
      tLeft: Math.max(0, roundEndsAt - Date.now()),
    });
  }
}

function broadcastLobby() {
  const list = [...players.values()].map(p => ({
    id: p.id, nick: p.nick, habbo: p.habbo, skin: p.skin, host: p.host,
  }));
  io.emit('lobby', { players: list, phase, count: players.size, max: MAX_PLAYERS });
}

/* ----------------------------- Fases da sala ---------------------------- */
function startRound() {
  phase = 'playing';
  roundEndsAt = Date.now() + ROUND_MS;
  spawnGraceAt = Date.now() + 1500;
  food = [];
  fillFood();
  for (const p of players.values()) { p.score = 0; spawnSnake(p); }
  io.emit('phase', { phase, roundEndsAt });
}

function endRound() {
  phase = 'podium';
  const ranked = rankedPlayers();
  podiumData = ranked.slice(0, 3).map((p, i) => ({
    rank: i + 1, nick: p.nick, habbo: p.habbo, score: Math.round(p.score), skin: p.skin,
  }));
  podiumEndsAt = Date.now() + PODIUM_MS;
  io.emit('podium', { podium: podiumData, endsAt: podiumEndsAt });
}

function toLobby() {
  phase = 'lobby';
  for (const p of players.values()) { p.snake = null; p.alive = false; p.spectating = false; p.score = 0; }
  food = [];
  io.emit('phase', { phase });
  broadcastLobby();
}

/* ------------------------------- Game loop ------------------------------ */
function loop() {
  const now = Date.now();
  if (phase === 'playing') {
    for (const p of players.values()) if (p.alive && p.snake) stepSnake(p);
    for (const p of players.values()) if (p.alive && p.snake) eatFood(p);
    checkCollisions();
    fillFood();
    if (food.length > TARGET_FOOD * 3) food.splice(0, food.length - TARGET_FOOD * 3);

    const someoneAlive = [...players.values()].some(p => p.alive && p.snake);
    if (now >= roundEndsAt) { endRound(); return; }
    if (!someoneAlive && players.size > 0 && now > spawnGraceAt) { endRound(); return; }
    broadcastState();
  } else if (phase === 'podium') {
    if (now >= podiumEndsAt) toLobby();
  }
}
setInterval(loop, TICK_MS);

/* ------------------------------- Conexoes ------------------------------- */
io.on('connection', (socket) => {
  socket.on('join', (data) => {
    if (players.size >= MAX_PLAYERS) { socket.emit('full'); return; }
    data = data || {};
    const nick = (String(data.nick || 'Treinador').trim().slice(0, 16)) || 'Treinador';
    const habbo = String(data.habbo || '').trim().slice(0, 30);
    let skin = parseInt(data.skin, 10);
    if (isNaN(skin) || skin < 0 || skin >= SKIN_COUNT) skin = 0;
    const isHost = players.size === 0;

    players.set(socket.id, {
      id: socket.id, nick, habbo, skin, host: isHost,
      score: 0, alive: false, spectating: false, snake: null,
    });

    socket.emit('joined', { id: socket.id, host: isHost, phase, skinCount: SKIN_COUNT, roundEndsAt });

    if (phase === 'playing') {
      const p = players.get(socket.id);
      p.score = 0; spawnSnake(p);
      socket.emit('phase', { phase, roundEndsAt });
    } else if (phase === 'podium') {
      socket.emit('podium', { podium: podiumData, endsAt: podiumEndsAt });
    }
    broadcastLobby();
  });

  socket.on('setSkin', (skin) => {
    const p = players.get(socket.id);
    if (!p) return;
    let s = parseInt(skin, 10);
    if (!isNaN(s) && s >= 0 && s < SKIN_COUNT) { p.skin = s; broadcastLobby(); }
  });

  socket.on('start', () => {
    const p = players.get(socket.id);
    if (p && p.host && phase === 'lobby' && players.size > 0) startRound();
  });

  socket.on('input', (d) => {
    const p = players.get(socket.id);
    if (p && p.alive && p.snake && d) {
      if (typeof d.a === 'number') p.snake.target = d.a;
      p.snake.boosting = !!d.b;
    }
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    if (!p) return;
    const wasHost = p.host;
    players.delete(socket.id);
    if (wasHost) {
      const next = players.values().next().value;
      if (next) next.host = true;
    }
    if (players.size === 0) { phase = 'lobby'; food = []; podiumData = null; }
    broadcastLobby();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('🐍 Treinaconda rodando na porta ' + PORT));
