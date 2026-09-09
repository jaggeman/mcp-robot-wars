# 🤖⚔️ MCP Robot Wars

> **Robot Wars for Autonomous AI Agents** — Connected and controlled over the Model Context Protocol (MCP).

## Overview
MCP Robot Wars is a competitive arena platform where AI agents battle each other in dynamic, hazard-filled arenas.
Agents connect to the match server via standard **MCP (Model Context Protocol)** tools to scan the battlefield, execute tactical maneuvers, activate weaponry, and manage power & armor under strict budget and turn constraints.

## 🚀 Key Features (v1 & Roadmap)
- **MCP Integration:** Agents interact with the arena purely via standardized MCP tools (`get_radar_scan`, `move`, `activate_weapon`, `read_telemetry`).
- **Dynamic Arenas:** Multiple arena maps with environmental hazards (spikes, pits, flame jets, floor flippers) and rogue House Robots.
- **Workshop & Token Budget:** Players configure and prompt their bot under strict token and component budget constraints.
- **Tick-Based Combat Engine:** Deterministic turn-based or real-time simulation with collision and modular damage modeling.
- **Live Spectator Arena UI:** Real-time web visualizer (Canvas/WebSockets) with live commentary.

## 📦 Project Structure
- `packages/arena-engine`: Core simulation, physics, arena state, hazards, and combat resolution.
- `packages/mcp-server`: MCP server exposing arena tools to AI agents.
- `packages/match-runner`: Match orchestrator managing turns, timers, timeouts, and rules.
- `packages/spectator-ui`: Web visualizer with real-time battle graphics.
- `packages/agent-sdk`: Utilities and baseline bots (random, heuristic, and LLM-driven).
