import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { MatchRunner } from '../runner/match.js';
import { HeuristicBot } from '../bots/heuristic-bot.js';
import { createDefaultArena } from '../engine/arena.js';
import { ArenaState, GameEvent } from '../engine/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../ui')));

let currentRunner: MatchRunner | null = null;

function broadcast(type: string, data: unknown) {
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function startNewMatch(bot1Type = 'aggressive', bot2Type = 'tactical', width = 12, height = 12) {
  if (currentRunner) {
    currentRunner.stop();
  }

  const bot1 = new HeuristicBot('bot-1', 'HYPNO-DISC', bot1Type as any);
  const bot2 = new HeuristicBot('bot-2', 'CHAOS-2', bot2Type as any);

  const arenaConfig = createDefaultArena(width, height, 30);

  currentRunner = new MatchRunner([bot1, bot2], {
    config: arenaConfig,
    turnTimeoutMs: 3000,
    delayBetweenTurnsMs: 500,
    onTurnComplete: (state: ArenaState, newEvents: GameEvent[]) => {
      broadcast('turn_update', { state, newEvents });
    },
    onMatchEnd: (state: ArenaState) => {
      broadcast('match_end', { state });
    },
  });

  broadcast('match_init', { state: currentRunner.getState() });
  return currentRunner;
}

// REST API
app.get('/api/matches/current', (req, res) => {
  if (!currentRunner) {
    startNewMatch();
  }
  res.json({ state: currentRunner!.getState() });
});

app.post('/api/matches/start', (req, res) => {
  const { bot1Strategy, bot2Strategy, width, height } = req.body || {};
  const runner = startNewMatch(bot1Strategy || 'aggressive', bot2Strategy || 'tactical', width || 12, height || 12);
  runner.run();
  res.json({ success: true, message: 'Match started', state: runner.getState() });
});

app.post('/api/matches/step', async (req, res) => {
  if (!currentRunner) {
    startNewMatch();
  }
  const state = await currentRunner!.step();
  res.json({ success: true, state });
});

app.post('/api/matches/pause', (req, res) => {
  if (currentRunner) currentRunner.pause();
  res.json({ success: true });
});

app.post('/api/matches/resume', (req, res) => {
  if (currentRunner) currentRunner.resume();
  res.json({ success: true });
});

wss.on('connection', (ws) => {
  console.log('[WebSocket] Spectator connected');
  if (currentRunner) {
    ws.send(JSON.stringify({ type: 'match_init', data: { state: currentRunner.getState() } }));
  } else {
    const runner = startNewMatch();
    ws.send(JSON.stringify({ type: 'match_init', data: { state: runner.getState() } }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🤖⚔️  MCP ROBOT WARS ARENA SERVER IS LIVE!`);
  console.log(`📡  Spectator Arena UI: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
