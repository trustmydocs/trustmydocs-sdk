#!/usr/bin/env node
/**
 * trustmydocs-mcp: stdio MCP server.
 *
 *   TRUSTMYDOCS_API_KEY=tmd_live_... npx -y trustmydocs mcp
 *
 * The key may also come from "trustmydocs login" (stored config file).
 * Without a key the server still starts; every tool then explains how to get one.
 */

import { resolveApiKey, resolveBaseUrl } from './config.js';
import { startMcpServer } from './mcp-server.js';
import { resolveLang } from './wording.js';

await startMcpServer({ apiKey: resolveApiKey().apiKey, baseUrl: resolveBaseUrl(), lang: resolveLang() });
