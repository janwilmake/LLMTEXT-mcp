#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");
const http = require("http");
const { URL, URLSearchParams } = require("url");
const os = require("os");
const { processLLMTextConfig } = require("./mod.js");

const CREDENTIALS_DIR = path.join(os.homedir(), ".llmtext");
const API_KEY_FILE = path.join(CREDENTIALS_DIR, "api-key");

/**
 * Detect if running in a CI environment
 * @returns {boolean}
 */
function isCI() {
  return !!(
    process.env.CI || // Generic CI flag
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    process.env.DRONE ||
    process.env.SEMAPHORE
  );
}

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
 * @returns {Promise<any>} The configuration object
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
          title: "Parallel Web Systems",
          description: "Combined documentation from multiple sources",
          details:
            "This collection includes API documentation, guides, and references.",
          outDir: "./docs",
          sources: [
            {
              title: "Parallel AI Documentation",
              origin: "https://docs.parallel.ai",
              forceExtract: false,
              outDir: "./docs/parallel-docs",
              keepOriginalUrls: false,
            },
            {
              title: "Parallel AI Website",
              origin: "https://parallel.ai",
              forceExtract: true,
              outDir: "./docs/parallel-main",
              keepOriginalUrls: false,
            },
            {
              title: "Custom Resources",
              forceExtract: true,
              outDir: "./docs/custom",
              keepOriginalUrls: false,
              customUrls: [
                {
                  title: "Custom Page",
                  description: "A custom page to extract",
                  filename: "custom-page",
                  url: "https://example.com/page",
                },
              ],
            },
            {
              title: "External References",
              keepOriginalUrls: true,
              forceExtract: false,
              customUrls: [
                {
                  title: "External API Guide",
                  description: "Third-party API documentation",
                  filename: "external-api",
                  url: "https://external.com/api-guide",
                },
              ],
            },
          ],
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
    if (!config.description) throw new Error("description is required");
    if (!config.outDir) throw new Error("outDir is required");
    if (!Array.isArray(config.sources))
      throw new Error("sources must be an array");

    // Resolve top-level outDir to absolute path
    const topLevelOutDir = path.resolve(config.outDir);

    // Validate source objects
    for (const [index, sourceConfig] of config.sources.entries()) {
      if (typeof sourceConfig !== "object" || sourceConfig === null) {
        throw new Error(`sources[${index}] must be an object`);
      }
      if (!sourceConfig.title) {
        throw new Error(`sources[${index}].title is required`);
      }

      // Set defaults
      sourceConfig.forceExtract = sourceConfig.forceExtract ?? false;
      sourceConfig.keepOriginalUrls = sourceConfig.keepOriginalUrls ?? false;
      sourceConfig.customUrls = sourceConfig.customUrls || [];

      // Default outDir to top-level outDir if not specified
      if (!sourceConfig.outDir) {
        sourceConfig.outDir = config.outDir;
      }

      // Validate outDir is within top-level outDir (unless keepOriginalUrls is true)
      if (!sourceConfig.keepOriginalUrls) {
        const resolvedSourceOutDir = path.resolve(sourceConfig.outDir);

        if (!resolvedSourceOutDir.startsWith(topLevelOutDir)) {
          throw new Error(
            `sources[${index}].outDir (${sourceConfig.outDir}) must be within the top-level outDir (${config.outDir})`
          );
        }
      }

      // Either origin or customUrls must be provided
      if (
        !sourceConfig.origin &&
        (!sourceConfig.customUrls || sourceConfig.customUrls.length === 0)
      ) {
        throw new Error(
          `sources[${index}] must have either origin or customUrls`
        );
      }

      // Validate customUrls
      for (const [urlIndex, customUrl] of (
        sourceConfig.customUrls || []
      ).entries()) {
        if (
          !customUrl.title ||
          !customUrl.description ||
          !customUrl.filename ||
          !customUrl.url
        ) {
          throw new Error(
            `sources[${index}].customUrls[${urlIndex}] must have title, description, filename, and url`
          );
        }
      }
    }

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
  const inCI = isCI();

  if (inCI) {
    console.log("🔍 CI environment detected");
  }

  // Check environment variables first (most important for CI)
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
    if (!inCI) {
      storeApiKey(apiKey);
    }
    return apiKey;
  }

  // In CI environments, we cannot do OAuth - require the env var
  if (inCI) {
    console.error("\n❌ No API key found in CI environment!");
    console.error("\nPlease set the PARALLEL_API_KEY environment variable:");
    console.error("  - For GitHub Actions: Add it as a repository secret");
    console.error("  - For GitLab CI: Add it as a CI/CD variable");
    console.error(
      "  - For other CI systems: Add it as an environment variable"
    );
    console.error("\nYou can get your API key from:");
    console.error("  https://platform.parallel.ai");
    process.exit(1);
  }

  // Check stored API key (only in non-CI environments)
  const storedKey = loadStoredApiKey();
  if (storedKey) {
    return storedKey;
  }

  // No API key found, start OAuth flow (only in interactive environments)
  console.log("🔑 No API key found. Starting OAuth flow...");
  const oauth = new OAuth();
  const newApiKey = await oauth.getApiKey();

  storeApiKey(newApiKey);
  return newApiKey;
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
 * Write file hierarchy to disk
 * @param {Record<string, {content?: string, error?: string}>} fileHierarchy - File hierarchy to write
 */
function writeFileHierarchy(fileHierarchy) {
  for (const [filePath, item] of Object.entries(fileHierarchy)) {
    try {
      const resolvedPath = path.resolve(filePath);
      const fileDir = path.dirname(resolvedPath);

      // Create directory if it doesn't exist
      fs.mkdirSync(fileDir, { recursive: true });

      if (item.content) {
        fs.writeFileSync(resolvedPath, item.content);
        console.log(`📝 Wrote: ${filePath}`);
      } else if (item.error) {
        console.error(`❌ Error for ${filePath}: ${item.error}`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to write ${filePath}: ${error.message || "Unknown error"}`
      );
    }
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

    console.log("\n🔄 Processing LLMText configuration...");

    // Process the entire config using the new function
    const result = await processLLMTextConfig(config, apiKey);

    // Write all files to disk
    console.log("\n📁 Writing files to disk...");
    writeFileHierarchy(result.files);

    // Print summary
    console.log("\n✨ Extraction completed!");
    console.log(
      `📊 Total: ${result.stats.totalPages} pages, ${result.stats.totalTokens} tokens`
    );
    if (result.stats.totalErrors > 0) {
      console.log(`⚠️  Errors: ${result.stats.totalErrors}`);
    }
    console.log(
      `📁 Top-level output directory: ${path.resolve(config.outDir)}`
    );
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
