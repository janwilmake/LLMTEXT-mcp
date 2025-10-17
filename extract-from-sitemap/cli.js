#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");
const http = require("http");
const { URL, URLSearchParams } = require("url");
const os = require("os");
const { extractFromSitemap } = require("./mod.js");

/**
 * @typedef {Object} OriginConfig
 * @property {string} origin - The origin URL to process
 * @property {boolean} forceExtract - Whether to force extraction for this origin
 */

/**
 * @typedef {Object} Config
 * @property {string} outDir - Output directory for extracted files
 * @property {OriginConfig[]} origins - Array of origin configurations
 * @property {Array<{title: string, description: string, url: string}>} customUrls - Custom URLs to extract
 * @property {boolean} keepOriginalUrls - Whether to keep original URL structure
 */

/**
 * @typedef {Object} Manifest
 * @property {string[]} files - List of generated files
 * @property {string} timestamp - Timestamp of last generation
 */

const CREDENTIALS_DIR = path.join(os.homedir(), ".llmtext");
const API_KEY_FILE = path.join(CREDENTIALS_DIR, "api-key");

/**
 * OAuth handler for Parallel.ai API key authentication
 */
class OAuth {
  constructor() {
    this.clientId = "extract-from-sitemap-cli";
    this.redirectUri = "http://localhost:3737/callback";
    this.scope = "key:read";
    this.server = null;
  }

  /**
   * Get API key through OAuth flow
   * @returns {Promise<string>} The API key
   */
  async getApiKey() {
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

    console.log("\n📖 Opening browser for authorization...");

    // Open browser automatically
    await this.openBrowser(authUrl.toString());

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

  /**
   * Open browser to authorization URL
   * @param {string} url - The authorization URL
   */
  async openBrowser(url) {
    try {
      const platform = process.platform;
      let command, args;

      if (platform === "darwin") {
        command = "open";
        args = [url];
      } else if (platform === "win32") {
        command = "start";
        args = ["", url];
      } else {
        // Linux/Unix
        command = "xdg-open";
        args = [url];
      }

      spawn(command, args, { detached: true, stdio: "ignore" });
    } catch (error) {
      console.log("\n📖 Please visit this URL to authorize the application:");
      console.log(`${url}\n`);
    }
  }

  /**
   * Generate PKCE code verifier and challenge
   * @returns {Promise<{codeVerifier: string, codeChallenge: string}>}
   */
  async generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const hash = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    return {
      codeVerifier,
      codeChallenge: hash,
    };
  }

  /**
   * Start HTTP server to catch OAuth callback
   * @returns {Promise<string>} The authorization code
   */
  async startCallbackServer() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const error = url.searchParams.get("error");

          if (error) {
            reject(new Error(`OAuth error: ${error}`));
            res.writeHead(400);
            res.end("Error occurred. You can close this window.");
            return;
          }

          if (code) {
            resolve(code);
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
              "✅ Authorization successful! You can close this window and return to the terminal."
            );
            return;
          }
        }

        res.writeHead(404);
        res.end("Invalid request");
      });

      this.server.listen(3737);

      // Timeout after 5 minutes
      setTimeout(() => {
        this.stopServer();
        reject(new Error("OAuth flow timed out"));
      }, 300000);
    }).finally(() => {
      this.stopServer();
    });
  }

  /**
   * Stop the callback server
   */
  stopServer() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

/**
 * Load configuration from llmtext.json
 * @returns {Promise<Config>} The configuration object
 */
