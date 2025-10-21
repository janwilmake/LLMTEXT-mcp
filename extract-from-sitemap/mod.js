/**
 * @typedef {Object} FileResult
 * @property {string} [error] - Error message if file processing failed
 * @property {string} content - The extracted or fetched content of the file
 * @property {string} publishedDate - The published date of the file/document
 * @property {string} title - The title of the file/document
 * @property {string} description - The description of the file/document
 * @property {boolean} extracted - Whether the content was extracted or directly fetched
 * @property {number} status - HTTP status code or processing status
 * @property {number} tokens - Number of tokens in the content
 * @property {string} originalUrl - The original URL of the content
 */

/**
 * @typedef {Object} ResponseData
 * @property {Record<string, FileResult>} files - Map of file identifiers to their results
 * @property {number} totalTokens - Total number of tokens across all files
 * @property {number} totalPages - Total number of pages processed
 * @property {number} errors - Number of errors encountered during processing
 * @property {number} processingTimeMs - Total processing time in milliseconds
 * @property {number} extractApiCallCount - Number of API calls made for content extraction
 * @property {number} fetchCount - Number of fetch operations performed
 */

/**
 * Extract content from sitemap URLs with markdown variant detection
 * @param {string} origin - The origin URL to extract from
 * @param {boolean} forceExtract - Whether to force using extract API instead of markdown variants
 * @param {string} apiKey - Parallel API key
 * @param {string} [titleRemovePattern] - Optional regex pattern to remove from titles
 * @returns {Promise<ResponseData>}
 */
export async function extractFromSitemap(
  origin,
  forceExtract = false,
  apiKey,
  titleRemovePattern
) {
  const startTime = Date.now();
  let fetchCount = 0;
  let extractApiCallCount = 0;

  // Discover sitemap
  const sitemapUrl = await discoverSitemap(origin);
  if (!sitemapUrl) {
    throw new Error(`Could not find sitemap for ${origin}`);
  }

  // Parse sitemap and get URLs
  const urls = await parseSitemap(sitemapUrl);

  // Process each URL
  const files = {};
  const urlsNeedingExtract = [];

  // Fetch all URLs with markdown variant detection
  await Promise.all(
    urls.map(async (urlStr) => {
      try {
        const result = await fetchUrlContent(urlStr, forceExtract);
        fetchCount += result.fetchCount;

        const path = getPathFromUrl(urlStr) + ".md";
        files[path] = {
          content: result.content,
          title: cleanTitle(result.title, titleRemovePattern),
          description: cleanDescription(result.description, result.title),
          extracted: false,
          status: result.status,
          tokens: Math.round(result.content.length / 5),
          publishedDate: result.publishedDate || "",
          originalUrl: urlStr,
          error: result.error,
        };

        // Track URLs that need Extract API fallback
        if (!result.content || result.error) {
          urlsNeedingExtract.push(urlStr);
        }
      } catch (error) {
        const path = getPathFromUrl(urlStr) + ".md";
        files[path] = {
          error: error instanceof Error ? error.message : "Unknown error",
          content: "",
          title: "",
          description: "",
          extracted: false,
          status: 0,
          tokens: 0,
          publishedDate: "",
          originalUrl: urlStr,
        };
        if (!forceExtract) {
          urlsNeedingExtract.push(urlStr);
        }
      }
    })
  );

  // Use Parallel Extract API for URLs that didn't return content
  if (urlsNeedingExtract.length > 0 && apiKey) {
    try {
      extractApiCallCount = 1;
      const extractResults = await callParallelExtractAPI(
        urlsNeedingExtract,
        apiKey
      );

      // Merge extract results
      for (const result of extractResults.results) {
        const path = getPathFromUrl(result.url) + ".md";
        const existing = files[path] || {
          content: "",
          title: "",
          description: "",
          extracted: false,
          status: 0,
          tokens: 0,
          publishedDate: "",
          originalUrl: result.url,
        };

        const content = result.full_content || existing.content;
        files[path] = {
          content,
          title: cleanTitle(result.title || existing.title, titleRemovePattern),
          description: cleanDescription(
            existing.description,
            result.title || existing.title
          ),
          extracted: !!result.full_content,
          publishedDate: result.published_date || existing.publishedDate,
          status: existing.status,
          tokens: Math.round(content.length / 5),
          originalUrl: existing.originalUrl,
        };
      }

      // Handle extract errors
      for (const error of extractResults.errors) {
        const path = getPathFromUrl(error.url) + ".md";
        if (files[path]) {
          files[path].error = error.message;
        }
      }
    } catch (error) {
      console.error("Extract API error:", error);
    }
  }

  // Sort files by path
  const sortedFiles = Object.keys(files)
    .sort()
    .reduce((acc, key) => {
      acc[key] = files[key];
      return acc;
    }, {});

  // Calculate totals
  const totalTokens = Object.values(sortedFiles).reduce(
    (sum, file) => sum + file.tokens,
    0
  );
  const totalPages = Object.keys(sortedFiles).length;
  const errors = Object.values(sortedFiles).filter((file) => file.error).length;
  const processingTimeMs = Date.now() - startTime;

  return {
    files: sortedFiles,
    totalTokens,
    totalPages,
    errors,
    processingTimeMs,
    extractApiCallCount,
    fetchCount,
  };
}

