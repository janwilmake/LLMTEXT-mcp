//@ts-check

/**
 * @typedef {Object} FileData
 * @property {string} path - File path/name (relative path)
 * @property {Uint8Array} data - File data
 * @property {string} contentType - MIME type
 */

/**
 * @typedef {Object} AssetManifest
 * @property {Object.<string, {hash: string, size: number}>} [key] - Asset paths mapped to their metadata
 */

/**
 * @typedef {Object} AssetResult
 * @property {AssetManifest} manifest - Asset manifest mapping paths to metadata
 * @property {string} [_headers] - Headers file content
 * @property {string} [_redirects] - Redirects file content
 */

// Constants
const MAX_ASSET_COUNT = 20000;
const MAX_ASSET_SIZE = 1024 * 1024 * 25;
const CF_ASSETS_IGNORE_FILENAME = ".assetsignore";

const defaultAssetsIgnore = `.git
node_modules
.wrangler
private
.env
.env.example
.dev.vars
wrangler.toml
package.json
tsconfig.json
package-lock.json
`;

/**
 * Normalizes a path to a file path format
 * @param {string | undefined} path - The path to normalize
 * @returns {string} The normalized file path
 */
function normalizeToFilePath(path) {
  if (!path) return "";
  if (path === "/") return "";
  if (path === "./") return "";
  if (path.startsWith("/")) return path.slice(1);
  if (path.startsWith("./")) return path.slice(2);
  return path;
}

/**
 * Simple gitignore parser that returns a function to check if a file should be ignored
 * @param {string} content - The gitignore file content
 * @returns {function(string): boolean} Function that returns true if the file should be ignored
 */
function parseGitignore(content) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return (filePath) => {
    const normalizedPath = filePath.startsWith("/")
      ? filePath.slice(1)
      : filePath;

    return lines.some((pattern) => {
      if (pattern.endsWith("/")) {
        // Directory pattern
        const dir = pattern.slice(0, -1);
        return normalizedPath.startsWith(dir + "/") || normalizedPath === dir;
      } else if (pattern.includes("*")) {
        // Glob pattern (simple implementation)
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        return regex.test(normalizedPath);
      } else {
        // Exact match
        return (
          normalizedPath === pattern || normalizedPath.startsWith(pattern + "/")
        );
      }
    });
  };
}

/**
 * Simple TOML parser for basic key-value pairs
 * @param {string} content - The TOML content to parse
 * @returns {Object} Parsed TOML object
 */
function parseToml(content) {
  const result = {};
  let currentSection = result;
  let currentSectionName = "";

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      // Section header
      currentSectionName = trimmed.slice(1, -1);
      if (currentSectionName.includes(".")) {
        const parts = currentSectionName.split(".");
        currentSection = result;
        for (const part of parts) {
          if (!currentSection[part]) currentSection[part] = {};
          currentSection = currentSection[part];
        }
      } else {
        if (!result[currentSectionName]) result[currentSectionName] = {};
        currentSection = result[currentSectionName];
      }
    } else if (trimmed.includes("=")) {
      // Key-value pair
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim();
      const cleanKey = key.trim();
      let cleanValue = value;

      // Remove quotes
      if (
        (cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
        (cleanValue.startsWith("'") && cleanValue.endsWith("'"))
      ) {
        cleanValue = cleanValue.slice(1, -1);
      }

      currentSection[cleanKey] = cleanValue;
    }
  }

  return result;
}

/**
 * Creates an asset ignore function based on the assets ignore content
 * @param {string | undefined} assetsIgnoreContent - The content of the assets ignore file
 * @returns {function(string): boolean | null} Function to check if a file should be ignored, or null if no content
 */
function createAssetIgnoreFunction(assetsIgnoreContent) {
  if (!assetsIgnoreContent) return null;

  const content = assetsIgnoreContent + "\n" + CF_ASSETS_IGNORE_FILENAME;
  return parseGitignore(content);
}

/**
 * Calculates SHA-256 hash of content
 * @param {string} content - Content to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function calculateHash(content) {
  // Browser/Worker environment
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Finds the assets root directory from the file data
 * @param {FileData[]} fileData - The file data containing all files
 * @returns {Promise<string>} The assets root directory path
 */
