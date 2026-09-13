// Ad-hoc test client: spawns the MCP server over stdio and calls a single
// tool, printing the raw result. Usage:
//   npx tsx scripts/test-client.ts <tool_name> ['<json_args>']
//   npx tsx scripts/test-client.ts --list
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const [, , toolName, argsJson] = process.argv;

  if (!toolName) {
    console.error("Usage: (from mcp-server/) npx tsx scripts/test-client.ts <tool_name> ['<json_args>']  |  --list");
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/index.ts"],
  });

  const client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(transport);

  if (toolName === "--list") {
    const { tools } = await client.listTools();
    console.log(tools.map((t) => `${t.name} — ${t.description}`).join("\n"));
  } else {
    const args = argsJson ? JSON.parse(argsJson) : {};
    const result = await client.callTool({ name: toolName, arguments: args });
    console.log(JSON.stringify(result, null, 2));
  }

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
