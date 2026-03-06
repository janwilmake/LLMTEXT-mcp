/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

/**
 * Cloudflare Worker for crawling and parsing site indexes
 * Parses robots.txt, sitemaps, RSS feeds, and llms.txt files
 */

export interface Env {}

interface RobotsRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
  sitemaps: string[];
}

interface ParsedRobotsTxt {
  rules: RobotsRule[];
  sitemaps: string[];
  host?: string;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

interface SitemapIndex {
  type: "index";
  sitemaps: { loc: string; lastmod?: string }[];
}

interface SitemapUrlset {
  type: "urlset";
  urls: SitemapEntry[];
}

type ParsedSitemap = SitemapIndex | SitemapUrlset;

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

interface ParsedRSS {
  title?: string;
  link?: string;
  description?: string;
  lastBuildDate?: string;
  items: RSSItem[];
}

interface FileEntry {
  name: string;
  url: string;
  notes?: string;
}

interface Section {
  name: string;
  files: FileEntry[];
}

interface LlmsTxtFile {
  title: string;
  description?: string;
  details?: string;
  sections: Section[];
}

interface AllowedResult {
  allowed: boolean;
  reason: string;
  matchedRule?: string;
}

interface RefreshRecommendation {
  recommendedRefreshHours: number;
  reason: string;
  factors: string[];
}

interface CrawlResult {
  domain: string;
  userAgent: string;
  timestamp: string;
  robotsTxt: {
    raw?: string;
    parsed?: ParsedRobotsTxt;
    error?: string;
  };
  allowedToScrape: AllowedResult;
  sitemaps: {
    url: string;
    parsed?: ParsedSitemap;
    error?: string;
  }[];
  rssFeeds: {
    url: string;
    parsed?: ParsedRSS;
    error?: string;
  }[];
  llmsTxt: {
    url: string;
    parsed?: LlmsTxtFile;
    error?: string;
  }[];
  refreshRecommendation: RefreshRecommendation;
  fetchCount: number;
  maxFetches: number;
}

const MAX_FETCHES = 1000;
const DEFAULT_USER_AGENT = "*";

// Common RSS feed paths to check
const COMMON_RSS_PATHS = [
  "/feed",
  "/feed.xml",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/feed/atom",
  "/index.xml",
  "/blog/feed",
  "/blog/rss",
  "/news/feed"
];

// Common llms.txt paths
const LLMS_TXT_PATHS = ["/llms.txt", "/docs/llms.txt", "/.well-known/llms.txt"];

/**
 * Parse robots.txt content into structured format
 */
function parseRobotsTxt(content: string): ParsedRobotsTxt {
  const lines = content.split("\n").map((l) => l.trim());
  const result: ParsedRobotsTxt = {
    rules: [],
    sitemaps: []
  };

  let currentRule: RobotsRule | null = null;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const directive = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    switch (directive) {
      case "user-agent":
        if (currentRule) {
          result.rules.push(currentRule);
        }
        currentRule = {
          userAgent: value,
          allow: [],
          disallow: [],
          sitemaps: []
        };
        break;

      case "allow":
        if (currentRule && value) {
          currentRule.allow.push(value);
        }
        break;

      case "disallow":
        if (currentRule && value) {
          currentRule.disallow.push(value);
        }
        break;

      case "crawl-delay":
        if (currentRule) {
          const delay = parseFloat(value);
          if (!isNaN(delay)) {
            currentRule.crawlDelay = delay;
          }
        }
        break;

      case "sitemap":
        result.sitemaps.push(value);
        if (currentRule) {
          currentRule.sitemaps.push(value);
        }
        break;

      case "host":
        result.host = value;
        break;
    }
  }

  if (currentRule) {
    result.rules.push(currentRule);
  }

  return result;
}

/**
 * Check if scraping is allowed for a given user agent
 */
