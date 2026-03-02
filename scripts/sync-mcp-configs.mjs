import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const registryPath = path.join(root, "mcp", "registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));

const inputs = Array.isArray(registry.inputs) ? registry.inputs : [];
const servers = registry.servers ?? {};
const mappings = registry.clientMappings ?? {};

const copilotConfig = {
  inputs,
  servers,
};

const claudeConfig = {
  mcpServers: servers,
};

const codexConfig = {
  mcpServers: servers,
};

const clientPayload = {
  copilot: copilotConfig,
  claude: claudeConfig,
  codex: codexConfig,
};

for (const [client, mapping] of Object.entries(mappings)) {
  const output = mapping?.output;
  if (!output || !(client in clientPayload)) continue;

  const outPath = path.join(root, output);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(clientPayload[client], null, 2)}\n`, "utf8");
  console.log(`[mcp] wrote ${output}`);
}
