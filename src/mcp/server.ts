import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ArenaToolContext, createArenaTools } from './tools.js';

export function createBotMcpServer(botId: string, botName: string, context: ArenaToolContext) {
  const server = new Server(
    {
      name: `mcp-robot-wars-${botId}`,
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools = createArenaTools(botId, context);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find(t => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    return await tool.handler(request.params.arguments ?? {});
  });

  return server;
}
