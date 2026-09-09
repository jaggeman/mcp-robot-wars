import { MatchRunner } from './runner/match.js';
import { HeuristicBot } from './bots/heuristic-bot.js';
import { createDefaultArena } from './engine/arena.js';

async function main() {
  console.log('========================================================');
  console.log('🤖⚔️  MCP ROBOT WARS - TERMINAL BATTLE ARENA');
  console.log('========================================================\n');

  const bot1 = new HeuristicBot('bot-1', 'HYPNO-DISC', 'aggressive');
  const bot2 = new HeuristicBot('bot-2', 'CHAOS-2', 'tactical');

  const arenaConfig = createDefaultArena(10, 10, 25);
  const runner = new MatchRunner([bot1, bot2], {
    config: arenaConfig,
    turnTimeoutMs: 2000,
    delayBetweenTurnsMs: 300,
    onTurnComplete: (state, newEvents) => {
      console.log(`\n--- [TURN ${state.turn - 1}/${state.maxTurns}] ---`);
      newEvents.forEach(evt => {
        console.log(`  ${evt.description}`);
      });
      const b1 = state.bots['bot-1'];
      const b2 = state.bots['bot-2'];
      console.log(`  📊 HP: ${b1.name} [${b1.hp}/${b1.maxHp}] | ${b2.name} [${b2.hp}/${b2.maxHp}]`);
    },
    onMatchEnd: (state) => {
      console.log('\n========================================================');
      const winner = state.winnerId ? state.bots[state.winnerId].name : 'NOBODY (DRAW)';
      console.log(`🏆 MATCH FINISHED! Champion: ${winner}`);
      console.log(`   End Reason: ${state.endReason}`);
      console.log('========================================================\n');
    },
  });

  await runner.run();
}

main().catch(console.error);