function checkAllowed(
  robots: ParsedRobotsTxt | null,
  userAgent: string
): AllowedResult {
  if (!robots) {
    return {
      allowed: true,
      reason: "No robots.txt found, assuming allowed"
    };
  }

  // Find matching rule - first try exact match, then wildcard
  let matchingRule = robots.rules.find(
    (r) => r.userAgent.toLowerCase() === userAgent.toLowerCase()
  );

  if (!matchingRule) {
    matchingRule = robots.rules.find((r) => r.userAgent === "*");
  }

  if (!matchingRule) {
    return {
      allowed: true,
      reason: "No matching user-agent rule found, assuming allowed"
    };
  }

  // Check for blanket disallow
  const hasDisallowAll = matchingRule.disallow.some((d) => d === "/");
  const hasAllowRoot = matchingRule.allow.some(
    (a) => a === "/" || a === "/*" || a === ""
  );

  if (hasDisallowAll && !hasAllowRoot) {
    return {
      allowed: false,
      reason: `Disallow: / rule found for user-agent "${matchingRule.userAgent}"`,
      matchedRule: `User-agent: ${matchingRule.userAgent}\nDisallow: /`
    };
  }

  // Check for AI-specific blocks
  const aiBlockPatterns = [
    "GPTBot",
    "ChatGPT",
    "CCBot",
    "anthropic",
    "Claude",
    "Google-Extended"
  ];
  const isAiAgent = aiBlockPatterns.some(
    (p) =>
      userAgent.toLowerCase().includes(p.toLowerCase()) ||
      matchingRule!.userAgent.toLowerCase().includes(p.toLowerCase())
  );

  if (isAiAgent && hasDisallowAll) {
    return {
      allowed: false,
      reason: `AI bot "${userAgent}" appears to be blocked`,
      matchedRule: `User-agent: ${matchingRule.userAgent}\nDisallow: /`
    };
  }

  return {
    allowed: true,
    reason: `Allowed based on rules for user-agent "${matchingRule.userAgent}"`,
    matchedRule: `User-agent: ${matchingRule.userAgent}\nAllow: ${
      matchingRule.allow.join(", ") || "(default)"
    }\nDisallow: ${matchingRule.disallow.join(", ") || "(none)"}`
  };
}

/**
 * Parse XML sitemap content
 */
function parseSitemap(content: string): ParsedSitemap {
  // Check if it's a sitemap index
  if (content.includes("<sitemapindex")) {
    const sitemaps: { loc: string; lastmod?: string }[] = [];
    const sitemapMatches = content.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g);

    for (const match of sitemapMatches) {
      const sitemapContent = match[1];
      const locMatch = sitemapContent.match(/<loc>(.*?)<\/loc>/);
      const lastmodMatch = sitemapContent.match(/<lastmod>(.*?)<\/lastmod>/);

      if (locMatch) {
        sitemaps.push({
          loc: locMatch[1].trim(),
          lastmod: lastmodMatch ? lastmodMatch[1].trim() : undefined
        });
      }
    }

    return { type: "index", sitemaps };
  }

  // Regular urlset sitemap
  const urls: SitemapEntry[] = [];
  const urlMatches = content.matchAll(/<url>([\s\S]*?)<\/url>/g);

  for (const match of urlMatches) {
    const urlContent = match[1];
    const locMatch = urlContent.match(/<loc>(.*?)<\/loc>/);

    if (locMatch) {
      const entry: SitemapEntry = {
        loc: locMatch[1].trim()
      };

      const lastmodMatch = urlContent.match(/<lastmod>(.*?)<\/lastmod>/);
      if (lastmodMatch) entry.lastmod = lastmodMatch[1].trim();

      const changefreqMatch = urlContent.match(
        /<changefreq>(.*?)<\/changefreq>/
      );
      if (changefreqMatch) entry.changefreq = changefreqMatch[1].trim();

      const priorityMatch = urlContent.match(/<priority>(.*?)<\/priority>/);
      if (priorityMatch) entry.priority = parseFloat(priorityMatch[1]);

      urls.push(entry);
    }
  }

  return { type: "urlset", urls };
}

/**
 * Parse RSS/Atom feed content
 */
