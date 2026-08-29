import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "caltrack",
  version: "0.1.0",
});

server.registerTool(
  "ping",
  {
    title: "Ping",
    description: "A test tool that echoes back a message, to confirm the server is wired up correctly.",
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({
    content: [{ type: "text", text: `pong: ${message}` }],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();