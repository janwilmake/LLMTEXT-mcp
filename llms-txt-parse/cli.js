#!/usr/bin/env node
//@ts-check

import { parseLlmsTxt } from "./mod.js";

/**
 * CLI main function - handles command line arguments and file/URL processing
 *
 * Usage:
 * - node cli.js <file-path>
 * - node cli.js <url>
 * - bun cli.js <file-or-url>
 *
 * @returns {Promise<void>}
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node cli.js <file-or-url>");
    console.error("");
    console.error("Examples:");
    console.error("  node cli.js llms.txt");
    console.error("  node cli.js https://docs.parallel.ai/llms.txt");
    process.exit(1);
  }

  const input = args[0];
  let content;

  try {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      // Fetch from URL
      const response = await fetch(input);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      content = await response.text();
    } else {
      // Node.js/Bun runtime
      const fs = await import("fs/promises");
      content = await fs.readFile(input, "utf-8");
    }

    const parsed = parseLlmsTxt(content);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