async function loadConfig() {
  const configPath = path.resolve("llmtext.json");

  if (!fs.existsSync(configPath)) {
    console.error(
      "❌ llmtext.json not found. Please create a configuration file."
    );
    console.log("\nExample llmtext.json:");
    console.log(
      JSON.stringify(
        {
          $schema: "https://extract.llmtext.com/llmtext.schema.json",
          outDir: "./docs",
          origins: [
            { origin: "https://docs.parallel.ai", forceExtract: false },
            { origin: "https://parallel.ai", forceExtract: true },
          ],
          customUrls: [],
          keepOriginalUrls: false,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    // Validate required fields
    if (!config.outDir) throw new Error("outDir is required");
    if (!Array.isArray(config.origins))
      throw new Error("origins must be an array");

    // Validate origin objects
    for (const [index, originConfig] of config.origins.entries()) {
      if (typeof originConfig !== "object" || originConfig === null) {
        throw new Error(`origins[${index}] must be an object`);
      }
      if (!originConfig.origin) {
        throw new Error(`origins[${index}].origin is required`);
      }
      if (typeof originConfig.forceExtract !== "boolean") {
        throw new Error(`origins[${index}].forceExtract must be a boolean`);
      }
    }

    // Set defaults
    config.customUrls = config.customUrls || [];
    config.keepOriginalUrls = config.keepOriginalUrls ?? false;

    return config;
  } catch (error) {
    console.error("❌ Error reading llmtext.json:", error.message);
    process.exit(1);
  }
}

/**
 * Store API key in ~/.llmtext/api-key
 * @param {string} apiKey - The API key to store
 */
function storeApiKey(apiKey) {
  try {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
    fs.writeFileSync(API_KEY_FILE, apiKey, { mode: 0o600 }); // Only owner can read
    console.log("💾 API key stored securely in ~/.llmtext/api-key");
  } catch (error) {
    console.warn("⚠️  Could not store API key:", error.message);
  }
}

/**
 * Load API key from ~/.llmtext/api-key
 * @returns {string|null} The stored API key or null if not found
 */
function loadStoredApiKey() {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      const apiKey = fs.readFileSync(API_KEY_FILE, "utf8").trim();
      if (apiKey) {
        console.log("🔑 Using stored API key from ~/.llmtext/api-key");
        return apiKey;
      }
    }
  } catch (error) {
    console.warn("⚠️  Could not read stored API key:", error.message);
  }
  return null;
}

/**
 * Get API key from various sources or start OAuth flow
 * @returns {Promise<string>} The API key
 */
async function getApiKey() {
  // Check stored API key first
  const storedKey = loadStoredApiKey();
  if (storedKey) {
    return storedKey;
  }

  // Check environment variables
  let apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey && fs.existsSync(".env")) {
    // Try to load from .env file
    const envContent = fs.readFileSync(".env", "utf8");
    const match = envContent.match(/^PARALLEL_API_KEY=(.+)$/m);
    if (match) {
      apiKey = match[1].trim();
    }
  }

  if (apiKey) {
    console.log("🔑 Using API key from environment");
    storeApiKey(apiKey);
    return apiKey;
  }

  // No API key found, start OAuth flow
  console.log("🔑 No API key found. Starting OAuth flow...");
  const oauth = new OAuth();
  const newApiKey = await oauth.getApiKey();

  storeApiKey(newApiKey);
  return newApiKey;
}

/**
 * Load manifest file
 * @param {string} outDir - Output directory
 * @returns {Manifest} The manifest object
 */
function loadManifest(outDir) {
  const manifestPath = path.join(outDir, "llmtext-manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return { files: [], timestamp: new Date().toISOString() };
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return { files: [], timestamp: new Date().toISOString() };
  }
}

/**
 * Save manifest file
 * @param {string} outDir - Output directory
 * @param {Manifest} manifest - The manifest to save
 */
function saveManifest(outDir, manifest) {
  const manifestPath = path.join(outDir, "llmtext-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Clean up old files that are no longer generated
 * @param {string} outDir - Output directory
 * @param {string[]} currentFiles - Currently generated files
 * @param {string[]} previousFiles - Previously generated files
 */
function cleanupOldFiles(outDir, currentFiles, previousFiles) {
  const filesToRemove = previousFiles.filter(
    (file) => !currentFiles.includes(file)
  );

  for (const file of filesToRemove) {
    const filePath = path.join(outDir, file);
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath);
        console.log(`🗑️  Removed old file: ${file}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not remove ${file}:`, error.message);
    }
  }
}

/**
 * Process custom URLs through extraction API
 * @param {Array<{title: string, description: string, url: string}>} customUrls - Custom URLs to process
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<Record<string, any>>} Extracted files
 */
