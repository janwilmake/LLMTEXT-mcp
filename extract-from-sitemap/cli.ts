#!/usr/bin/env bun
/// <reference types="@types/bun" />
/// <reference lib="esnext" />

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
} from "fs";
import { join, dirname, resolve } from "path";
import { extractFromSitemap } from "./mod.js";

interface Config {
  outDir: string;
  origins: string[];
  customUrls: Array<{
    title: string;
    description: string;
    url: string;
  }>;
  keepOriginalUrls: boolean;
  forceExtract: boolean;
}

interface Manifest {
  files: string[];
  timestamp: string;
}

class OAuth {
  private clientId: string;
  private redirectUri: string;
  private scope: string;

  constructor() {
    this.clientId = "extract-from-sitemap-cli";
    this.redirectUri = "http://localhost:3737/callback";
    this.scope = "key:read";
  }

  async getApiKey(): Promise<string> {
    console.log("🔐 Starting OAuth flow...");

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = await this.generatePKCE();

    // Build authorization URL
    const authUrl = new URL("https://platform.parallel.ai/getKeys/authorize");
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("redirect_uri", this.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", this.scope);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", Math.random().toString(36));

    console.log(`\n📖 Please visit this URL to authorize the application:`);
    console.log(`${authUrl.toString()}\n`);

    // Start simple HTTP server to catch the callback
    const code = await this.startCallbackServer();

    // Exchange code for token
    console.log("🔄 Exchanging authorization code for API key...");

    const response = await fetch("https://platform.parallel.ai/getKeys/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText}`
      );
    }

    const { access_token } = await response.json();
    console.log("✅ Successfully obtained API key!");

    return access_token;
  }

  private async generatePKCE(): Promise<{
    codeVerifier: string;
    codeChallenge: string;
  }> {
    const codeVerifier = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
    ).replace(/[+/=]/g, (m) => ({ "+": "-", "/": "_", "=": "" }[m]));

    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier)
    );
    const codeChallenge = btoa(
      String.fromCharCode(...new Uint8Array(hash))
    ).replace(/[+/=]/g, (m) => ({ "+": "-", "/": "_", "=": "" }[m]));

    return { codeVerifier, codeChallenge };
  }

  private async startCallbackServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = Bun.serve({
        port: 3737,
        fetch(req) {
          const url = new URL(req.url);

          if (url.pathname === "/callback") {
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");

            if (error) {
              reject(new Error(`OAuth error: ${error}`));
              return new Response(
                "Error occurred. You can close this window.",
                { status: 400 }
              );
            }

            if (code) {
              resolve(code);
              server.stop();
              return new Response(
                "✅ Authorization successful! You can close this window and return to the terminal."
              );
            }
          }

          return new Response("Invalid request", { status: 404 });
        },
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.stop();
        reject(new Error("OAuth flow timed out"));
      }, 300000);
    });
  }
}