function parseRSS(content: string): ParsedRSS {
  const result: ParsedRSS = { items: [] };

  // Try RSS 2.0 format first
  if (content.includes("<rss") || content.includes("<channel>")) {
    const titleMatch = content.match(/<channel>[\s\S]*?<title>(.*?)<\/title>/);
    if (titleMatch) result.title = decodeXMLEntities(titleMatch[1]);

    const linkMatch = content.match(/<channel>[\s\S]*?<link>(.*?)<\/link>/);
    if (linkMatch) result.link = linkMatch[1].trim();

    const descMatch = content.match(
      /<channel>[\s\S]*?<description>(.*?)<\/description>/
    );
    if (descMatch) result.description = decodeXMLEntities(descMatch[1]);

    const lastBuildMatch = content.match(
      /<lastBuildDate>(.*?)<\/lastBuildDate>/
    );
    if (lastBuildMatch) result.lastBuildDate = lastBuildMatch[1].trim();

    const itemMatches = content.matchAll(/<item>([\s\S]*?)<\/item>/g);
    for (const match of itemMatches) {
      const itemContent = match[1];
      const item: RSSItem = {};

      const itemTitle = itemContent.match(/<title>(.*?)<\/title>/);
      if (itemTitle) item.title = decodeXMLEntities(itemTitle[1]);

      const itemLink = itemContent.match(/<link>(.*?)<\/link>/);
      if (itemLink) item.link = itemLink[1].trim();

      const itemDesc = itemContent.match(/<description>(.*?)<\/description>/s);
      if (itemDesc) item.description = decodeXMLEntities(itemDesc[1]);

      const itemPubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
      if (itemPubDate) item.pubDate = itemPubDate[1].trim();

      const itemGuid = itemContent.match(/<guid.*?>(.*?)<\/guid>/);
      if (itemGuid) item.guid = itemGuid[1].trim();

      result.items.push(item);
    }
  }
  // Try Atom format
  else if (content.includes("<feed")) {
    const titleMatch = content.match(/<title.*?>(.*?)<\/title>/);
    if (titleMatch) result.title = decodeXMLEntities(titleMatch[1]);

    const linkMatch = content.match(/<link.*?href="(.*?)"/);
    if (linkMatch) result.link = linkMatch[1];

    const subtitleMatch = content.match(/<subtitle.*?>(.*?)<\/subtitle>/);
    if (subtitleMatch) result.description = decodeXMLEntities(subtitleMatch[1]);

    const updatedMatch = content.match(/<updated>(.*?)<\/updated>/);
    if (updatedMatch) result.lastBuildDate = updatedMatch[1].trim();

    const entryMatches = content.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entryContent = match[1];
      const item: RSSItem = {};

      const entryTitle = entryContent.match(/<title.*?>(.*?)<\/title>/);
      if (entryTitle) item.title = decodeXMLEntities(entryTitle[1]);

      const entryLink = entryContent.match(/<link.*?href="(.*?)"/);
      if (entryLink) item.link = entryLink[1];

      const entrySummary = entryContent.match(/<summary.*?>(.*?)<\/summary>/s);
      if (entrySummary) item.description = decodeXMLEntities(entrySummary[1]);

      const entryPublished = entryContent.match(
        /<published>(.*?)<\/published>/
      );
      if (entryPublished) item.pubDate = entryPublished[1].trim();

      const entryId = entryContent.match(/<id>(.*?)<\/id>/);
      if (entryId) item.guid = entryId[1].trim();

      result.items.push(item);
    }
  }

  return result;
}

/**
 * Decode XML entities
 */
function decodeXMLEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

/**
 * Parse llms.txt content (inline implementation)
 */
function parseLlmsTxtContent(markdown: string): LlmsTxtFile {
  const lines = markdown.split("\n");

  const result: LlmsTxtFile = {
    title: "",
    sections: []
  };

  let currentSection: Section | null = null;
  let detailsParts: string[] = [];
  let foundFirstH2 = false;
  let inBlockquote = false;
  let blockquoteLines: string[] = [];

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
      continue;
    } else if (inBlockquote) {
      result.description = blockquoteLines.join(" ").trim();
      inBlockquote = false;
      blockquoteLines = [];

      if (line.startsWith("## ")) {
        foundFirstH2 = true;
        currentSection = {
          name: line.substring(3).trim(),
          files: []
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

      if (currentSection) {
        result.sections.push(currentSection);
      }

      currentSection = {
        name: line.substring(3).trim(),
        files: []
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
      const content = line.substring(2).trim();
      const linkMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);

      if (linkMatch) {
        const name = linkMatch[1];
        const url = linkMatch[2];
        const afterLink = content.substring(
          linkMatch.index! + linkMatch[0].length
        );
        const colonMatch = afterLink.match(/:\s*(.+)/);

        const fileEntry: FileEntry = {
          name: name.trim(),
          url: url.trim()
        };

        if (colonMatch) {
          fileEntry.notes = colonMatch[1].trim();
        }

        currentSection.files.push(fileEntry);
      }
    }
  }

  if (currentSection) {
    result.sections.push(currentSection);
  }

  if (detailsParts.length > 0) {
    result.details = detailsParts.join("\n").trim();
  }

  return result;
}

/**
 * Calculate refresh recommendation based on gathered data
 */
