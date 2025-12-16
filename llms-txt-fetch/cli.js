#!/usr/bin/env node

import { parseLlmsTxtAndDownload } from "./lib.js";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path to ensure
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Writes files to the filesystem
 * @param {{[path: string]: string}} files - Object mapping paths to content
 * @param {string} outputDir - Base directory to write files
 */
async function writeFiles(files, outputDir) {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(outputDir, filePath);
    const dir = path.dirname(fullPath);

    await ensureDir(dir);
    await fs.writeFile(fullPath, content, "utf-8");
    console.log(`Wrote: ${filePath}`);
  }
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node cli.js <llms-txt-url> [output-directory]");
    console.error("");
    console.error("Examples:");
    console.error("  node cli.js https://docs.parallel.ai/llms.txt");
    console.error("  node cli.js https://docs.parallel.ai/llms.txt ./output");
    console.error(
      "  npx llms-txt-downloader https://www.fastht.ml/docs/llms.txt",
    );
    process.exit(1);
  }

  const llmsTxtUrl = args[0];
  const outputDir = args[1] || process.cwd();

  // Validate URL
  try {
    new URL(llmsTxtUrl);
  } catch (error) {
    console.error("Error: Invalid URL provided");
    process.exit(1);
  }

  console.error(`Output directory: ${outputDir}`);
  console.error("");

  try {
    // Parse and download all files
    const files = await parseLlmsTxtAndDownload(llmsTxtUrl);

    console.error("");
    console.error("Writing files to disk...");

    // Write files to filesystem
    await writeFiles(files, outputDir);

    console.error("");
    console.error(
      `✓ Successfully downloaded ${
        Object.keys(files).length
      } files to ${outputDir}`,
    );
  } catch (error) {
    console.error("");
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
