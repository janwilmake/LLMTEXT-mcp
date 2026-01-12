/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";

export interface Env {
  DomainDO: DurableObjectNamespace<DomainDO>;
  PARALLEL_API_KEY?: string;
}

interface CrawlOptions {
  maxAge?: number;
  staleWhileRevalidate?: number;
  depth?: number;
  path?: string;
  async?: "none" | "links" | "all";
  strategy?: "links" | "path";
}

interface Document {
  url: string;
  title: string | null;
  author: string | null;
  description: string | null;
  created_at: string | null;
  modified_at: string | null;
  icon: string | null;
  index_created_at: string;
  index_updated_at: string;
  index_fetched_at: string;
  etag: string | null;
  metadata: string | null;
  size: number;
  content: string;
  links: string;
  visits: number;
}

interface CrawlResult {
  url: string;
  title?: string;
  content: string;
  links: string[];
  cached: boolean;
  source: "cache" | "llms-txt" | "markdown-accept" | "extract";
}

// CORS headers helper
function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

// Helper to add CORS headers to any response
function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(getCorsHeaders()).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Handle OPTIONS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(),
      });
    }

    const url = new URL(request.url);

    if (
      url.pathname.match(/^\/([^\/]+)\/llms\.txt$/) &&
      request.method === "GET"
    ) {
      const hostname = url.pathname.split("/")[1];

      try {
        const domainDO = env.DomainDO.get(env.DomainDO.idFromName(hostname));

        // Get all documents for this domain
        const documents = await domainDO.getAllDocuments();

        if (!documents || documents.length === 0) {
          return new Response(
            `# ${hostname}\n\n> No documents currently indexed for this domain.\n\n## Note\n\nThis llms.txt file is automatically generated from our crawler's index and may not be complete. The website owner should ideally provide their own official llms.txt file.`,
            {
              status: 404,
              headers: {
                ...getCorsHeaders(),
                "Content-Type": "text/plain; charset=utf-8",
                "X-Generated": "true",
              },
            },
          );
        }

        // Generate llms.txt content
        let content = `# ${hostname}\n\n`;
        content += `> Automatically generated index of ${
          documents.length
        } crawled document${
          documents.length !== 1 ? "s" : ""
        } from ${hostname}.\n\n`;
        content += `**⚠️ Important:** This llms.txt file is auto-generated from our crawler's index and may be incomplete or outdated. The website owner should provide their own official llms.txt file at https://${hostname}/llms.txt for accurate and complete documentation.\n\n`;

        // Group documents by path prefix for better organization
        const pathGroups = new Map<string, typeof documents>();

        for (const doc of documents) {
          try {
            const docUrl = new URL(doc.url);
            const pathParts = docUrl.pathname.split("/").filter((p) => p);
            const section = pathParts.length > 0 ? pathParts[0] : "root";

            if (!pathGroups.has(section)) {
              pathGroups.set(section, []);
            }
            pathGroups.get(section)!.push(doc);
          } catch {
            if (!pathGroups.has("other")) {
              pathGroups.set("other", []);
            }
            pathGroups.get("other")!.push(doc);
          }
        }

        // Generate sections
        for (const [section, docs] of pathGroups) {
          const sectionTitle =
            section.charAt(0).toUpperCase() + section.slice(1);
          content += `## ${sectionTitle}\n\n`;

          for (const doc of docs.slice(0, 50)) {
            // Limit to 50 docs per section
            const title = doc.title || new URL(doc.url).pathname;
            const description = doc.description
              ? `: ${doc.description.slice(0, 100)}${
                  doc.description.length > 100 ? "..." : ""
                }`
              : "";
            content += `- [${title}](${doc.url})${description}\n`;
          }

          if (docs.length > 50) {
            content += `- *(${
              docs.length - 50
            } more documents available in this section)*\n`;
          }
          content += `\n`;
        }

        return new Response(content, {
          headers: {
            ...getCorsHeaders(),
            "Content-Type": "text/plain; charset=utf-8",
            "X-Generated": "true",
            "X-Document-Count": documents.length.toString(),
          },
        });
      } catch (error) {
        return new Response(
          `# ${hostname}\n\n> Error generating llms.txt: ${
            error instanceof Error ? error.message : "Unknown error"
          }\n\n## Note\n\nThis llms.txt file is automatically generated and an error occurred. The website owner should provide their own official llms.txt file.`,
          {
            status: 500,
            headers: {
              ...getCorsHeaders(),
              "Content-Type": "text/plain; charset=utf-8",
              "X-Generated": "true",
            },
          },
        );
      }
    }

    if (url.pathname === "/crawl" && request.method === "POST") {
      const body = (await request.json()) as {
        url: string;
        options?: CrawlOptions;
      };
      const targetUrl = body.url;
      const options = body.options || {};

      if (!targetUrl) {
        return new Response(JSON.stringify({ error: "url is required" }), {
          status: 400,
          headers: {
            ...getCorsHeaders(),
            "Content-Type": "application/json",
          },
        });
      }

      const accept = request.headers.get("Accept") || "application/json";
      const apiKey =
        request.headers.get("Authorization")?.replace("Bearer ", "") ||
        env.PARALLEL_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "PARALLEL_API_KEY required" }),
          {
            status: 401,
            headers: {
              ...getCorsHeaders(),
              "Content-Type": "application/json",
            },
          },
        );
      }

      const parsed = new URL(targetUrl);
      const domain = parsed.hostname;
      const domainDO = env.DomainDO.get(env.DomainDO.idFromName(domain));

      if (accept.includes("text/event-stream")) {
        return domainDO.crawlSSE(targetUrl, options, apiKey);
      } else if (accept.includes("multipart/form-data")) {
        return domainDO.crawlMultipart(targetUrl, options, apiKey);
      } else if (accept.includes("text/markdown")) {
        return domainDO.crawlMarkdown(targetUrl, options, apiKey);
      } else {
        return domainDO.crawlJSON(targetUrl, options, apiKey);
      }
    }

    return new Response("POST /crawl with { url, options }", {
      status: 404,
      headers: getCorsHeaders(),
    });
  },
} satisfies ExportedHandler<Env>;