async function findAssetsRoot(fileData) {
  // Check for wrangler config files
  const wranglerFiles = ["wrangler.toml", "wrangler.json", "wrangler.jsonc"];

  for (const configFile of wranglerFiles) {
    const file = fileData.find(
      (f) => f.path === configFile || f.path.endsWith(`/${configFile}`)
    );
    if (file) {
      const configContent = new TextDecoder().decode(file.data);
      let config;
      try {
        if (configFile.endsWith(".toml")) {
          config = parseToml(configContent);
        } else {
          config = JSON.parse(configContent);
        }

        const directory = config?.assets?.directory;
        if (directory) {
          return normalizeToFilePath(directory);
        }
      } catch (e) {
        console.warn(`Failed to parse ${configFile}:`, e);
      }
    }
  }

  // Check for public directory
  const hasPublic = fileData.some((f) => f.path.startsWith("public/"));
  if (hasPublic) {
    return "public";
  }

  return "";
}

/**
 * Extracts special files (_headers and _redirects) from the file data
 * @param {FileData[]} fileData - The file data
 * @param {string} rootPath - The root path prefix
 * @returns {Promise<{_headers?: string, _redirects?: string}>} Object containing special file contents
 */
async function extractSpecialFiles(fileData, rootPath) {
  const result = {};
  const rootPrefix = rootPath ? `${rootPath}/` : "";

  // Look for _headers and _redirects
  const headersPath = `${rootPrefix}_headers`;
  const redirectsPath = `${rootPrefix}_redirects`;

  const headersFile = fileData.find(
    (f) =>
      f.path === headersPath ||
      f.path === `/${headersPath}` ||
      f.path.endsWith("/_headers")
  );
  if (headersFile) {
    result._headers = new TextDecoder().decode(headersFile.data);
  }

  const redirectsFile = fileData.find(
    (f) =>
      f.path === redirectsPath ||
      f.path === `/${redirectsPath}` ||
      f.path.endsWith("/_redirects")
  );
  if (redirectsFile) {
    result._redirects = new TextDecoder().decode(redirectsFile.data);
  }

  return result;
}

/**
 * @param {string} path
 * @returns string
 */
const withPrefix = (path) => (path.startsWith("/") ? path : "/" + path);

/**
 * Generates an asset manifest from FileData array
 * @param {FileData[]} fileData - The file data containing all files
 * @returns {Promise<AssetResult>} The asset manifest and special files
 */
export async function getAssetManifest(fileData) {
  const rootPath = await findAssetsRoot(fileData);
  const rootPrefix = rootPath ? `${rootPath}/` : "";

  // Extract special files (_headers, _redirects)
  const specialFiles = await extractSpecialFiles(fileData, rootPath);

  // Find all .assetsignore files
  const assetsIgnoreContents = [];
  for (const file of fileData) {
    if (
      file.path.endsWith("/.assetsignore") ||
      file.path === ".assetsignore" ||
      file.path === "/.assetsignore"
    ) {
      const content = new TextDecoder().decode(file.data);
      assetsIgnoreContents.push(content);
    }
  }

  // Flatten ignore files
  const assetsIgnoreString =
    assetsIgnoreContents.length > 0
      ? assetsIgnoreContents.join("\n")
      : defaultAssetsIgnore;

  const ignoreFn = createAssetIgnoreFunction(assetsIgnoreString);

  // Build manifest
  const manifest = {};
  let counter = 0;

  for (const file of fileData) {
    const filename = file.path;

    // Skip if not in assets directory
    if (
      rootPrefix &&
      !filename.startsWith(rootPrefix) &&
      !filename.startsWith(`/${rootPrefix}`)
    )
      continue;

    // Get relative path
    let relativePath;
    if (filename.startsWith(`/${rootPrefix}`)) {
      relativePath = withPrefix(filename.slice(rootPrefix.length + 1));
    } else if (filename.startsWith(rootPrefix)) {
      relativePath = withPrefix(filename.slice(rootPrefix.length));
    } else {
      relativePath = withPrefix(filename);
    }

    // Apply ignore rules
    if (ignoreFn?.(relativePath.slice(1))) continue;

    // Check limits
    if (counter >= MAX_ASSET_COUNT) break;
    if (file.data.length > MAX_ASSET_SIZE) {
      console.log(
        `Asset too large: ${relativePath} (${file.data.length} bytes)`
      );
      continue;
    }

    // Skip special files from manifest
    const fileName = relativePath.split("/").pop();
    if (fileName === "_headers" || fileName === "_redirects") continue;

    // Calculate hash
    const content = new TextDecoder().decode(file.data);
    const hash = await calculateHash(content);

    manifest[relativePath] = {
      hash: hash.slice(0, 32),
      size: file.data.length,
    };

    counter++;
  }

  return {
    manifest,
    ...specialFiles,
  };
}
