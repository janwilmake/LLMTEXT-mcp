/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

interface FileResult {
  error?: string;
  content: string;
  title: string;
  description: string;
  extracted: boolean;
  status: number;
  tokens: number;
}

interface ResponseData {
  files: Record<string, FileResult>;
  totalTokens: number;
  totalPages: number;
  errors: number;
  processingTimeMs: number;
  extractApiCallCount: number;
  fetchCount: number;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const startTime = Date.now();
    const apiKey = request.headers
      .get("Authorization")
      ?.slice("Bearer ".length);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Authorization header not configured" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse hostname from request
    const url = new URL(request.url);
    const hostname = url.searchParams.get("hostname");

    if (!hostname) {
      return new Response(
        JSON.stringify({ error: "Missing 'hostname' query parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const results = await processSitemap(hostname, apiKey, startTime);
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};

async function processSitemap(
  hostname: string,
  apiKey: string,
  startTime: number
): Promise<ResponseData> {
  let fetchCount = 0;
  let extractApiCallCount = 0;

  // Discover sitemap
  const sitemapUrl = await discoverSitemap(hostname);
  if (!sitemapUrl) {
    throw new Error(`Could not find sitemap for ${hostname}`);
  }

  // Parse sitemap and get URLs
  const urls = await parseSitemap(sitemapUrl);

  // Process each URL
  const files: Record<string, FileResult> = {};
  const urlsNeedingExtract: string[] = [];

  // Fetch all URLs with markdown and HTML attempts in parallel
  await Promise.all(
    urls.map(async (urlStr) => {
      try {
        const result = await fetchUrlContent(urlStr);
        fetchCount += result.fetchCount;

        const path = getPathFromUrl(urlStr) + ".md";
        files[path] = {
          content: result.content,
          title: result.title,
          description: result.description,
          extracted: false,
          status: result.status,
          tokens: Math.round(result.content.length / 5),
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
        };
        urlsNeedingExtract.push(urlStr);
      }
    })
  );

  // Use Parallel Extract API for URLs that didn't return markdown
  if (urlsNeedingExtract.length > 0) {
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
        };

        const content = result.full_content || existing.content;
        files[path] = {
          content,
          title: result.title || existing.title,
          description: existing.description,
          extracted: !!result.full_content,
          status: existing.status,
          tokens: Math.round(content.length / 5),
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
      // Log extract API errors but don't fail the entire request
      console.error("Extract API error:", error);
    }
  }

  // Generate llms.txt
  const llmsTxt = generateLlmsTxt(hostname, files);
  files["/llms.txt"] = {
    content: llmsTxt,
    title: "LLMs.txt",
    description: "LLM-friendly content listing",
    extracted: false,
    status: 200,
    tokens: Math.round(llmsTxt.length / 5),
  };

  // Calculate totals
  const totalTokens = Object.values(files).reduce(
    (sum, file) => sum + file.tokens,
    0
  );
  const totalPages = Object.keys(files).length - 1; // Exclude llms.txt from page count
  const errors = Object.values(files).filter((file) => file.error).length;
  const processingTimeMs = Date.now() - startTime;

  return {
    files,
    totalTokens,
    totalPages,
    errors,
    processingTimeMs,
    extractApiCallCount,
    fetchCount,
  };
}

function getPathFromUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    let path = url.pathname;

    // Handle root path
    if (path === "/" || path === "") {
      return "/index.html";
    }

    // Handle paths ending with /
    if (path.endsWith("/")) {
      path += "index.html";
    }

    return path;
  } catch {
    // Fallback to a sanitized version of the full URL
    return "/" + urlStr.replace(/[^a-zA-Z0-9]/g, "_");
  }
}

function generateLlmsTxt(
  hostname: string,
  files: Record<string, FileResult>
): string {
  // Find homepage for top-level description
  const homepageFile = files["/index.html.md"] || files[Object.keys(files)[0]];
  const siteTitle = homepageFile?.title || hostname;
  const siteDescription =
    homepageFile?.description || `Documentation for ${hostname}`;

  let llmsTxt = `# ${siteTitle}\n\n> ${siteDescription}\n\n`;

  // Add documentation section
  llmsTxt += "## Documentation\n\n";

  // Sort files by path for consistent ordering
  const sortedFiles = Object.entries(files)
    .filter(([path]) => path !== "/llms.txt")
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [path, file] of sortedFiles) {
    if (file.content || file.title) {
      const title = file.title || path.replace(".md", "");
      const description = file.description ? `: ${file.description}` : "";
      llmsTxt += `- [${title}](${path.replace(".md", "")}) (${
        file.tokens
      } tokens)${description}\n`;
    }
  }

  return llmsTxt;
}

async function discoverSitemap(hostname: string): Promise<string | null> {
  // Ensure hostname has protocol
  const baseUrl = hostname.startsWith("http")
    ? hostname
    : `https://${hostname}`;
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

async function parseSitemap(sitemapUrl: string): Promise<string[]> {
  const res = await fetch(sitemapUrl, {
    headers: { "User-Agent": "sitemap-to-llmtext-bot/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${res.status}`);
  }

  const xml = await res.text();
  const urls: string[] = [];

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

async function fetchUrlContent(urlStr: string): Promise<{
  content: string;
  title: string;
  description: string;
  status: number;
  error?: string;
  fetchCount: number;
}> {
  let title = "";
  let description = "";
  let content = "";
  let error: string | undefined;
  let status = 0;
  let fetchCount = 0;

  // Fetch markdown and HTML in parallel
  const [mdResult, htmlResult] = await Promise.allSettled([
    // Try fetching with markdown accept header
    fetch(urlStr, {
      headers: {
        Accept: "text/markdown",
        "User-Agent": "sitemap-to-llmtext-bot/1.0",
      },
    }).then(async (res) => {
      fetchCount++;
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("markdown")) {
        return { content: await res.text(), status: res.status };
      }
      return { content: "", status: res.status };
    }),

    // Fetch HTML for metadata
    fetch(urlStr, {
      headers: {
        Accept: "text/html",
        "User-Agent": "sitemap-to-llmtext-bot/1.0",
      },
    }).then(async (res) => {
      fetchCount++;
      if (res.ok) {
        const html = await res.text();
        return { html, status: res.status };
      }
      return { html: "", status: res.status };
    }),
  ]);

  // Process markdown result
  if (mdResult.status === "fulfilled") {
    content = mdResult.value.content;
    status = mdResult.value.status;
  } else {
    error = `Markdown fetch failed: ${mdResult.reason?.message || "Unknown"}`;
  }

  // Process HTML result for metadata
  if (htmlResult.status === "fulfilled") {
    const { html } = htmlResult.value;
    status = status || htmlResult.value.status;

    if (html) {
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
    }
  } else {
    if (!error) {
      error = `HTML fetch failed: ${htmlResult.reason?.message || "Unknown"}`;
    }
  }

  return { content, title, description, status, error, fetchCount };
}

async function callParallelExtractAPI(
  urls: string[],
  apiKey: string
): Promise<{
  results: Array<{
    url: string;
    full_content: string | null;
    title: string | null;
  }>;
  errors: Array<{ url: string; message: string }>;
}> {
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
