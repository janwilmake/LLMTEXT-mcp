/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
//@ts-ignore
import index from "./index.html";

export interface Env {
  FEEDCRAWLER: DurableObjectNamespace<FeedCrawler>;
  FEEDFETCHER: DurableObjectNamespace<FeedFetcher>;
}

// Max subrequests before we need to reset (leave buffer for feed discovery/parsing)
const MAX_SUBREQUESTS_PER_INVOCATION = 490;

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Homepage with form
    if (url.pathname === "/") {
      return new Response(index, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Handle /create-index - index RSS feeds from smallweb.txt
    // Pass ?apiKey=xxx to enable automatic hourly extraction
    if (url.pathname === "/create-index") {
      const isProduction = url.hostname === "rss.llmtext.com";
      const limit = isProduction ? 100 : 20;
      const apiKey = url.searchParams.get("apiKey") || undefined;
      console.log({ isProduction, limit, hasApiKey: !!apiKey });
      try {
        // Fetch the smallweb.txt file
        const resp = await fetch(
          "https://raw.githubusercontent.com/kagisearch/smallweb/refs/heads/main/smallweb.txt",
        );

        if (!resp.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch smallweb.txt" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const text = await resp.text();
        const feedUrls = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));

        const urlsToIndex = feedUrls.slice(0, limit);

        // Store each feed URL in the global storage
        const globalId = env.FEEDCRAWLER.idFromName("global");
        const globalStub = env.FEEDCRAWLER.get(globalId);

        const results: { url: string; hostname: string; status: string }[] = [];

        for (const feedUrl of urlsToIndex) {
          try {
            const feedUrlObj = new URL(feedUrl);
            const hostname = feedUrlObj.hostname;
            await globalStub.storeFeedMeta(hostname, feedUrl);

            // Enable the FeedFetcher for this hostname (with optional API key for auto-extraction)
            const fetcherId = env.FEEDFETCHER.idFromName(hostname);
            const fetcherStub = env.FEEDFETCHER.get(fetcherId);
            await fetcherStub.enable(hostname, feedUrl, apiKey);

            results.push({ url: feedUrl, hostname, status: "indexed" });
          } catch (e) {
            results.push({
              url: feedUrl,
              hostname: "",
              status: `error: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }

        return new Response(
          JSON.stringify(
            {
              environment: isProduction ? "production" : "localhost",
              total_in_file: feedUrls.length,
              indexed: results.filter((r) => r.status === "indexed").length,
              errors: results.filter((r) => r.status !== "indexed").length,
              auto_extraction: apiKey ? "enabled" : "disabled",
              results,
            },
            null,
            2,
          ),
          { headers: { "Content-Type": "application/json;charset=utf8" } },
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Handle /search/{query}
    if (url.pathname.startsWith("/search/")) {
      const query = decodeURIComponent(url.pathname.slice(8));
      if (!query) {
        return new Response("Missing search query", { status: 400 });
      }

      const globalId = env.FEEDCRAWLER.idFromName("global");
      const globalStub = env.FEEDCRAWLER.get(globalId);
      const results = await globalStub.searchKeywords(query);

      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json;charset=utf8" },
      });
    }

    // Handle /{hostname}
    const hostname = url.pathname.slice(1);
    const apiKey = url.searchParams.get("apiKey");
    const continueFrom = url.searchParams.get("continueFrom");

    if (!hostname) {
      return new Response("Missing hostname", { status: 400 });
    }

    // If no apiKey, just list posts for this hostname
    if (!apiKey) {
      const globalId = env.FEEDCRAWLER.idFromName("global");
      const globalStub = env.FEEDCRAWLER.get(globalId);
      const posts = await globalStub.getPostsByHostname(hostname);

      return new Response(JSON.stringify({ hostname, posts }, null, 2), {
        headers: { "Content-Type": "application/json;charset=utf8" },
      });
    }

    // Get per-hostname fetcher DO
    const fetcherId = env.FEEDFETCHER.idFromName(hostname);
    const fetcherStub = env.FEEDFETCHER.get(fetcherId);

    // Trigger crawl and extraction
    const result = await fetcherStub.crawlAndExtract(
      hostname,
      apiKey,
      continueFrom ? parseInt(continueFrom, 10) : 0,
    );

    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json;charset=utf8" },
    });
  },
} satisfies ExportedHandler<Env>;

interface FeedItem {
  url: string;
  title: string;
  published: string;
  updated: string;
}

interface StoredPost {
  url: string;
  hostname: string;
  title: string;
  published: string;
  updated: string;
  markdown: string;
  keywords: string;
  extracted_at: string;
}

// Global DO for storing posts and handling queries
export class FeedCrawler extends DurableObject<Env> {
  sql: SqlStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.initDB();
  }

  private initDB() {
    // Store feed metadata
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS feed_meta (
        hostname TEXT PRIMARY KEY,
        feed_url TEXT NOT NULL,
        last_crawled TEXT NOT NULL
      )
    `);

    // Store posts with their markdown content and keywords (now with hostname)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        url TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        title TEXT,
        published TEXT,
        updated TEXT,
        markdown TEXT,
        keywords TEXT DEFAULT '',
        extracted_at TEXT NOT NULL
      )
    `);

    // Index for efficient hostname queries
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_hostname ON posts(hostname)
    `);

    // Index for efficient date-based queries
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_updated ON posts(updated)
    `);

    // Index for keyword search
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_posts_keywords ON posts(keywords)
    `);
  }

  async storeFeedMeta(hostname: string, feedUrl: string): Promise<void> {
    this.sql.exec(
      `INSERT OR REPLACE INTO feed_meta (hostname, feed_url, last_crawled)
       VALUES (?, ?, ?)`,
      hostname,
      feedUrl,
      new Date().toISOString(),
    );
  }

  async getFeedMeta(hostname: string): Promise<{ feed_url: string } | null> {
    const meta = this.sql
      .exec(`SELECT feed_url FROM feed_meta WHERE hostname = ?`, hostname)
      .toArray();
    return meta.length > 0 ? { feed_url: meta[0].feed_url as string } : null;
  }

  async storePosts(posts: StoredPost[]): Promise<void> {
    for (const post of posts) {
      this.sql.exec(
        `INSERT OR REPLACE INTO posts
         (url, hostname, title, published, updated, markdown, keywords, extracted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        post.url,
        post.hostname,
        post.title,
        post.published,
        post.updated,
        post.markdown,
        post.keywords,
        post.extracted_at,
      );
    }
  }

  async getPostsByHostname(hostname: string): Promise<StoredPost[]> {
    return this.sql
      .exec(
        `SELECT url, hostname, title, published, updated, markdown, keywords, extracted_at
         FROM posts
         WHERE hostname = ?
         ORDER BY updated DESC`,
        hostname,
      )
      .toArray() as unknown as StoredPost[];
  }

  async getExistingPostUpdated(url: string): Promise<string | null> {
    const existing = this.sql
      .exec(`SELECT updated FROM posts WHERE url = ?`, url)
      .toArray();
    return existing.length > 0 ? (existing[0].updated as string) : null;
  }

  async searchKeywords(query: string): Promise<{
    query: string;
    results: StoredPost[];
  }> {
    // Search for posts where keywords contain the query (case-insensitive)
    const results = this.sql
      .exec(
        `SELECT url, hostname, title, published, updated, markdown, keywords, extracted_at
         FROM posts
         WHERE keywords LIKE ?
         ORDER BY updated DESC`,
        `%${query}%`,
      )
      .toArray() as unknown as StoredPost[];

    return { query, results };
  }
}

// Per-hostname DO for fetching with 490 subrequest limit
export class FeedFetcher extends DurableObject<Env> {
  sql: SqlStorage;
  subrequestCount: number = 0;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.initDB();
  }

  private initDB() {
    // Store pending queue for continuation
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS pending_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE,
        title TEXT,
        published TEXT,
        updated TEXT
      )
    `);

    // Store fetcher configuration
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  async enable(
    hostname: string,
    feedUrl: string,
    apiKey?: string,
  ): Promise<void> {
    // Store the configuration
    this.sql.exec(
      `INSERT OR REPLACE INTO config (key, value) VALUES ('hostname', ?)`,
      hostname,
    );
    this.sql.exec(
      `INSERT OR REPLACE INTO config (key, value) VALUES ('feed_url', ?)`,
      feedUrl,
    );
    this.sql.exec(
      `INSERT OR REPLACE INTO config (key, value) VALUES ('enabled', 'true')`,
    );
    if (apiKey) {
      this.sql.exec(
        `INSERT OR REPLACE INTO config (key, value) VALUES ('api_key', ?)`,
        apiKey,
      );
    }

    // Set an alarm to run in 1 hour for periodic crawling
    const alarmTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
    await this.ctx.storage.setAlarm(alarmTime);
  }

  async alarm(): Promise<void> {
    this.subrequestCount = 0;

    // Check if enabled
    const enabledRow = this.sql
      .exec(`SELECT value FROM config WHERE key = 'enabled'`)
      .toArray();

    if (enabledRow.length === 0 || enabledRow[0].value !== "true") {
      return;
    }

    // Get stored configuration
    const hostnameRow = this.sql
      .exec(`SELECT value FROM config WHERE key = 'hostname'`)
      .toArray();
    const feedUrlRow = this.sql
      .exec(`SELECT value FROM config WHERE key = 'feed_url'`)
      .toArray();
    const apiKeyRow = this.sql
      .exec(`SELECT value FROM config WHERE key = 'api_key'`)
      .toArray();

    if (hostnameRow.length === 0 || feedUrlRow.length === 0) {
      return;
    }

    const hostname = hostnameRow[0].value as string;
    const feedUrl = feedUrlRow[0].value as string;
    const apiKey = apiKeyRow.length > 0 ? (apiKeyRow[0].value as string) : null;

    console.log(`Alarm triggered for ${hostname}, refreshing feed`);

    try {
      // Parse the feed to get all items
      const feedItems = await this.parseFeed(feedUrl);
      console.log(`Found ${feedItems.length} feed items for ${hostname}`);

      // Filter for new or updated items
      const globalStorage = this.getGlobalStorage();
      const itemsToExtract = await this.filterNewOrUpdated(
        feedItems,
        globalStorage,
      );

      if (itemsToExtract.length === 0) {
        console.log(`All posts up to date for ${hostname}`);
      } else if (!apiKey) {
        // No API key stored - just update the pending queue for later manual extraction
        console.log(
          `${itemsToExtract.length} items need extraction for ${hostname}, but no API key configured`,
        );
        this.sql.exec(`DELETE FROM pending_queue`);
        for (const item of itemsToExtract) {
          this.sql.exec(
            `INSERT OR IGNORE INTO pending_queue (url, title, published, updated) VALUES (?, ?, ?, ?)`,
            item.url,
            item.title,
            item.published,
            item.updated,
          );
        }
      } else {
        // Extract content for new/updated items
        console.log(
          `Extracting ${itemsToExtract.length} new/updated items for ${hostname}`,
        );

        const { extracted, processedCount, needsContinuation } =
          await this.extractContentWithLimit(itemsToExtract, hostname, apiKey);

        // Store results in global storage
        await globalStorage.storePosts(extracted);
        await globalStorage.storeFeedMeta(hostname, feedUrl);

        console.log(
          `Extracted ${processedCount} items for ${hostname}${
            needsContinuation ? " (more pending)" : ""
          }`,
        );

        // Update pending queue with remaining items
        this.sql.exec(`DELETE FROM pending_queue`);
        if (needsContinuation) {
          const remainingItems = itemsToExtract.slice(processedCount);
          for (const item of remainingItems) {
            this.sql.exec(
              `INSERT OR IGNORE INTO pending_queue (url, title, published, updated) VALUES (?, ?, ?, ?)`,
              item.url,
              item.title,
              item.published,
              item.updated,
            );
          }
        }
      }
    } catch (error) {
      console.error(`Alarm error for ${hostname}:`, error);
    }

    // Schedule next alarm in 1 hour
    const nextAlarmTime = Date.now() + 60 * 60 * 1000;
    await this.ctx.storage.setAlarm(nextAlarmTime);
  }

  private async trackedFetch(
    url: string,
    options?: RequestInit,
  ): Promise<Response> {
    this.subrequestCount++;
    return fetch(url, options);
  }

  private shouldReset(): boolean {
    return this.subrequestCount >= MAX_SUBREQUESTS_PER_INVOCATION;
  }

  private getGlobalStorage(): DurableObjectStub<FeedCrawler> {
    const globalId = this.env.FEEDCRAWLER.idFromName("global");
    return this.env.FEEDCRAWLER.get(globalId);
  }

  async crawlAndExtract(
    hostname: string,
    parallelApiKey: string,
    continueFromIndex: number = 0,
  ): Promise<{
    hostname: string;
    feed_url?: string;
    posts?: StoredPost[];
    message?: string;
    error?: string;
    extracted?: number;
    total_items?: number;
    continue_from?: number;
    needs_continuation?: boolean;
  }> {
    this.subrequestCount = 0;
    const globalStorage = this.getGlobalStorage();

    try {
      let feedUrl: string;
      let feedItems: FeedItem[];

      // Check if we're continuing from a previous run
      if (continueFromIndex > 0) {
        // Get stored feed URL from global storage
        const meta = await globalStorage.getFeedMeta(hostname);

        if (!meta) {
          return {
            hostname,
            error: "No previous crawl found, please start fresh",
          };
        }

        feedUrl = meta.feed_url;

        // Get items from pending queue
        feedItems = this.sql
          .exec(
            `SELECT url, title, published, updated FROM pending_queue ORDER BY id`,
          )
          .toArray() as unknown as FeedItem[];
      } else {
        // Fresh crawl - clear pending queue
        this.sql.exec(`DELETE FROM pending_queue`);

        // Step 1: Discover RSS/Atom feed
        feedUrl = await this.discoverFeed(hostname);

        // Step 2: Parse feed and get all items
        feedItems = await this.parseFeed(feedUrl);
        console.log({ items: feedItems.length });

        // Store all items in pending queue for potential continuation
        for (const item of feedItems) {
          this.sql.exec(
            `INSERT OR IGNORE INTO pending_queue (url, title, published, updated) VALUES (?, ?, ?, ?)`,
            item.url,
            item.title,
            item.published,
            item.updated,
          );
        }
      }

      // Step 3: Check which items need extraction
      const itemsToExtract = await this.filterNewOrUpdated(
        feedItems,
        globalStorage,
      );

      if (itemsToExtract.length === 0) {
        // Clear pending queue since we're done
        this.sql.exec(`DELETE FROM pending_queue`);

        const posts = await globalStorage.getPostsByHostname(hostname);
        return {
          hostname,
          feed_url: feedUrl,
          message: "All posts are up to date",
          posts,
        };
      }

      console.log(
        `Going to extract ${itemsToExtract.length} items, starting from index ${continueFromIndex}`,
      );

      // Step 4: Extract content via Parallel API with batch limit
      const { extracted, processedCount, needsContinuation } =
        await this.extractContentWithLimit(
          itemsToExtract,
          hostname,
          parallelApiKey,
        );

      // Step 5: Store results in global storage
      await globalStorage.storePosts(extracted);

      // Update feed metadata in global storage
      await globalStorage.storeFeedMeta(hostname, feedUrl);

      // Remove processed items from pending queue
      for (const post of extracted) {
        this.sql.exec(`DELETE FROM pending_queue WHERE url = ?`, post.url);
      }

      if (needsContinuation) {
        const remainingCount = this.sql
          .exec(`SELECT COUNT(*) as count FROM pending_queue`)
          .toArray()[0].count as number;

        const posts = await globalStorage.getPostsByHostname(hostname);
        return {
          hostname,
          feed_url: feedUrl,
          total_items: feedItems.length,
          extracted: processedCount,
          needs_continuation: true,
          continue_from: continueFromIndex + processedCount,
          message: `Processed ${processedCount} items, ${remainingCount} remaining. Call again with continueFrom=${
            continueFromIndex + processedCount
          } to continue.`,
          posts,
        };
      }

      // Clear pending queue since we're done
      this.sql.exec(`DELETE FROM pending_queue`);

      const posts = await globalStorage.getPostsByHostname(hostname);
      return {
        hostname,
        feed_url: feedUrl,
        total_items: feedItems.length,
        extracted: itemsToExtract.length,
        posts,
      };
    } catch (error) {
      return {
        hostname,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async discoverFeed(hostname: string): Promise<string> {
    // Try common RSS/Atom feed locations
    const commonPaths = [
      "/feed",
      "/rss",
      "/atom",
      "/feed.xml",
      "/rss.xml",
      "/atom.xml",
      "/index.xml",
      "/feeds/posts/default",
    ];

    // First, try to find feed links in the HTML
    try {
      const htmlResp = await this.trackedFetch(`http://${hostname}`, {
        headers: { "User-Agent": "FeedCrawler/1.0" },
      });

      if (htmlResp.ok) {
        const html = await htmlResp.text();
        const feedLinkMatch = html.match(
          /<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i,
        );

        if (feedLinkMatch) {
          const feedUrl = feedLinkMatch[2];
          return feedUrl.startsWith("http")
            ? feedUrl
            : `http://${hostname}${feedUrl}`;
        }
      }
    } catch (e) {
      // Continue to try common paths
    }

    // Try common paths
    for (const path of commonPaths) {
      if (this.shouldReset()) {
        throw new Error(
          "Subrequest limit approaching during feed discovery. Try again.",
        );
      }

      const url = `http://${hostname}${path}`;
      try {
        const resp = await this.trackedFetch(url, {
          headers: { "User-Agent": "FeedCrawler/1.0" },
        });

        if (resp.ok) {
          const text = await resp.text();
          if (text.includes("<rss") || text.includes("<feed")) {
            return url;
          }
        }
      } catch (e) {
        continue;
      }
    }

    throw new Error(`No RSS or Atom feed found for ${hostname}`);
  }

  private async parseFeed(feedUrl: string): Promise<FeedItem[]> {
    const items: FeedItem[] = [];
    let currentUrl: string | null = feedUrl;

    // Crawl through all pages of the feed
    while (currentUrl) {
      if (this.shouldReset()) {
        // Return what we have so far
        console.log("Subrequest limit approaching during feed parsing");
        break;
      }

      const resp = await this.trackedFetch(currentUrl, {
        headers: { "User-Agent": "FeedCrawler/1.0" },
      });

      if (!resp.ok) {
        throw new Error(`Failed to fetch feed: ${resp.status}`);
      }

      const xml = await resp.text();
      const pageItems = this.parseXML(xml);
      items.push(...pageItems);

      // Check for next page link (Atom pagination)
      currentUrl = this.findNextPage(xml, currentUrl);
    }

    return items;
  }

  private parseXML(xml: string): FeedItem[] {
    const items: FeedItem[] = [];

    // Check if RSS or Atom
    const isAtom = xml.includes("<feed");

    if (isAtom) {
      // Parse Atom feed
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1];
        const url = this.extractTag(entry, "link", "href") || "";
        const title = this.extractTag(entry, "title") || "";
        const published = this.extractTag(entry, "published") || "";
        const updated = this.extractTag(entry, "updated") || published;

        if (url) {
          items.push({ url, title, published, updated });
        }
      }
    } else {
      // Parse RSS feed
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const item = match[1];
        const url = this.extractTag(item, "link") || "";
        const title = this.extractTag(item, "title") || "";
        const pubDate = this.extractTag(item, "pubDate") || "";
        const updated = this.extractTag(item, "updated") || pubDate;

        if (url) {
          items.push({
            url,
            title,
            published: pubDate,
            updated,
          });
        }
      }
    }

    return items;
  }

  private extractTag(xml: string, tag: string, attr?: string): string {
    if (attr) {
      const regex = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, "i");
      const match = xml.match(regex);
      return match ? match[1] : "";
    }

    const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i");
    const match = xml.match(regex);
    return match ? match[1].trim() : "";
  }

  private findNextPage(xml: string, _currentUrl: string): string | null {
    // Look for Atom next link
    const nextLinkMatch = xml.match(
      /<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i,
    );

    if (nextLinkMatch) {
      return nextLinkMatch[1];
    }

    return null;
  }

  private async filterNewOrUpdated(
    items: FeedItem[],
    globalStorage: DurableObjectStub<FeedCrawler>,
  ): Promise<FeedItem[]> {
    const toExtract: FeedItem[] = [];

    for (const item of items) {
      const existingUpdated = await globalStorage.getExistingPostUpdated(
        item.url,
      );

      if (existingUpdated === null) {
        // New post
        toExtract.push(item);
      } else if (item.updated && item.updated > existingUpdated) {
        // Updated post
        toExtract.push(item);
      }
    }

    return toExtract;
  }

  private extractMetaKeywords(html: string): string {
    // Try to extract meta keywords
    const keywordsMatch = html.match(
      /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i,
    );
    if (keywordsMatch) {
      return keywordsMatch[1];
    }

    // Try alternate order (content before name)
    const altMatch = html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i,
    );
    if (altMatch) {
      return altMatch[1];
    }

    return "";
  }

  private async extractContentWithLimit(
    items: FeedItem[],
    hostname: string,
    apiKey: string,
  ): Promise<{
    extracted: StoredPost[];
    processedCount: number;
    needsContinuation: boolean;
  }> {
    const results: StoredPost[] = [];
    let processedCount = 0;

    // Process in batches of 10 (Parallel API limit)
    for (let i = 0; i < items.length; i += 10) {
      // Check if we should stop due to subrequest limit
      // Each batch uses 1 API call + potentially fetching pages for keywords
      if (this.shouldReset()) {
        console.log(
          `Stopping at batch ${i} due to subrequest limit (${this.subrequestCount} requests made)`,
        );
        return {
          extracted: results,
          processedCount,
          needsContinuation: i < items.length,
        };
      }

      const batch = items.slice(i, i + 10);
      const urls = batch.map((item) => item.url);

      console.log(`Processing batch ${i / 10 + 1}: ${batch.length} items`);

      try {
        const resp = await this.trackedFetch(
          "https://api.parallel.ai/v1beta/extract",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "parallel-beta": "search-extract-2025-10-10",
            },
            body: JSON.stringify({
              urls: urls,
              full_content: true,
              excerpts: false,
            }),
          },
        );

        if (!resp.ok) {
          const error = await resp.text();
          throw new Error(`Parallel API error: ${error}`);
        }

        const data = (await resp.json()) as {
          results: Array<{
            url: string;
            title?: string;
            full_content?: string;
            html?: string;
          }>;
        };

        // Now fetch each page to extract keywords (if we have room)
        for (const result of data.results) {
          const item = items.find((i) => i.url === result.url);
          if (item && result.full_content) {
            let keywords = "";

            // Try to extract keywords from the page HTML
            if (!this.shouldReset()) {
              try {
                const pageResp = await this.trackedFetch(result.url, {
                  headers: { "User-Agent": "FeedCrawler/1.0" },
                });
                if (pageResp.ok) {
                  const pageHtml = await pageResp.text();
                  keywords = this.extractMetaKeywords(pageHtml);
                }
              } catch (e) {
                // Ignore keyword extraction errors
                console.log(`Failed to extract keywords from ${result.url}`);
              }
            }

            results.push({
              url: result.url,
              hostname,
              title: result.title || item.title,
              published: item.published,
              updated: item.updated,
              markdown: result.full_content,
              keywords,
              extracted_at: new Date().toISOString(),
            });
            processedCount++;
          }
        }
      } catch (error) {
        console.error(`Batch extraction error:`, error);
        // Continue with other batches
      }
    }

    return {
      extracted: results,
      processedCount,
      needsContinuation: false,
    };
  }
}