/**
 * Clean title by removing custom pattern if provided
 * @param {string} title - Original title
 * @param {string} [removePattern] - Optional regex pattern to remove from title
 * @returns {string} Cleaned title
 */
function cleanTitle(title, removePattern) {
  if (!title) return "";

  if (removePattern) {
    try {
      const regex = new RegExp(removePattern, "gi");
      return title.replace(regex, "").trim();
    } catch (error) {
      console.warn(`Invalid titleRemovePattern: ${error.message}`);
      return title.trim();
    }
  }

  return title.trim();
}

/**
 * Clean description by removing title duplicates
 * @param {string} description - Original description
 * @param {string} title - Page title
 * @returns {string} Cleaned description
 */
function cleanDescription(description, title) {
  if (!description || !title) return description || "";

  // Remove title from beginning of description if it's a duplicate
  if (description.toLowerCase().startsWith(title.toLowerCase())) {
    return description
      .substring(title.length)
      .replace(/^[.\s-]+/, "")
      .trim();
  }

  return description;
}

/**
 * Discover sitemap URL for a given origin
 * @param {string} origin - The origin to search for sitemap
 * @returns {Promise<string|null>} Sitemap URL or null if not found
 */
async function discoverSitemap(origin) {
  // Ensure origin has protocol
  const baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;
  const domain = new URL(baseUrl).origin;

  // Try common sitemap locations
  const candidates = [
    `${domain}/sitemap.xml`,
    `${domain}/sitemap_index.xml`,
    `${domain}/sitemap-index.xml`,
    `${domain}/sitemap1.xml`,
  ];

  // Also check robots.txt
  try {
    const robotsRes = await fetch(`${domain}/robots.txt`, {
      headers: { "User-Agent": "sitemap-to-llmtext-bot/1.0" },
    });
    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text();
      const sitemapMatch = robotsTxt.match(/Sitemap:\s*(.+)/i);
      if (sitemapMatch) {
        candidates.unshift(sitemapMatch[1].trim());
      }
    }
  } catch {}

  // Test each candidate
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: { "User-Agent": "sitemap-to-llmtext-bot/1.0" },
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("xml") || contentType.includes("text")) {
          return candidate;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Parse sitemap XML and extract URLs
 * @param {string} sitemapUrl - URL of the sitemap
 * @returns {Promise<string[]>} Array of URLs found in sitemap
 */
async function parseSitemap(sitemapUrl) {
  const res = await fetch(sitemapUrl, {
    headers: { "User-Agent": "sitemap-to-llmtext-bot/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${res.status}`);
  }

  const xml = await res.text();
  const urls = [];

  // Check if this is a sitemap index
  const sitemapPattern =
    /<sitemap>[\s\S]*?<loc>(.+?)<\/loc>[\s\S]*?<\/sitemap>/gi;
  const sitemapMatches = xml.matchAll(sitemapPattern);
  const childSitemaps = Array.from(sitemapMatches, (m) => m[1]);

  if (childSitemaps.length > 0) {
    // Recursively parse child sitemaps
    const childUrls = await Promise.all(
      childSitemaps.map((url) => parseSitemap(url))
    );
    return childUrls.flat();
  }

  // Parse regular sitemap
  const urlPattern = /<url>[\s\S]*?<loc>(.+?)<\/loc>[\s\S]*?<\/url>/gi;
  const matches = xml.matchAll(urlPattern);

  for (const match of matches) {
    urls.push(match[1]);
  }

  return urls;
}

/**
 * Fetch content from URL with markdown variant detection
 * @param {string} urlStr - URL to fetch
 * @param {boolean} forceExtract - Skip markdown variant detection
 * @returns {Promise<{content: string, title: string, description: string, status: number, error?: string, fetchCount: number, publishedDate?: string}>}
 */
async function fetchUrlContent(urlStr, forceExtract = false) {
  let title = "";
  let description = "";
  let content = "";
  let error;
  let status = 0;
  let fetchCount = 0;
  let publishedDate = "";

  if (forceExtract) {
    // Just fetch HTML for metadata when forcing extract
    try {
      const res = await fetch(urlStr, {
        headers: {
          Accept: "text/html",
          "User-Agent": "sitemap-to-llmtext-bot/1.0",
        },
      });
      fetchCount++;
      status = res.status;

      if (res.ok) {
        const html = await res.text();
        ({ title, description, publishedDate } = extractMetadata(html));
      }
    } catch (err) {
      error = `HTML fetch failed: ${err.message || "Unknown"}`;
    }

    return {
      content,
      title,
      description,
      status,
      error,
      fetchCount,
      publishedDate,
    };
  }

  // First, fetch HTML to check for markdown variants
  let html = "";
  try {
    const htmlRes = await fetch(urlStr, {
      headers: {
        Accept: "text/html",
        "User-Agent": "sitemap-to-llmtext-bot/1.0",
      },
    });
    fetchCount++;
    status = htmlRes.status;

    if (htmlRes.ok) {
      html = await htmlRes.text();
      ({ title, description, publishedDate } = extractMetadata(html));

      // Look for markdown alternate link
      const mdAlternateMatch = html.match(
        /<link\s+rel=["']alternate["']\s+type=["']text\/markdown["']\s+href=["']([^"']+)["'][^>]*>/i
      );

      if (mdAlternateMatch) {
        const mdUrl = new URL(mdAlternateMatch[1], urlStr).href;
        try {
          const mdRes = await fetch(mdUrl, {
            headers: {
              Accept: "text/markdown, text/plain",
              "User-Agent": "sitemap-to-llmtext-bot/1.0",
            },
          });
          fetchCount++;

          if (mdRes.ok) {
            content = await mdRes.text();
            return {
              content,
              title,
              description,
              status,
              fetchCount,
              publishedDate,
            };
          }
        } catch (mdErr) {
          // Fall through to try direct markdown request
        }
      }
    }
  } catch (err) {
    error = `HTML fetch failed: ${err.message || "Unknown"}`;
  }

  // Try fetching with markdown accept header
  try {
    const mdRes = await fetch(urlStr, {
      headers: {
        Accept: "text/markdown",
        "User-Agent": "sitemap-to-llmtext-bot/1.0",
      },
    });
    fetchCount++;
    status = status || mdRes.status;

    const contentType = mdRes.headers.get("content-type") || "";
    if (mdRes.ok && contentType.includes("markdown")) {
      content = await mdRes.text();
    }
  } catch (mdErr) {
    if (!error) {
      error = `Markdown fetch failed: ${mdErr.message || "Unknown"}`;
    }
  }

  return {
    content,
    title,
    description,
    status,
    error,
    fetchCount,
    publishedDate,
  };
}

/**
 * Extract metadata from HTML
 * @param {string} html - HTML content
 * @returns {{title: string, description: string, publishedDate: string}}
 */
function extractMetadata(html) {
  let title = "";
  let description = "";
  let publishedDate = "";

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Extract og:description
  const ogDescMatch = html.match(
    /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i
  );
  if (ogDescMatch) {
    description = ogDescMatch[1].trim();
  }

  // Fallback to meta description
  if (!description) {
    const metaDescMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    );
    if (metaDescMatch) {
      description = metaDescMatch[1].trim();
    }
  }

  // Extract published date from various meta tags
  const datePatterns = [
    /<meta\s+property=["']article:published_time["']\s+content=["']([^"']+)["']/i,
    /<meta\s+name=["']date["']\s+content=["']([^"']+)["']/i,
    /<meta\s+name=["']publish-date["']\s+content=["']([^"']+)["']/i,
  ];

  for (const pattern of datePatterns) {
    const match = html.match(pattern);
    if (match) {
      publishedDate = match[1].trim();
      break;
    }
  }

  return { title, description, publishedDate };
}

/**
 * Convert URL to file path
 * @param {string} urlStr - URL to convert
 * @returns {string} File path
 */
function getPathFromUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    let path = url.pathname;

    // Handle root path
    if (path === "/" || path === "") {
      return "/index";
    }

    // Handle paths ending with /
    if (path.endsWith("/")) {
      path += "index";
    }

    return path;
  } catch {
    // Fallback to a sanitized version of the full URL
    return "/" + urlStr.replace(/[^a-zA-Z0-9]/g, "_");
  }
}

/**
 * Call Parallel Extract API for multiple URLs
 * @param {string[]} urls - URLs to extract
 * @param {string} apiKey - Parallel API key
 * @returns {Promise<{results: Array<{url: string, published_date: string, full_content: string|null, title: string|null}>, errors: Array<{url: string, message: string}>}>}
 */
async function callParallelExtractAPI(urls, apiKey) {
  const response = await fetch("https://api.parallel.ai/v1beta/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "parallel-beta": "search-extract-2025-10-10",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      urls,
      full_content: true,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Extract API failed: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}
