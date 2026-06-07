import { logger } from '../utils/logger.js';
import { startMcpServer } from '../mcp/server.js';

export async function serveCommand() {
  logger.debug('Starting DevAssets MCP server (stdio)');
  await startMcpServer();
}