async function loadConfig(): Promise<Config> {
  const configPath = resolve("llmtext.json");

  if (!existsSync(configPath)) {
    console.error(
      "❌ llmtext.json not found. Please create a configuration file."
    );
    console.log("\nExample llmtext.json:");
    console.log(
      JSON.stringify(
        {
          outDir: "./docs",
          origins: ["https://docs.example.com"],
          customUrls: [],
          keepOriginalUrls: false,
          forceExtract: false,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as Config;

    // Validate required fields
    if (!config.outDir) throw new Error("outDir is required");
    if (!Array.isArray(config.origins))
      throw new Error("origins must be an array");

    // Set defaults
    config.customUrls = config.customUrls || [];
    config.keepOriginalUrls = config.keepOriginalUrls ?? false;
    config.forceExtract = config.forceExtract ?? false;

    return config;
  } catch (error) {
    console.error("❌ Error reading llmtext.json:", error.message);
    process.exit(1);
  }
}

async function getApiKey(): Promise<string> {
  // Check environment variables first
  let apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey && existsSync(".env")) {
    // Try to load from .env file
    const envContent = readFileSync(".env", "utf8");
    const match = envContent.match(/^PARALLEL_API_KEY=(.+)$/m);
    if (match) {
      apiKey = match[1].trim();
    }
  }

  if (!apiKey) {
    console.log("🔑 No API key found in environment or .env file.");
    const oauth = new OAuth();
    apiKey = await oauth.getApiKey();
  }

  return apiKey;
}

function loadManifest(outDir: string): Manifest {
  const manifestPath = join(outDir, "llmtext-manifest.json");

  if (!existsSync(manifestPath)) {
    return { files: [], timestamp: new Date().toISOString() };
  }

  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { files: [], timestamp: new Date().toISOString() };
  }
}

function saveManifest(outDir: string, manifest: Manifest): void {
  const manifestPath = join(outDir, "llmtext-manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function cleanupOldFiles(
  outDir: string,
  currentFiles: string[],
  previousFiles: string[]
): void {
  const filesToRemove = previousFiles.filter(
    (file) => !currentFiles.includes(file)
  );

  for (const file of filesToRemove) {
    const filePath = join(outDir, file);
    try {
      if (existsSync(filePath)) {
        rmSync(filePath);
        console.log(`🗑️  Removed old file: ${file}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not remove ${file}:`, error.message);
    }
  }
}

async function processCustomUrls(
  customUrls: Array<{ title: string; description: string; url: string }>,
  apiKey: string,
  forceExtract: boolean
): Promise<Record<string, any>> {
  const files: Record<string, any> = {};

  for (const customUrl of customUrls) {
    console.log(`📄 Processing custom URL: ${customUrl.url}`);

    try {
      // For custom URLs, we need to extract them individually
      const response = await fetch("https://api.parallel.ai/v1beta/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "parallel-beta": "search-extract-2025-10-10",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          urls: [customUrl.url],
          full_content: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.results && result.results.length > 0) {
          const extracted = result.results[0];
          const filename =
            customUrl.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() + ".md";

          files[filename] = {
            content: extracted.full_content || "",
            title: customUrl.title,
            description: customUrl.description,
            extracted: true,
            publishedDate: extracted.published_date || "",
            status: 200,
            tokens: Math.round((extracted.full_content || "").length / 5),
          };
        }
      }
    } catch (error) {
      console.error(
        `❌ Error processing custom URL ${customUrl.url}:`,
        error.message
      );
    }
  }

  return files;
}

async function main() {
  console.log("🚀 Extract from Sitemap CLI");

  try {
    const config = await loadConfig();
    const apiKey = await getApiKey();

    // Ensure output directory exists
    mkdirSync(config.outDir, { recursive: true });

    // Load previous manifest
    const previousManifest = loadManifest(config.outDir);
    const currentFiles: string[] = [];

    let totalTokens = 0;
    let totalPages = 0;
    let totalErrors = 0;

    // Process each origin
    for (const origin of config.origins) {
      console.log(`\n🌐 Processing origin: ${origin}`);

      try {
        const result = await extractFromSitemap(
          origin,
          config.forceExtract,
          apiKey
        );

        console.log(
          `✅ Extracted ${result.totalPages} pages with ${result.totalTokens} tokens`
        );
        if (result.errors > 0) {
          console.log(`⚠️  ${result.errors} errors occurred`);
        }

        // Write files to disk
        for (const [path, file] of Object.entries(result.files)) {
          let filename = path;

          if (!config.keepOriginalUrls) {
            // Create domain-specific subdirectory
            const domain = new URL(
              origin.startsWith("http") ? origin : `https://${origin}`
            ).hostname;
            const domainDir = join(config.outDir, domain);
            mkdirSync(domainDir, { recursive: true });
            filename = join(
              domain,
              path.startsWith("/") ? path.slice(1) : path
            );
          } else {
            filename = path.startsWith("/") ? path.slice(1) : path;
          }

          const filePath = join(config.outDir, filename);
          const fileDir = dirname(filePath);

          mkdirSync(fileDir, { recursive: true });
          writeFileSync(filePath, file.content);
          currentFiles.push(filename);

          console.log(`📝 Wrote: ${filename} (${file.tokens} tokens)`);
        }

        totalTokens += result.totalTokens;
        totalPages += result.totalPages;
        totalErrors += result.errors;
      } catch (error) {
        console.error(`❌ Error processing ${origin}:`, error.message);
        totalErrors++;
      }
    }

    // Process custom URLs
    if (config.customUrls.length > 0) {
      console.log(`\n📋 Processing ${config.customUrls.length} custom URLs...`);
      const customFiles = await processCustomUrls(
        config.customUrls,
        apiKey,
        config.forceExtract
      );

      for (const [filename, file] of Object.entries(customFiles)) {
        const filePath = join(config.outDir, filename);
        writeFileSync(filePath, file.content);
        currentFiles.push(filename);
        totalTokens += file.tokens;
        totalPages++;

        console.log(`📝 Wrote: ${filename} (${file.tokens} tokens)`);
      }
    }

    // Clean up old files
    if (previousManifest.files.length > 0) {
      cleanupOldFiles(config.outDir, currentFiles, previousManifest.files);
    }

    // Save new manifest
    const newManifest: Manifest = {
      files: currentFiles,
      timestamp: new Date().toISOString(),
    };
    saveManifest(config.outDir, newManifest);

    console.log(`\n✨ Extraction completed!`);
    console.log(`📊 Total: ${totalPages} pages, ${totalTokens} tokens`);
    if (totalErrors > 0) {
      console.log(`⚠️  Errors: ${totalErrors}`);
    }
    console.log(`📁 Output directory: ${resolve(config.outDir)}`);
  } catch (error) {
    console.error("💥 Fatal error:", error.message);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
