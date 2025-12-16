import { parseLlmsTxt } from "parse-llms-txt";

/**
 * Sanitizes a section name for use in paths
 * @param {string} sectionName - Section name to sanitize
 * @returns {string} Sanitized section name
 */
function sanitizeSectionName(sectionName) {
  return sectionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Sanitizes a URL pathname while preserving directory structure
 * @param {string} pathname - URL pathname to sanitize
 * @returns {string} Sanitized pathname with slashes preserved
 */
function sanitizePathname(pathname) {
  return (
    pathname
      .replace(/^\/+|\/+$/g, "") // Remove leading/trailing slashes
      .split("/") // Split into path segments
      .map((segment) =>
        segment
          .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace invalid chars in each segment
          .replace(/_{2,}/g, "_") // Collapse multiple underscores
          .replace(/-{2,}/g, "-"),
      ) // Collapse multiple hyphens
      .filter((segment) => segment.length > 0) // Remove empty segments
      .join("/") || // Rejoin with slashes
    "index"
  );
}

/**
 * Downloads content from a URL
 * @param {string} url - URL to download
 * @returns {Promise<string>} Downloaded content
 */
async function downloadUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return await response.text();
}

/**
 * Parses llms.txt from a URL and downloads all referenced files
 * @param {string} llmsTxtUrl - URL to the llms.txt file
 * @returns {Promise<{[path: string]: string}>} Object mapping file paths to content
 */
export async function parseLlmsTxtAndDownload(llmsTxtUrl) {
  console.error(`Fetching llms.txt from: ${llmsTxtUrl}`);

  // Download and parse the llms.txt file
  const llmsTxtContent = await downloadUrl(llmsTxtUrl);
  const parsed = parseLlmsTxt(llmsTxtContent);

  console.error(`Found ${parsed.sections.length} sections`);

  /** @type {{[path: string]: string}} */
  const files = {};

  // Store the original llms.txt
  files["llms.txt"] = llmsTxtContent;

  // Store parsed metadata as JSON
  files["llms.json"] = JSON.stringify(parsed, null, 2);

  // Process each section
  for (const section of parsed.sections) {
    const sectionDir = sanitizeSectionName(section.name);
    console.error(
      `Processing section: ${section.name} (${section.files.length} files)`,
    );

    // Download each file in the section
    for (const file of section.files) {
      try {
        const url = new URL(file.url);
        const pathname = sanitizePathname(url.pathname);

        // Create path: section/pathname (with slashes preserved in pathname)
        const filePath = `${sectionDir}/${pathname}`;

        console.error(`  Downloading: ${file.name} -> ${filePath}`);
        const content = await downloadUrl(file.url);
        files[filePath] = content;

        // Add a small delay to be respectful to servers
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  Error downloading ${file.url}:`, error.message);
        // Store error as file content
        const url = new URL(file.url);
        const pathname = sanitizePathname(url.pathname);
        const filePath = `${sectionDir}/${pathname}`;
        files[
          filePath
        ] = `# Error downloading file\n\nURL: ${file.url}\nError: ${error.message}`;
      }
    }
  }

  console.error(`Downloaded ${Object.keys(files).length} files total`);
  return files;
}