async function processCustomUrls(customUrls, apiKey) {
  const files = {};

  for (const customUrl of customUrls) {
    console.log(`📄 Processing custom URL: ${customUrl.url}`);

    try {
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
      } else {
        throw new Error(`${response.status} - ${await response.statusText()}`);
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

/**
 * Clear stored API key credentials
 */
async function clearCredentials() {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      fs.unlinkSync(API_KEY_FILE);
      console.log("✅ Cleared stored API key from ~/.llmtext/api-key");
    } else {
      console.log("ℹ️  No stored API key found to clear");
    }
  } catch (error) {
    console.error("❌ Error clearing credentials:", error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 Extract from Sitemap CLI");

  // Check for special commands
  const args = process.argv.slice(2);
  if (args.includes("--clear-credentials")) {
    await clearCredentials();
    return;
  }

  try {
    const config = await loadConfig();
    const apiKey = await getApiKey();

    // Ensure output directory exists
    fs.mkdirSync(config.outDir, { recursive: true });

    // Load previous manifest
    const previousManifest = loadManifest(config.outDir);
    const currentFiles = [];

    let totalTokens = 0;
    let totalPages = 0;
    let totalErrors = 0;

    // Process each origin with its own forceExtract setting
    for (const originConfig of config.origins) {
      console.log(
        `\n🌐 Processing origin: ${originConfig.origin} (forceExtract: ${originConfig.forceExtract})`
      );

      try {
        const result = await extractFromSitemap(
          originConfig.origin,
          originConfig.forceExtract,
          apiKey
        );

        console.log(
          `✅ Extracted ${result.totalPages} pages with ${result.totalTokens} tokens`
        );
        if (result.errors > 0) {
          console.log(`⚠️  ${result.errors} errors occurred`);
        }

        // Write files to disk
        for (const [filePath, file] of Object.entries(result.files)) {
          let filename = filePath;

          if (!config.keepOriginalUrls) {
            // Create domain-specific subdirectory
            const domain = new URL(
              originConfig.origin.startsWith("http")
                ? originConfig.origin
                : `https://${originConfig.origin}`
            ).hostname;
            const domainDir = path.join(config.outDir, domain);
            fs.mkdirSync(domainDir, { recursive: true });
            filename = path.join(
              domain,
              filePath.startsWith("/") ? filePath.slice(1) : filePath
            );
          } else {
            filename = filePath.startsWith("/") ? filePath.slice(1) : filePath;
          }

          const fullFilePath = path.join(config.outDir, filename);
          const fileDir = path.dirname(fullFilePath);

          fs.mkdirSync(fileDir, { recursive: true });
          fs.writeFileSync(fullFilePath, file.content);
          currentFiles.push(filename);

          console.log(`📝 Wrote: ${filename} (${file.tokens} tokens)`);
        }

        totalTokens += result.totalTokens;
        totalPages += result.totalPages;
        totalErrors += result.errors;
      } catch (error) {
        console.error(
          `❌ Error processing ${originConfig.origin}:`,
          error.message
        );
        totalErrors++;
      }
    }

    // Process custom URLs
    if (config.customUrls.length > 0) {
      console.log(`\n📋 Processing ${config.customUrls.length} custom URLs...`);
      const customFiles = await processCustomUrls(config.customUrls, apiKey);

      for (const [filename, file] of Object.entries(customFiles)) {
        const filePath = path.join(config.outDir, filename);
        fs.writeFileSync(filePath, file.content);
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
    const newManifest = {
      files: currentFiles,
      timestamp: new Date().toISOString(),
    };
    saveManifest(config.outDir, newManifest);

    console.log("\n✨ Extraction completed!");
    console.log(`📊 Total: ${totalPages} pages, ${totalTokens} tokens`);
    if (totalErrors > 0) {
      console.log(`⚠️  Errors: ${totalErrors}`);
    }
    console.log(`📁 Output directory: ${path.resolve(config.outDir)}`);
    console.log("\n💡 Use --clear-credentials to remove stored API key");
  } catch (error) {
    console.error("💥 Fatal error:", error.message);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  OAuth,
  loadConfig,
  getApiKey,
  clearCredentials,
  main,
};
