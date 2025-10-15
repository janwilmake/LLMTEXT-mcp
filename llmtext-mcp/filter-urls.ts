#!/usr/bin/env bun

import { readFile, writeFile } from "fs/promises";

interface UrlResult {
  url: string;
  valid: boolean;
  reason?: string;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 2000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Accept: "text/plain,text/markdown,*/*",
        // "User-Agent": "llms-txt-filter/1.0",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchMdWithTimeout(
  url: string,
  timeoutMs: number = 2000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/plain,text/markdown,*/*",
        "User-Agent": "llms-txt-filter/1.0",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function isValidHttpsUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "https:" && url.pathname === "/llms.txt";
  } catch {
    return false;
  }
}

function extractMarkdownLinks(content: string, baseUrl: string): string[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const linkUrl = match[2];

    try {
      // Handle absolute URLs
      if (linkUrl.startsWith("http://") || linkUrl.startsWith("https://")) {
        links.push(linkUrl);
      }
      // Handle relative URLs
      else {
        const base = new URL(baseUrl);
        const absoluteUrl = new URL(linkUrl, base.origin);
        links.push(absoluteUrl.toString());
      }
    } catch (error) {
      // Skip invalid URLs
      continue;
    }
  }

  return links;
}

async function validateLinksInContent(
  content: string,
  baseUrl: string
): Promise<boolean> {
  const links = extractMarkdownLinks(content, baseUrl);

  if (links.length === 0) {
    return false;
  }

  // Test first 5 links
  const linksToTest = links.slice(0, 5);
  let validLinks = 0;

  for (const link of linksToTest) {
    try {
      const response = await fetchMdWithTimeout(link, 2000);

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type") || "";

      if (
        contentType.includes("text/plain") ||
        contentType.includes("text/markdown") ||
        contentType.includes("text/html") // Also accept HTML as it's common for markdown links
      ) {
        validLinks++;
      }
    } catch (error) {
      // Link failed, continue to next
      continue;
    }
  }

  // At least one valid link should work
  return validLinks > 0;
}

async function validateUrl(url: string): Promise<UrlResult> {
  // Check if URL is valid HTTPS with /llms.txt path
  if (!isValidHttpsUrl(url)) {
    return {
      url,
      valid: false,
      reason: "Invalid URL format or path not /llms.txt",
    };
  }

  try {
    // Fetch the URL
    const response = await fetchWithTimeout(url, 2000);

    if (!response.ok) {
      return {
        url,
        valid: false,
        reason: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Check content type
    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/plain") &&
      !contentType.includes("text/markdown")
    ) {
      return {
        url,
        valid: false,
        reason: `Invalid content-type: ${contentType}`,
      };
    }

    // Check content length
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 100 * 1024) {
      return {
        url,
        valid: false,
        reason: "Content too large (>100KB)",
      };
    }

    // Get content and check size
    const content = await response.text();
    if (content.length > 100 * 1024) {
      return {
        url,
        valid: false,
        reason: "Content too large (>100KB)",
      };
    }

    // Validate links in content (pass the base URL for relative link resolution)
    const hasValidLinks = await validateLinksInContent(content, url);
    if (!hasValidLinks) {
      return {
        url,
        valid: false,
        reason:
          "No valid markdown links found or links do not respond with valid content types",
      };
    }

    return {
      url,
      valid: true,
    };
  } catch (error) {
    return {
      url,
      valid: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function processUrls(urls: string[]): Promise<string[]> {
  const validUrls: string[] = [];
  const batchSize = 50;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        urls.length / batchSize
      )} (${batch.length} URLs)`
    );

    const promises = batch.map((url) => validateUrl(url.trim()));
    const results = await Promise.all(promises);

    for (const result of results) {
      if (result.valid) {
        validUrls.push(result.url);
        console.log(`✓ ${result.url}`);
      } else {
        console.log(`✗ ${result.url} - ${result.reason}`);
      }
    }
  }

  return validUrls;
}

async function main() {
  try {
    // Read input file
    console.log("Reading list.txt...");
    const content = await readFile("list.txt", "utf-8");
    const urls = content.split("\n").filter((line) => line.trim().length > 0);

    console.log(`Found ${urls.length} URLs to process`);

    // Process URLs
    const validUrls = await processUrls(urls);

    // Write results
    console.log(`\nWriting ${validUrls.length} valid URLs to list2.txt...`);
    await writeFile("list2.txt", validUrls.join("\n") + "\n");

    console.log(
      `\nComplete! ${validUrls.length}/${urls.length} URLs passed validation.`
    );
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the script
main();