export class DomainDO extends DurableObject<Env> {
  sql: SqlStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.initSchema();
  }

  private initSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        url TEXT PRIMARY KEY,
        title TEXT,
        author TEXT,
        description TEXT,
        created_at TEXT,
        modified_at TEXT,
        icon TEXT,
        index_created_at TEXT NOT NULL,
        index_updated_at TEXT NOT NULL,
        index_fetched_at TEXT NOT NULL,
        etag TEXT,
        metadata TEXT,
        size INTEGER NOT NULL,
        content TEXT NOT NULL,
        links TEXT NOT NULL,
        visits INTEGER DEFAULT 0
      )
    `);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_url_path ON documents(url)`);
  }

  private getDocument(url: string): Document | null {
    const results = this.sql
      //@ts-ignore
      .exec<Document>(`SELECT * FROM documents WHERE url = ?`, url)
      .toArray();
    return results[0] || null;
  }

  private saveDocument(
    doc: Partial<Omit<Document, "url" | "content" | "links">> & {
      url: string;
      content: string;
      links: string[];
    },
  ) {
    const now = new Date().toISOString();
    const existing = this.getDocument(doc.url);
    const linksJson = JSON.stringify(doc.links);

    if (existing) {
      this.sql.exec(
        `
        UPDATE documents SET
          title = ?, content = ?, links = ?, size = ?,
          index_updated_at = ?, index_fetched_at = ?, visits = visits + 1
        WHERE url = ?
      `,
        doc.title || null,
        doc.content,
        linksJson,
        doc.content.length,
        now,
        now,
        doc.url,
      );
    } else {
      this.sql.exec(
        `
        INSERT INTO documents (url, title, content, links, size, index_created_at, index_updated_at, index_fetched_at, visits)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
        doc.url,
        doc.title || null,
        doc.content,
        linksJson,
        doc.content.length,
        now,
        now,
        now,
      );
    }
  }

  private isFresh(doc: Document, maxAge: number): boolean {
    const fetchedAt = new Date(doc.index_fetched_at).getTime();
    return Date.now() - fetchedAt < maxAge * 1000;
  }

  private isStaleButUsable(
    doc: Document,
    maxAge: number,
    staleWhileRevalidate: number,
  ): boolean {
    const fetchedAt = new Date(doc.index_fetched_at).getTime();
    const age = Date.now() - fetchedAt;
    return age >= maxAge * 1000 && age < (maxAge + staleWhileRevalidate) * 1000;
  }

  private extractLinks(content: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      try {
        const href = match[2];
        if (href.startsWith("http")) {
          links.push(href);
        } else if (href.startsWith("/")) {
          const base = new URL(baseUrl);
          links.push(`${base.origin}${href}`);
        }
      } catch {}
    }
    return [...new Set(links)];
  }

  async getAllDocuments(): Promise<Document[]> {
    const results = this.sql
      //@ts-ignore
      .exec<Document>(
        `
      SELECT url, title, description, size, modified_at, visits 
      FROM documents 
      ORDER BY visits DESC, modified_at DESC
    `,
      )
      .toArray();
    return results;
  }

  private async tryLlmsTxt(url: string): Promise<CrawlResult | null> {
    // Try appending .md
    const mdUrl = url.endsWith("/") ? `${url}index.md` : `${url}.md`;
    try {
      const res = await fetch(mdUrl, {
        headers: { "User-Agent": "CrawlerBot/1.0" },
      });
      if (res.ok) {
        const content = await res.text();
        if (!content.includes("<!DOCTYPE") && !content.includes("<html")) {
          return {
            url,
            content,
            links: this.extractLinks(content, url),
            cached: false,
            source: "llms-txt",
          };
        }
      }
    } catch {}

    // Try Accept: text/markdown
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "CrawlerBot/1.0",
          Accept: "text/markdown, text/plain",
        },
      });
      const ct = res.headers.get("content-type") || "";
      if (
        res.ok &&
        (ct.includes("text/markdown") || ct.includes("text/plain"))
      ) {
        const content = await res.text();
        if (!content.includes("<!DOCTYPE") && !content.includes("<html")) {
          return {
            url,
            content,
            links: this.extractLinks(content, url),
            cached: false,
            source: "markdown-accept",
          };
        }
      }
    } catch {}

    return null;
  }

  private async fetchWithExtract(
    url: string,
    apiKey: string,
  ): Promise<CrawlResult | null> {
    try {
      const res = await fetch("https://api.parallel.ai/v1beta/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "parallel-beta": "search-extract-2025-10-10",
        },
        body: JSON.stringify({
          urls: [url],
          full_content: { max_chars_per_result: 100000 },
          excerpts: false,
        }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        results: Array<{ url: string; title?: string; full_content?: string }>;
      };

      const result = data.results?.[0];
      if (!result?.full_content) return null;

      return {
        url,
        title: result.title,
        content: result.full_content,
        links: this.extractLinks(result.full_content, url),
        cached: false,
        source: "extract",
      };
    } catch {
      return null;
    }
  }

  private async crawlSingle(
    url: string,
    options: CrawlOptions,
    apiKey: string,
  ): Promise<CrawlResult | null> {
    const maxAge = options.maxAge ?? 3600;
    const staleWhileRevalidate = options.staleWhileRevalidate ?? 86400;

    // Check cache
    const cached = this.getDocument(url);
    if (cached && this.isFresh(cached, maxAge)) {
      this.sql.exec(
        `UPDATE documents SET visits = visits + 1 WHERE url = ?`,
        url,
      );
      return {
        url,
        title: cached.title || undefined,
        content: cached.content,
        links: JSON.parse(cached.links),
        cached: true,
        source: "cache",
      };
    }

    // Stale-while-revalidate: return stale but trigger refresh
    const returnStale =
      cached && this.isStaleButUsable(cached, maxAge, staleWhileRevalidate);

    // Try llms.txt convention first
    let result = await this.tryLlmsTxt(url);

    // Fallback to extract API
    if (!result) {
      result = await this.fetchWithExtract(url, apiKey);
    }

    if (result) {
      this.saveDocument({
        url: result.url,
        title: result.title || null,
        content: result.content,
        links: result.links,
      });
      return result;
    }

    // Return stale if available
    if (returnStale && cached) {
      return {
        url,
        title: cached.title || undefined,
        content: cached.content,
        links: JSON.parse(cached.links),
        cached: true,
        source: "cache",
      };
    }

    return null;
  }

  private getUrlsToProcess(
    startUrl: string,
    options: CrawlOptions,
    links: string[],
  ): string[] {
    const depth = options.depth ?? 1;
    const strategy = options.strategy ?? "links";
    const pathFilter = options.path;

    if (depth <= 0) return [];

    const parsed = new URL(startUrl);
    const sameDomain = links.filter((l) => {
      try {
        return new URL(l).hostname === parsed.hostname;
      } catch {
        return false;
      }
    });

    if (strategy === "path") {
      const basePath =
        pathFilter || parsed.pathname.split("/").slice(0, -1).join("/");
      return sameDomain.filter((l) => {
        try {
          return new URL(l).pathname.startsWith(basePath);
        } catch {
          return false;
        }
      });
    }

    return sameDomain;
  }

  async crawlSSE(
    url: string,
    options: CrawlOptions,
    apiKey: string,
  ): Promise<Response> {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const send = async (event: string, data: unknown) => {
      await writer.write(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    };

    (async () => {
      const visited = new Set<string>();
      const queue: Array<{ url: string; depth: number }> = [
        { url, depth: options.depth ?? 1 },
      ];

      while (queue.length > 0) {
        const item = queue.shift()!;
        if (visited.has(item.url)) continue;
        visited.add(item.url);

        const result = await this.crawlSingle(item.url, options, apiKey);
        if (result) {
          await send("document", result);

          if (item.depth > 0) {
            const nextUrls = this.getUrlsToProcess(
              item.url,
              options,
              result.links,
            );
            for (const nextUrl of nextUrls) {
              if (!visited.has(nextUrl)) {
                queue.push({ url: nextUrl, depth: item.depth - 1 });
              }
            }
          }
        } else {
          await send("error", { url: item.url, error: "Failed to fetch" });
        }
      }

      await send("done", { total: visited.size });
      await writer.close();
    })();

    return new Response(stream.readable, {
      headers: {
        ...getCorsHeaders(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  async crawlJSON(
    url: string,
    options: CrawlOptions,
    apiKey: string,
  ): Promise<Response> {
    const asyncMode = options.async ?? "none";
    const results: CrawlResult[] = [];
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [
      { url, depth: options.depth ?? 1 },
    ];

    if (asyncMode === "all") {
      // Return immediately, process in background
      this.ctx.waitUntil(this.processQueue(queue, visited, options, apiKey));
      return new Response(JSON.stringify({ status: "processing", url }), {
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
        },
      });
    }

    // Process first page
    const firstResult = await this.crawlSingle(url, options, apiKey);
    if (firstResult) {
      results.push(firstResult);
      visited.add(url);

      if (asyncMode === "links" && (options.depth ?? 1) > 0) {
        // Process links in background
        const nextUrls = this.getUrlsToProcess(url, options, firstResult.links);
        const bgQueue = nextUrls.map((u) => ({
          url: u,
          depth: (options.depth ?? 1) - 1,
        }));
        this.ctx.waitUntil(
          this.processQueue(bgQueue, visited, options, apiKey),
        );
      } else if (asyncMode === "none") {
        // Process everything synchronously
        const nextUrls = this.getUrlsToProcess(url, options, firstResult.links);
        for (const nextUrl of nextUrls) {
          queue.push({ url: nextUrl, depth: (options.depth ?? 1) - 1 });
        }

        while (queue.length > 0) {
          const item = queue.shift()!;
          if (visited.has(item.url)) continue;
          visited.add(item.url);

          const result = await this.crawlSingle(item.url, options, apiKey);
          if (result) {
            results.push(result);
            if (item.depth > 0) {
              const moreUrls = this.getUrlsToProcess(
                item.url,
                options,
                result.links,
              );
              for (const u of moreUrls) {
                if (!visited.has(u))
                  queue.push({ url: u, depth: item.depth - 1 });
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ results, total: results.length }), {
      headers: {
        ...getCorsHeaders(),
        "Content-Type": "application/json",
      },
    });
  }

  async crawlMultipart(
    url: string,
    options: CrawlOptions,
    apiKey: string,
  ): Promise<Response> {
    const results: CrawlResult[] = [];
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [
      { url, depth: options.depth ?? 1 },
    ];

    while (queue.length > 0) {
      const item = queue.shift()!;
      if (visited.has(item.url)) continue;
      visited.add(item.url);

      const result = await this.crawlSingle(item.url, options, apiKey);
      if (result) {
        results.push(result);
        if (item.depth > 0) {
          const nextUrls = this.getUrlsToProcess(
            item.url,
            options,
            result.links,
          );
          for (const u of nextUrls) {
            if (!visited.has(u)) queue.push({ url: u, depth: item.depth - 1 });
          }
        }
      }
    }

    const boundary = `----CrawlBoundary${Date.now()}`;
    const parts = results.map((r) => {
      const filename = new URL(r.url).pathname.replace(/\//g, "_") || "index";
      return `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}.md"\r\nContent-Type: text/markdown\r\nX-URL: ${r.url}\r\nX-Source: ${r.source}\r\n\r\n${r.content}\r\n`;
    });

    return new Response(parts.join("") + `--${boundary}--`, {
      headers: {
        ...getCorsHeaders(),
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
    });
  }

  async crawlMarkdown(
    url: string,
    options: CrawlOptions,
    apiKey: string,
  ): Promise<Response> {
    const results: CrawlResult[] = [];
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [
      { url, depth: options.depth ?? 1 },
    ];

    while (queue.length > 0) {
      const item = queue.shift()!;
      if (visited.has(item.url)) continue;
      visited.add(item.url);

      const result = await this.crawlSingle(item.url, options, apiKey);
      if (result) {
        results.push(result);
        if (item.depth > 0) {
          const nextUrls = this.getUrlsToProcess(
            item.url,
            options,
            result.links,
          );
          for (const u of nextUrls) {
            if (!visited.has(u)) queue.push({ url: u, depth: item.depth - 1 });
          }
        }
      }
    }

    const markdown = results
      .map((r) => {
        return `# ${r.title || r.url}\n\nSource: ${r.url} (${r.source})\n\n${
          r.content
        }`;
      })
      .join("\n\n---\n\n");

    return new Response(markdown, {
      headers: {
        ...getCorsHeaders(),
        "Content-Type": "text/markdown",
      },
    });
  }

  private async processQueue(
    queue: Array<{ url: string; depth: number }>,
    visited: Set<string>,
    options: CrawlOptions,
    apiKey: string,
  ) {
    while (queue.length > 0) {
      const item = queue.shift()!;
      if (visited.has(item.url)) continue;
      visited.add(item.url);

      const result = await this.crawlSingle(item.url, options, apiKey);
      if (result && item.depth > 0) {
        const nextUrls = this.getUrlsToProcess(item.url, options, result.links);
        for (const u of nextUrls) {
          if (!visited.has(u)) queue.push({ url: u, depth: item.depth - 1 });
        }
      }
    }
  }
}
