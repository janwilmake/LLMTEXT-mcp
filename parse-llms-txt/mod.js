#!/usr/bin/env node
//@ts-check
/// <reference types="@types/node" />

/**
 * @fileoverview Parser for llms.txt files following the llmstxt.org specification
 * @author Your Name
 * @version 1.0.0
 * @license MIT
 */

/**
 * Represents a single file entry in an llms.txt section
 * @typedef {Object} FileEntry
 * @property {string} name - The display name of the file/link
 * @property {string} url - The URL to the resource
 * @property {string} [notes] - Optional notes describing the file
 */

/**
 * Represents a section in an llms.txt file (H2 header with file list)
 * @typedef {Object} Section
 * @property {string} name - The section name (from H2 header)
 * @property {FileEntry[]} files - Array of file entries in this section
 */

/**
 * Represents the complete parsed structure of an llms.txt file
 * @typedef {Object} LlmsTxtFile
 * @property {string} title - The project title (from H1 header)
 * @property {string} [description] - Optional description (from blockquote)
 * @property {string} [details] - Optional details (content before first H2)
 * @property {Section[]} sections - Array of sections with their file lists
 */

/**
 * Parses an llms.txt markdown file according to the llmstxt.org specification
 *
 * The spec defines this structure:
 * - H1 with project/site name (required)
 * - Blockquote with short summary (optional)
 * - Zero or more sections of details before first H2 (optional)
 * - Zero or more H2 sections containing file lists (optional)
 *
 * @param {string} markdown - The raw markdown content of the llms.txt file
 * @returns {LlmsTxtFile} Parsed structure containing title, description, details, and sections
 *
 * @example
 * const content = await fetch('/llms.txt').then(r => r.text());
 * const parsed = parseLlmsTxt(content);
 * console.log(parsed.title); // "My Project"
 * console.log(parsed.sections[0].files[0].url); // "https://example.com/doc.md"
 */
export function parseLlmsTxt(markdown) {
  const lines = markdown.split("\n");

  /** @type {LlmsTxtFile} */
  const result = {
    title: "",
    sections: [],
  };

  /** @type {Section | null} */
  let currentSection = null;

  /** @type {string[]} */
  let detailsParts = [];

  let foundFirstH2 = false;
  let inBlockquote = false;

  /** @type {string[]} */
  let blockquoteLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // H1 - Project title (required)
    if (line.startsWith("# ")) {
      result.title = line.substring(2).trim();
      continue;
    }

    // Blockquote - Description (optional)
    if (line.startsWith("> ")) {
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteLines = [];
      }
      blockquoteLines.push(line.substring(2).trim());
      continue;
    } else if (inBlockquote && line === "") {
      // Continue blockquote on empty lines
      continue;
    } else if (inBlockquote) {
      // End of blockquote
      result.description = blockquoteLines.join(" ").trim();
      inBlockquote = false;
      blockquoteLines = [];

      // Process current line after blockquote
      if (line.startsWith("## ")) {
        foundFirstH2 = true;
        currentSection = {
          name: line.substring(3).trim(),
          files: [],
        };
        continue;
      } else if (line !== "") {
        detailsParts.push(line);
        continue;
      }
    }

    // H2 - Section headers
    if (line.startsWith("## ")) {
      foundFirstH2 = true;

      // Save previous section if exists
      if (currentSection) {
        result.sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        name: line.substring(3).trim(),
        files: [],
      };
      continue;
    }

    // Before first H2 - collect as details
    if (!foundFirstH2 && line !== "" && !line.startsWith("#")) {
      detailsParts.push(line);
      continue;
    }

    // List items under sections (file lists)
    if (currentSection && line.startsWith("- ")) {
      const fileEntry = parseListLine(line);
      if (fileEntry) {
        currentSection.files.push(fileEntry);
      }
    }
  }

  // Add the last section
  if (currentSection) {
    result.sections.push(currentSection);
  }

  // Set details if any were collected
  if (detailsParts.length > 0) {
    result.details = detailsParts.join("\n").trim();
  }

  return result;
}

/**
 * Parses a markdown list line to extract file entry information
 *
 * Expects format: "- [Name](url): Optional notes"
 * The ": Optional notes" part is optional.
 *
 * @param {string} line - The markdown list line starting with "- "
 * @returns {FileEntry | null} Parsed file entry or null if parsing fails
 *
 * @example
 * parseListLine("- [API Docs](https://api.example.com): Complete API reference")
 * // Returns: { name: "API Docs", url: "https://api.example.com", notes: "Complete API reference" }
 */
function parseListLine(line) {
  // Remove the "- " prefix
  const content = line.substring(2).trim();

  // Look for markdown link pattern: [text](url)
  const linkMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);

  if (linkMatch) {
    const name = linkMatch[1];
    const url = linkMatch[2];

    // Check for notes after the link (look for ": " pattern)
    const afterLink = content.substring(linkMatch.index + linkMatch[0].length);
    const colonMatch = afterLink.match(/:\s*(.+)/);

    /** @type {FileEntry} */
    const fileEntry = {
      name: name.trim(),
      url: url.trim(),
    };

    if (colonMatch) {
      fileEntry.notes = colonMatch[1].trim();
    }

    return fileEntry;
  }

  return null;
}

/**
 * CLI main function - handles command line arguments and file/URL processing
 *
 * Usage:
 * - node parse-llms-txt.js <file-path>
 * - node parse-llms-txt.js <url>
 * - bun parse-llms-txt.js <file-or-url>
 *
 * @returns {Promise<void>}
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node parse-llms-txt.js <file-or-url>");
    console.error("");
    console.error("Examples:");
    console.error("  node parse-llms-txt.js llms.txt");
    console.error("  node parse-llms-txt.js https://docs.parallel.ai/llms.txt");
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

// Run CLI if this file is executed directly
if (
  typeof process !== "undefined" &&
  process.argv
  // &&
  // import.meta.url === `file://${process.argv[1]}`
) {
  main();
}

// CommonJS compatibility (if needed)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseLlmsTxt, parseListLine };
}
