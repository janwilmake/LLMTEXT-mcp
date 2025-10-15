#!/usr/bin/env node

/**
 * CLI tool for generating asset manifests
 *
 * Usage: node cli.js
 *
 * This CLI tool:
 * - Takes no arguments
 * - Finds all files in the current directory and all subfolders
 * - Builds up FileData array with file contents (both text and binary)
 * - Runs getAssetManifest to generate an asset manifest
 * - Writes the resulting manifest to manifest.json (excludes _redirects and _headers)
 *
 * The tool respects .assetsignore files and wrangler.toml configuration for asset directory detection.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getAssetManifest } from "./mod.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Determines the MIME type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    // Text files
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".jsonc": "application/json",
    ".xml": "application/xml",
    ".svg": "image/svg+xml",
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".jsx": "text/javascript",

    // Images
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".ico": "image/vnd.microsoft.icon",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",

    // Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".m4a": "audio/mp4",

    // Video
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",

    // Archives
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".7z": "application/x-7z-compressed",

    // Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    // Fonts
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",

    // Other
    ".wasm": "application/wasm",
    ".toml": "text/x-toml",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Recursively finds all files in a directory
 * @param {string} dir - Directory to search
 * @param {string} baseDir - Base directory for relative paths
 * @returns {string[]} Array of file paths relative to baseDir
 */
function findAllFiles(dir, baseDir = dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...findAllFiles(fullPath, baseDir));
      } else if (entry.isFile()) {
        const relativePath = path.relative(baseDir, fullPath);
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Builds FileData array from the current directory
 * @param {string} currentDir - Current working directory
 * @returns {Array<{path: string, data: Uint8Array, contentType: string}>} FileData array
 */
function buildFileDataArray(currentDir) {
  console.log("Scanning files in:", currentDir);

  const allFiles = findAllFiles(currentDir);
  const fileDataArray = [];

  let textCount = 0;
  let binaryCount = 0;

  for (const filePath of allFiles) {
    const fullPath = path.join(currentDir, filePath);
    const normalizedPath = filePath.replace(/\\/g, "/");
    const contentType = getMimeType(filePath);

    try {
      // Read file as binary (Uint8Array)
      const buffer = fs.readFileSync(fullPath);
      const data = new Uint8Array(buffer);

      fileDataArray.push({
        path: normalizedPath,
        data: data,
        contentType: contentType,
      });

      // Count for stats
      if (
        contentType.startsWith("text/") ||
        contentType === "application/javascript" ||
        contentType === "application/json" ||
        contentType === "image/svg+xml"
      ) {
        textCount++;
      } else {
        binaryCount++;
      }
    } catch (error) {
      console.warn(
        `Warning: Could not process file ${filePath}:`,
        error.message
      );
    }
  }

  console.log(
    `\nProcessed ${textCount} text files and ${binaryCount} binary files`
  );
  return fileDataArray;
}

/**
 * Main CLI function
 */
async function main() {
  try {
    const currentDir = process.cwd();
    console.log("Asset Manifest Generator");
    console.log("========================");

    // Build FileData array from current directory
    const fileDataArray = buildFileDataArray(currentDir);

    console.log(`\nFound ${fileDataArray.length} files`);

    // Generate asset manifest
    console.log("\nGenerating asset manifest...");
    const result = await getAssetManifest(fileDataArray);

    // Write manifest to file (only the manifest, not _headers or _redirects)
    const manifestPath = path.join(currentDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2));

    console.log(`\nAsset manifest written to: ${manifestPath}`);
    console.log(
      `Manifest contains ${Object.keys(result.manifest).length} assets`
    );

    // Log additional info about special files if they exist
    if (result._headers) {
      console.log("Found _headers file in assets");
    }
    if (result._redirects) {
      console.log("Found _redirects file in assets");
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main();