function calculateRefreshRecommendation(
  robots: ParsedRobotsTxt | null,
  sitemaps: { parsed?: ParsedSitemap }[],
  rssFeeds: { parsed?: ParsedRSS }[]
): RefreshRecommendation {
  const factors: string[] = [];
  let recommendedHours = 24; // Default to daily

  // Check crawl delay
  if (robots) {
    const maxCrawlDelay = Math.max(
      ...robots.rules.map((r) => r.crawlDelay || 0)
    );
    if (maxCrawlDelay > 0) {
      factors.push(`Crawl delay specified: ${maxCrawlDelay}s`);
      recommendedHours = Math.max(recommendedHours, maxCrawlDelay / 3600);
    }
  }

  // Check sitemap changefreq
  for (const sitemap of sitemaps) {
    if (sitemap.parsed?.type === "urlset") {
      const changefreqs = sitemap.parsed.urls
        .map((u) => u.changefreq)
        .filter(Boolean);

      if (changefreqs.includes("hourly")) {
        recommendedHours = Math.min(recommendedHours, 1);
        factors.push("Sitemap indicates hourly updates");
      } else if (changefreqs.includes("daily")) {
        recommendedHours = Math.min(recommendedHours, 24);
        factors.push("Sitemap indicates daily updates");
      } else if (changefreqs.includes("weekly")) {
        recommendedHours = Math.min(recommendedHours, 168);
        factors.push("Sitemap indicates weekly updates");
      }
    }
  }

  // Check RSS feed freshness
  for (const feed of rssFeeds) {
    if (feed.parsed?.items.length) {
      const dates = feed.parsed.items
        .map((i) => i.pubDate)
        .filter(Boolean)
        .map((d) => new Date(d!).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => b - a);

      if (dates.length >= 2) {
        const avgGap = (dates[0] - dates[dates.length - 1]) / dates.length;
        const avgGapHours = avgGap / (1000 * 60 * 60);
        if (avgGapHours > 0 && avgGapHours < recommendedHours) {
          recommendedHours = Math.ceil(avgGapHours);
          factors.push(
            `RSS feed average update interval: ${avgGapHours.toFixed(1)}h`
          );
        }
      }
    }
  }

  // Cap at reasonable bounds
  recommendedHours = Math.max(1, Math.min(recommendedHours, 168)); // 1 hour to 1 week

  return {
    recommendedRefreshHours: recommendedHours,
    reason:
      factors.length > 0
        ? "Based on site signals"
        : "Default recommendation (no signals found)",
    factors
  };
}

/**
 * Safe fetch with timeout and error handling
 */
async function safeFetch(
  url: string,
  fetchCount: { count: number }
): Promise<{ content: string | null; error?: string }> {
  if (fetchCount.count >= MAX_FETCHES) {
    return { content: null, error: "Max fetch limit reached" };
  }

  fetchCount.count++;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SiteCrawler/1.0 (Index Crawler)"
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { content: null, error: `HTTP ${response.status}` };
    }

    const content = await response.text();
    return { content };
  } catch (error) {
    return {
      content: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Main crawl function
 */
async function crawlDomain(
  domainName: string,
  userAgent: string
): Promise<CrawlResult> {
  const fetchCount = { count: 0 };
  const baseUrl = domainName.startsWith("http")
    ? domainName
    : `https://${domainName}`;

  const result: CrawlResult = {
    domain: domainName,
    userAgent,
    timestamp: new Date().toISOString(),
    robotsTxt: {},
    allowedToScrape: { allowed: true, reason: "Not yet checked" },
    sitemaps: [],
    rssFeeds: [],
    llmsTxt: [],
    refreshRecommendation: {
      recommendedRefreshHours: 24,
      reason: "Default",
      factors: []
    },
    fetchCount: 0,
    maxFetches: MAX_FETCHES
  };

  // 1. Fetch and parse robots.txt
  const robotsUrl = new URL("/robots.txt", baseUrl).href;
  const robotsResult = await safeFetch(robotsUrl, fetchCount);

  if (robotsResult.content) {
    result.robotsTxt.raw = robotsResult.content;
    result.robotsTxt.parsed = parseRobotsTxt(robotsResult.content);
    result.allowedToScrape = checkAllowed(result.robotsTxt.parsed, userAgent);
  } else {
    result.robotsTxt.error = robotsResult.error;
    result.allowedToScrape = {
      allowed: true,
      reason: "No robots.txt found, assuming allowed"
    };
  }

  // 2. Collect sitemap URLs
  const sitemapUrls = new Set<string>();

  // From robots.txt
  if (result.robotsTxt.parsed) {
    for (const url of result.robotsTxt.parsed.sitemaps) {
      sitemapUrls.add(url);
    }
  }

  // Default sitemap location
  sitemapUrls.add(new URL("/sitemap.xml", baseUrl).href);
  sitemapUrls.add(new URL("/sitemap_index.xml", baseUrl).href);

  // 3. Fetch and parse sitemaps (limited depth - don't follow sitemap indexes deeply)
  const processedSitemaps = new Set<string>();

  for (const sitemapUrl of sitemapUrls) {
    if (processedSitemaps.has(sitemapUrl)) continue;
    if (fetchCount.count >= MAX_FETCHES) break;

    processedSitemaps.add(sitemapUrl);
    const sitemapResult = await safeFetch(sitemapUrl, fetchCount);

    if (sitemapResult.content) {
      try {
        const parsed = parseSitemap(sitemapResult.content);
        result.sitemaps.push({ url: sitemapUrl, parsed });

        // If it's an index, add child sitemaps to queue (but don't deeply recurse)
        if (parsed.type === "index" && result.sitemaps.length < 50) {
          for (const child of parsed.sitemaps.slice(0, 20)) {
            sitemapUrls.add(child.loc);
          }
        }
      } catch (e) {
        result.sitemaps.push({
          url: sitemapUrl,
          error: e instanceof Error ? e.message : "Parse error"
        });
      }
    } else if (sitemapResult.error && sitemapResult.error !== "HTTP 404") {
      result.sitemaps.push({ url: sitemapUrl, error: sitemapResult.error });
    }
  }

  // 4. Look for RSS feeds
  const rssUrls = new Set<string>();

  // Check common RSS paths
  for (const path of COMMON_RSS_PATHS) {
    rssUrls.add(new URL(path, baseUrl).href);
  }

  for (const rssUrl of rssUrls) {
    if (fetchCount.count >= MAX_FETCHES) break;

    const rssResult = await safeFetch(rssUrl, fetchCount);

    if (
      rssResult.content &&
      (rssResult.content.includes("<rss") ||
        rssResult.content.includes("<feed") ||
        rssResult.content.includes("<channel>"))
    ) {
      try {
        const parsed = parseRSS(rssResult.content);
        if (parsed.items.length > 0 || parsed.title) {
          result.rssFeeds.push({ url: rssUrl, parsed });
        }
      } catch (e) {
        result.rssFeeds.push({
          url: rssUrl,
          error: e instanceof Error ? e.message : "Parse error"
        });
      }
    }
  }

  // 5. Look for llms.txt
  for (const path of LLMS_TXT_PATHS) {
    if (fetchCount.count >= MAX_FETCHES) break;

    const llmsUrl = new URL(path, baseUrl).href;
    const llmsResult = await safeFetch(llmsUrl, fetchCount);

    if (llmsResult.content && llmsResult.content.includes("#")) {
      try {
        const parsed = parseLlmsTxtContent(llmsResult.content);
        if (parsed.title) {
          result.llmsTxt.push({ url: llmsUrl, parsed });
        }
      } catch (e) {
        result.llmsTxt.push({
          url: llmsUrl,
          error: e instanceof Error ? e.message : "Parse error"
        });
      }
    }
  }

  // 6. Calculate refresh recommendation
  result.refreshRecommendation = calculateRefreshRecommendation(
    result.robotsTxt.parsed || null,
    result.sitemaps,
    result.rssFeeds
  );

  result.fetchCount = fetchCount.count;

  return result;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    let userAgent = url.searchParams.get("userAgent") || DEFAULT_USER_AGENT;

    // Also support path-based domain: /crawl/example.com
    const domain = url.pathname.slice("/crawl/".length);
    // Replace the 404 response around line 447 with:
    if (!url.pathname.startsWith("/crawl/") || !domain) {
      return new Response(
        `Site Index Crawler API

Usage: GET /crawl/{domain}

Examples:
  /crawl/example.com
  /crawl/github.com?userAgent=GPTBot

Options:
  ?userAgent=<agent>  Check rules for specific bot (default: *)

For more details on the response format, check /openapi.html or /openapi.json
`,
        {
          status: 404,
          headers: {
            "Content-Type": "text/plain"
          }
        }
      );
    }
    console.log({ domain, userAgent });

    try {
      const result = await crawlDomain(domain, userAgent);

      return new Response(JSON.stringify(result, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Crawl failed",
          message: error instanceof Error ? error.message : "Unknown error",
          domain
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
  }
};
