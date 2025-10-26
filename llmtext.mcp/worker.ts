/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

import { DurableObject } from "cloudflare:workers";
import { withSimplerAuth, UserContext } from "simplerauth-client";
import { convertRestToMcp } from "rest-mcp";
import { parseLlmsTxt } from "parse-llms-txt";
//@ts-ignore
import popular from "./popular.json";

const DO_ID = "history-v3";
export interface Env {
  HISTORY_DO: DurableObjectNamespace<HistoryDO>;
  PORT?: string;
}

type InitializeResult = {
  /** NON_STANDARD way to describe the servers capabilities for human, just like in https://github.com/modelcontextprotocol/registry/blob/be4182606e8f4f223d1e25d0a7c3037ae278458a/docs/reference/server-json/server.schema.json#L371 */
  description?: string;
  /**
   * The version of the Model Context Protocol that the server wants to use.
   * This may not match the version that the client requested. If the client
   * cannot support this version, it MUST disconnect.
   */
  protocolVersion: string;

  capabilities: {
    /**
     * Experimental, non-standard capabilities that the server supports.
     */
    experimental?: { [key: string]: object };

    /**
     * Present if the server supports sending log messages to the client.
     */
    logging?: object;

    /**
     * Present if the server supports argument autocompletion suggestions.
     */
    completions?: object;

    /**
     * Present if the server offers any prompt templates.
     */
    prompts?: {
      /**
       * Whether this server supports notifications for changes to the prompt list.
       */
      listChanged?: boolean;
    };

    /**
     * Present if the server offers any resources to read.
     */
    resources?: {
      /**
       * Whether this server supports subscribing to resource updates.
       */
      subscribe?: boolean;
      /**
       * Whether this server supports notifications for changes to the resource list.
       */
      listChanged?: boolean;
    };

    /**
     * Present if the server offers any tools to call.
     */
    tools?: {
      /**
       * Whether this server supports notifications for changes to the tool list.
       */
      listChanged?: boolean;
    };
  };

  serverInfo: {
    /**
     * Intended for programmatic or logical use, but used as a display name
     * in past specs or fallback (if title isn't present).
     */
    name: string;

    /**
     * Intended for UI and end-user contexts — optimized to be human-readable
     * and easily understood, even by those unfamiliar with domain-specific terminology.
     *
     * If not provided, the name should be used for display (except for Tool,
     * where `annotations.title` should be given precedence over using `name`,
     * if present).
     */
    title?: string;

    version: string;

    /**
     * An optional URL of the website for this implementation.
     */
    websiteUrl?: string;

    /**
     * Optional set of sized icons that the client can display in a user interface.
     *
     * Clients that support rendering icons MUST support at least the following MIME types:
     * - `image/png` - PNG images (safe, universal compatibility)
     * - `image/jpeg` (and `image/jpg`) - JPEG images (safe, universal compatibility)
     *
     * Clients that support rendering icons SHOULD also support:
     * - `image/svg+xml` - SVG images (scalable but requires security precautions)
     * - `image/webp` - WebP images (modern, efficient format)
     */
    icons?: Array<{
      /**
       * A standard URI pointing to an icon resource. May be an HTTP/HTTPS URL or a
       * `data:` URI with Base64-encoded image data.
       *
       * Consumers SHOULD takes steps to ensure URLs serving icons are from the
       * same domain as the client/server or a trusted domain.
       *
       * Consumers SHOULD take appropriate precautions when consuming SVGs as they can contain
       * executable JavaScript.
       */
      src: string;

      /**
       * Optional MIME type override if the source MIME type is missing or generic.
       * For example: `"image/png"`, `"image/jpeg"`, or `"image/svg+xml"`.
       */
      mimeType?: string;

      /**
       * Optional array of strings that specify sizes at which the icon can be used.
       * Each string should be in WxH format (e.g., `"48x48"`, `"96x96"`) or `"any"` for scalable formats like SVG.
       *
       * If not provided, the client should assume that the icon can be used at any size.
       */
      sizes?: string[];

      /**
       * Optional specifier for the theme this icon is designed for. `light` indicates
       * the icon is designed to be used with a light background, and `dark` indicates
       * the icon is designed to be used with a dark background.
       *
       * If not provided, the client should assume the icon can be used with any theme.
       */
      theme?: "light" | "dark";
    }>;
  };

  /**
   * Instructions describing how to use the server and its features.
   *
   * This can be used by clients to improve the LLM's understanding of available
   * tools, resources, etc. It can be thought of like a "hint" to the model.
   * For example, this information MAY be added to the system prompt.
   */
  instructions?: string;

  /**
   * See [General fields: `_meta`](/specification/draft/basic/index#meta) for notes on `_meta` usage.
   *
   * This is an optional metadata field that can contain arbitrary key-value pairs.
   * The specification leaves this intentionally flexible for implementation-specific data.
   */
  _meta?: { [key: string]: unknown };
};
interface CachedLlmsTxt {
  hostname: string;
  url: string;
  content: string;
  parse: {
    title: string;
    description?: string;
    details?: string;
    sections: any[];
  };
  cachedAt: number;
  contentType: string;
}

// In-memory cache for llms.txt files
const llmsTxtCache = new Map<string, CachedLlmsTxt>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default {
  fetch: withSimplerAuth(
    async (request: Request, env: Env, ctx: UserContext) => {
      // Validate required env
      if (!env.HISTORY_DO) {
        return new Response("HISTORY_DO binding not configured", {
          status: 500,
        });
      }

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, Accept",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // Extract hostname from first segment
      const pathSegments = path
        .split("/")
        .filter((segment) => segment.length > 0);
      const hostname = pathSegments[0];

      // Handle root path
      // Handle root path

      if (path === "/") {
        return new Response(null, {
          status: 302,
          headers: { Location: "/index.json" },
        });
      }
      if (path === "/index.json") {
        const historyDO = env.HISTORY_DO.get(env.HISTORY_DO.idFromName(DO_ID));
        const leaderboard = await historyDO.getLeaderboard(undefined, 10);
        return new Response(JSON.stringify(leaderboard, undefined, 2), {
          headers: {
            "Content-Type": "application/json;charset=utf8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      if (path === "/llms.txt") {
        if (ctx.authenticated) {
          const historyDO = env.HISTORY_DO.get(
            env.HISTORY_DO.idFromName(DO_ID)
          );
          const stats = await historyDO.getPersonalStats(ctx.user?.username);
          const leaderboard = await historyDO.getLeaderboard();

          let content = `llmtext fetcher - llms.txt\n`;
          content += `================================\n\n`;
          content += `Your Stats:\n`;
          content += `- Total requests: ${stats.totalRequests}\n`;
          content += `- Total tokens: ${stats.totalTokens}\n`;
          content += `- Top URLs:\n`;
          stats.topUrls.forEach((item: any) => {
            content += `  - ${item.url} (${item.count} requests)\n`;
          });

          content += `\nTop Users:\n`;
          leaderboard.users.slice(0, 10).forEach((user: any) => {
            content += `- ${user.username}: ${user.total_requests} requests\n`;
          });

          content += `\nTop MCP Servers:\n`;
          leaderboard.servers.slice(0, 10).forEach((server: any) => {
            content += `- ${server.hostname}: ${server.total_requests} requests\n`;
          });

          return new Response(content, {
            headers: { "Content-Type": "text/plain" },
          });
        } else {
          return new Response(
            `MCP URL Fetcher - Please login first at ${url.origin}/`,
            {
              headers: {
                "Content-Type": "text/plain",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }
      }

      // Check if we have a hostname
      if (!hostname) {
        return new Response("Hostname not specified in path", { status: 404 });
      }

      // Handle MCP endpoint for specific hostname
      if (pathSegments.length >= 2 && pathSegments[1] === "mcp") {
        return handleMcp(request, env, ctx, hostname);
      }

      // Try to handle rest over mcp for specific hostname paths
      try {
        const mcpRequest = await convertRestToMcp(request);
        if (mcpRequest) {
          return handleMcp(mcpRequest, env, ctx, hostname);
        }
        return new Response("Method not found", { status: 404 });
      } catch (error) {
        return new Response(error.message, { status: 400 });
      }
    },
    { isLoginRequired: false, oauthProviderHost: "login.llmtext.com" }
  ),
};

async function countTokens(text: string): Promise<number> {
  // Simple token estimation: roughly 5 characters per token
  return Math.ceil(text.length / 5);
}

async function fetchLlmsTxt(hostname: string): Promise<CachedLlmsTxt | null> {
  const url = `https://${hostname}/llms.txt`;

  // Check cache first
  const cached = llmsTxtCache.get(url);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";

    // Only accept text/markdown or text/plain
    if (
      !contentType.includes("text/markdown") &&
      !contentType.includes("text/plain")
    ) {
      return null;
    }

    const content = await response.text();

    const parse = parseLlmsTxt(content);
    const cachedData: CachedLlmsTxt = {
      content,
      parse,
      hostname,
      url,
      cachedAt: Date.now(),
      contentType,
    };

    // Cache the result
    llmsTxtCache.set(url, cachedData);

    return cachedData;
  } catch (error) {
    return null;
  }
}

interface UrlFetchResult {
  url: string;
  content: string;
  contentType: string;
  responseTime: number;
  tokens: number;
  isHtml: boolean;
  success: boolean;
  error?: string;
}

async function fetchUrlContent(url: string): Promise<UrlFetchResult> {
  const startTime = Date.now();

  const attemptFetch = async (useAcceptHeader: boolean) => {
    const headers: HeadersInit = {
      "User-Agent": "MCP-URL-Fetcher/1.0",
    };

    if (useAcceptHeader) {
      headers.Accept = "text/markdown,text/plain";
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "unknown";
    const isHtml = contentType.includes("text/html");

    let content = "";
    let tokens = 0;

    if (isHtml) {
      // Replace HTML content with a warning
      content = `⚠️  HTML Content Detected ⚠️

The URL ${url} returned HTML content (Content-Type: ${contentType}). This content has been replaced with this warning to avoid cluttering your context with raw HTML. Please notify the user that this llms.txt is invalid and they should contact the author to fix it.`;
      tokens = await countTokens(content);
    } else {
      // Fetch actual content for non-HTML
      content = await response.text();
      tokens = await countTokens(content);
    }

    return { content, contentType, isHtml, tokens };
  };

  try {
    // First attempt with Accept header
    const result = await attemptFetch(true);
    const responseTime = Date.now() - startTime;

    return {
      url,
      content: result.content,
      contentType: result.contentType,
      responseTime,
      tokens: result.tokens,
      isHtml: result.isHtml,
      success: true,
    };
  } catch (error) {
    // If we got a 404, retry without Accept header
    if (error.message.includes("HTTP 404")) {
      try {
        const result = await attemptFetch(false);
        const responseTime = Date.now() - startTime;

        return {
          url,
          content: result.content,
          contentType: result.contentType,
          responseTime,
          tokens: result.tokens,
          isHtml: result.isHtml,
          success: true,
        };
      } catch (fallbackError) {
        // Both attempts failed
        const responseTime = Date.now() - startTime;
        const errorContent = `Error fetching ${url}: ${fallbackError.message} (fallback attempt also failed)`;
        const tokens = await countTokens(errorContent);

        return {
          url,
          content: errorContent,
          contentType: "text/plain",
          responseTime,
          tokens,
          isHtml: false,
          success: false,
          error: fallbackError.message,
        };
      }
    }

    // Non-404 error, return immediately
    const responseTime = Date.now() - startTime;
    const errorContent = `Error fetching ${url}: ${error.message}`;
    const tokens = await countTokens(errorContent);

    return {
      url,
      content: errorContent,
      contentType: "text/plain",
      responseTime,
      tokens,
      isHtml: false,
      success: false,
      error: error.message,
    };
  }
}

async function fetchMultipleUrls(urls: string[]): Promise<{
  results: UrlFetchResult[];
  totalTokens: number;
  summary: string;
}> {
  const results = await Promise.all(urls.map((url) => fetchUrlContent(url)));
  const totalTokens = results.reduce((sum, result) => sum + result.tokens, 0);

  // Generate summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;
  const htmlCount = results.filter((r) => r.isHtml).length;

  let summary = `Fetched ${results.length} URL(s): ${successful} successful, ${failed} failed`;
  if (htmlCount > 0) {
    summary += `, ${htmlCount} HTML (replaced with warnings)`;
  }
  summary += `\nTotal tokens: ${totalTokens}\n\n`;

  return { results, totalTokens, summary };
}

function extractApexDomain(hostname: string) {
  const parts = hostname.split(".");

  // Handle special cases like .co.uk, .com.au, etc.
  const twoPartTLDs = new Set([
    "co.uk",
    "com.au",
    "co.jp",
    "co.nz",
    "co.za",
    "com.br",
    "com.cn",
    "com.mx",
    "com.ar",
    "com.tr",
    "co.in",
    "co.id",
  ]);

  if (parts.length >= 3) {
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (twoPartTLDs.has(lastTwo)) {
      // For two-part TLDs, take the last 3 parts
      return parts.slice(-3).join(".");
    }
  }

  // Default: take the last two parts
  if (parts.length >= 2) {
    return parts.slice(-2).join(".");
  }

  return hostname;
}
function getFaviconUrl(domain: string, size: number) {
  return `https://www.google.com/s2/favicons?domain=${extractApexDomain(
    domain
  )}&sz=${size}`;
}

async function handleMcp(
  request: Request,
  env: Env,
  ctx: UserContext,
  hostname: string
): Promise<Response> {
  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, MCP-Protocol-Version",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (
    request.method === "GET" &&
    request.headers.get("accept")?.includes("text/event-stream")
  ) {
    return new Response("Only Streamable HTTP is supported", { status: 405 });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, MCP-Protocol-Version",
  };
  // Fetch and validate the llms.txt file
  const llmsTxtData = await fetchLlmsTxt(hostname);
  if (!llmsTxtData) {
    return new Response(
      "MCP server not found - invalid or inaccessible llms.txt. The llms.txt must be available at the root of the domain at https://example.com/llms.txt",
      { status: 404, headers: corsHeaders }
    );
  }
  const initializeResult: InitializeResult = {
    protocolVersion: "2025-06-18",
    capabilities: { tools: {} },
    serverInfo: {
      name: `${llmsTxtData.parse.title || llmsTxtData.hostname} llms.txt`,
      version: "1.0.0",
      title: `LLMTEXT MCP Server for ${
        llmsTxtData.parse.title || llmsTxtData.hostname
      }`,
      websiteUrl: `https://${llmsTxtData.hostname}`,
      description: `This MCP Server allows your LLM to understand ${
        llmsTxtData.parse.title || llmsTxtData.hostname
      } by wading through its llms.txt and linked documents thereof using a simple 'get' tool.\n\nTo use this MCP, login with X is required to collect anonymous usage data.`,
      icons: [
        {
          src: getFaviconUrl(llmsTxtData.hostname, 48),
          sizes: ["32x32", "16x16", "48x48"],
        },
        {
          src: getFaviconUrl(llmsTxtData.hostname, 256),
          sizes: ["any"],
        },
      ],
    },
    instructions: `This MCP server provides access to ${llmsTxtData.url} and all documents it refers to. Use the 'get' tool to fetch ${llmsTxtData.url} first, then content from URLs that seem relevant to the users intent.`,
  };

  if (request.method === "GET") {
    return new Response(JSON.stringify(initializeResult, undefined, 2), {
      headers: { "content-type": "application/json" },
    });
    // This can be anything!!!!
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // It's post, so must be Streamable HTTP

  try {
    const message: any = await request.json();

    console.log({ message, auth: ctx.authenticated });
    const historyDO = env.HISTORY_DO.get(env.HISTORY_DO.idFromName(DO_ID));

    // Handle ping
    if (message.method === "ping") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          result: {},
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Handle initialize
    if (message.method === "initialize") {
      if (!ctx.authenticated) {
        const url = new URL(request.url);
        const resourceMetadataUrl = `${url.origin}/.well-known/oauth-protected-resource/${hostname}/mcp`;

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32001, message: "Unauthorized" },
          }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "WWW-Authenticate": `Bearer realm="main", resource_metadata="${resourceMetadataUrl}"`,
              ...corsHeaders,
            },
          }
        );
      }

      return new Response(
        JSON.stringify(
          {
            jsonrpc: "2.0",
            id: message.id,
            result: initializeResult,
          },
          undefined,
          2
        ),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Handle initialized notification
    if (message.method === "notifications/initialized") {
      return new Response(null, {
        status: 202,
        headers: corsHeaders,
      });
    }

    if (message.method === "prompts/list") {
      return new Response(
        JSON.stringify(
          {
            jsonrpc: "2.0",
            id: message.id,
            result: { prompts: [] },
          },
          undefined,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (message.method === "resources/list") {
      return new Response(
        JSON.stringify(
          {
            jsonrpc: "2.0",
            id: message.id,
            result: { resources: [] },
          },
          undefined,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (message.method === "resources/read") {
      const { uri } = message.params;
      return new Response(
        JSON.stringify(
          {
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32602, message: `Resource not found: ${uri}` },
          },
          undefined,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle tools/list
    if (message.method === "tools/list") {
      if (!ctx.authenticated) {
        const url = new URL(request.url);
        const resourceMetadataUrl = `${url.origin}/.well-known/oauth-protected-resource/mcp`;

        return new Response(
          JSON.stringify(
            {
              jsonrpc: "2.0",
              id: message.id,
              error: { code: -32001, message: "Unauthorized" },
            },
            undefined,
            2
          ),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "WWW-Authenticate": `Bearer realm="main", resource_metadata="${resourceMetadataUrl}"`,
              ...corsHeaders,
            },
          }
        );
      }

      const tools = [
        {
          name: "get",
          title: `Get context for ${llmsTxtData.parse.title} (${llmsTxtData.hostname})`,
          description: `Get ${
            llmsTxtData.parse.title || llmsTxtData.hostname
          } content. Always first retrieve ${
            llmsTxtData.url
          }. To avoid hallucinations, always first retrieve relevant documents to the users intent.\n\n## ${
            llmsTxtData.parse.title
          }\n\n> ${llmsTxtData.parse.description}\n\n${
            llmsTxtData.parse.details
          }`,
          inputSchema: {
            type: "object",
            required: ["urls"],
            properties: {
              urls: {
                type: "array",
                items: { type: "string" },
                description: "Multiple URLs to fetch content from.",
              },
            },
          },
        },
        {
          name: "leaderboard",
          title: "Get statistics and leaderboard",
          description:
            "View usage statistics for this MCP server, global stats, and your personal usage",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ];

      return new Response(
        JSON.stringify(
          { jsonrpc: "2.0", id: message.id, result: { tools } },
          undefined,
          2
        ),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Handle tools/call
    if (message.method === "tools/call") {
      if (!ctx.authenticated) {
        const url = new URL(request.url);
        const resourceMetadataUrl = `${url.origin}/.well-known/oauth-protected-resource/mcp`;

        return new Response(
          JSON.stringify(
            {
              jsonrpc: "2.0",
              id: message.id,
              error: { code: -32001, message: "Unauthorized" },
            },
            undefined,
            2
          ),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "WWW-Authenticate": `Bearer realm="main", resource_metadata="${resourceMetadataUrl}"`,
              ...corsHeaders,
            },
          }
        );
      }

      const { name, arguments: args } = message.params as {
        name: string;
        arguments: { [key: string]: any } | undefined;
      };

      try {
        let result: string = "";
        let isError = false;

        if (name === "get") {
          const multipleUrls = args?.urls;

          if (!multipleUrls) {
            result = "Error: Either 'urls' parameter is required";
            isError = true;
          } else {
            try {
              // Determine which URLs to fetch
              let urlsToFetch: string[] = [];

              if (multipleUrls && Array.isArray(multipleUrls)) {
                // Validate and normalize all URLs
                const origin = `https://${hostname}`;

                for (const url of multipleUrls) {
                  if (typeof url !== "string") {
                    throw new Error(`Invalid URL type: ${typeof url}`);
                  }

                  let normalizedUrl = url.trim();

                  // Handle relative paths
                  if (normalizedUrl.startsWith("/")) {
                    // Absolute path: /path
                    normalizedUrl = `${origin}${normalizedUrl}`;
                  } else if (normalizedUrl.startsWith("./")) {
                    // Relative path: ./path
                    normalizedUrl = `${origin}/${normalizedUrl.slice(2)}`;
                  } else if (
                    !normalizedUrl.startsWith("http://") &&
                    !normalizedUrl.startsWith("https://")
                  ) {
                    // Relative path without prefix: path
                    normalizedUrl = `${origin}/${normalizedUrl}`;
                  }

                  // Validate the final URL
                  new URL(normalizedUrl);
                  urlsToFetch.push(normalizedUrl);
                }
              } else {
                throw new Error("Invalid URL format");
              }

              const fetchResults = await fetchMultipleUrls(urlsToFetch);

              // Store each URL in history
              for (const fetchResult of fetchResults.results) {
                if (fetchResult.success) {
                  try {
                    const urlHostname = new URL(fetchResult.url).hostname;
                    const isLlmsTxt = fetchResult.url.endsWith("/llms.txt");

                    await historyDO.addHistory({
                      username: ctx.user!.username,
                      hostname: urlHostname,
                      mcp_hostname: hostname, // Track which MCP was used
                      is_llms_txt: isLlmsTxt,
                      content_type: fetchResult.contentType,
                      url: fetchResult.url,
                      tokens: fetchResult.tokens,
                      response_time: fetchResult.responseTime,
                    });
                  } catch (historyError) {
                    // Log but don't fail the request for history errors
                    console.error("History storage error:", historyError);
                  }
                }
              }

              // Format the response
              result = fetchResults.summary;

              fetchResults.results.forEach((fetchResult, index) => {
                result += `${"=".repeat(50)}\n`;
                result += `URL ${index + 1}: ${fetchResult.url}\n`;
                result += `Status: ${
                  fetchResult.success ? "Success" : "Failed"
                }\n`;
                result += `Content-Type: ${fetchResult.contentType}\n`;
                result += `Response Time: ${fetchResult.responseTime}ms\n`;
                result += `Tokens: ${fetchResult.tokens}\n`;
                if (fetchResult.isHtml) {
                  result += `⚠️  HTML Content (replaced with warning)\n`;
                }
                if (fetchResult.error) {
                  result += `Error: ${fetchResult.error}\n`;
                }
                result += `${"=".repeat(50)}\n\n`;
                result += fetchResult.content + "\n\n";
              });
            } catch (urlError) {
              result = `Error: Invalid URL(s) - ${urlError.message}`;
              isError = true;
            }
          }
        } else if (name === "leaderboard") {
          // Get combined statistics
          const userStatsForHost = await historyDO.getPersonalStats(
            ctx.user?.username,
            hostname
          );
          const userStatsGlobal = await historyDO.getPersonalStats(
            ctx.user?.username
          );
          const hostLeaderboard = await historyDO.getLeaderboard(hostname);
          const globalLeaderboard = await historyDO.getLeaderboard();

          let content = `# Statistics for ${hostname}\n\n`;

          // Host-specific stats
          content += `## ${hostname} Server Statistics\n`;
          content += `- **Total requests**: ${
            hostLeaderboard.totalRequests || 0
          }\n`;
          content += `- **Total tokens**: ${
            hostLeaderboard.totalTokens || 0
          }\n\n`;

          content += `### Top Users on ${hostname}\n`;
          hostLeaderboard.users.slice(0, 10).forEach((user: any, i: number) => {
            content += `${i + 1}. [@${user.username}](https://x.com/${
              user.username
            }): ${user.total_requests} requests, ${
              user.total_tokens || 0
            } tokens\n`;
          });

          // Your usage for this host
          content += `\n## Your Usage on ${hostname}\n`;
          content += `- **Your requests**: ${userStatsForHost.totalRequests}\n`;
          content += `- **Your tokens**: ${userStatsForHost.totalTokens}\n`;
          if (userStatsForHost.topUrls.length > 0) {
            content += `- **Your top URLs**:\n`;
            userStatsForHost.topUrls.slice(0, 5).forEach((item: any) => {
              content += `  - ${item.url} (${item.count} requests)\n`;
            });
          }

          // Global stats
          content += `\n## Global Statistics\n`;
          content += `- **Total requests**: ${
            globalLeaderboard.totalRequests || 0
          }\n`;
          content += `- **Total tokens**: ${
            globalLeaderboard.totalTokens || 0
          }\n\n`;

          content += `### Top Users Globally\n`;
          globalLeaderboard.users
            .slice(0, 10)
            .forEach((user: any, i: number) => {
              content += `${i + 1}. [@${user.username}](https://x.com/${
                user.username
              }): ${user.total_requests} requests, ${
                user.total_tokens || 0
              } tokens\n`;
            });

          content += `\n### Top MCP Servers\n`;
          globalLeaderboard.servers
            .slice(0, 10)
            .forEach((server: any, i: number) => {
              content += `${i + 1}. **${server.hostname}**: ${
                server.total_requests
              } requests, ${server.total_tokens || 0} tokens\n`;
            });

          // Your global usage
          content += `\n## Your Global Usage\n`;
          content += `- **Your total requests**: ${userStatsGlobal.totalRequests}\n`;
          content += `- **Your total tokens**: ${userStatsGlobal.totalTokens}\n`;
          if (userStatsGlobal.mcpHosts.length > 0) {
            content += `- **MCP servers you've used**:\n`;
            userStatsGlobal.mcpHosts?.forEach((host: any) => {
              content += `  - ${host.hostname}: ${host.count} requests\n`;
            });
          }

          result = content;
        } else {
          result = `Error: Unknown tool: ${name}`;
          isError = true;
        }

        return new Response(
          JSON.stringify(
            {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [{ type: "text", text: result }],
                isError,
              },
            },
            undefined,
            2
          ),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify(
            {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Error executing tool: ${error.message}`,
                  },
                ],
                isError: true,
              },
            },
            undefined,
            2
          ),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    // Method not found
    return new Response(
      JSON.stringify(
        {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`,
          },
        },
        undefined,
        2
      ),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
}

export class HistoryDO extends DurableObject<Env> {
  sql: SqlStorage;
  storage: DurableObjectStorage;
  private static readonly TRENDS_CACHE_KEY = "activity_trends_cache";
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.storage = state.storage;
    // Initialize tables
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        hostname TEXT NOT NULL,
        mcp_hostname TEXT NOT NULL,
        is_llms_txt BOOLEAN NOT NULL,
        content_type TEXT NOT NULL,
        url TEXT NOT NULL,
        tokens INTEGER NOT NULL,
        response_time INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_username ON history(username);
      CREATE INDEX IF NOT EXISTS idx_hostname ON history(hostname);
      CREATE INDEX IF NOT EXISTS idx_mcp_hostname ON history(mcp_hostname);
      CREATE INDEX IF NOT EXISTS idx_created_at ON history(created_at);
      CREATE INDEX IF NOT EXISTS idx_username_created ON history(username, created_at);
    `);
  }

  async addHistory(data: {
    username: string;
    hostname: string;
    mcp_hostname: string;
    is_llms_txt: boolean;
    content_type: string;
    url: string;
    tokens: number;
    response_time: number;
  }) {
    this.sql.exec(
      `INSERT INTO history (username, hostname, mcp_hostname, is_llms_txt, content_type, url, tokens, response_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      data.username,
      data.hostname,
      data.mcp_hostname,
      data.is_llms_txt,
      data.content_type,
      data.url,
      data.tokens,
      data.response_time
    );
  }

  async getPersonalStats(username?: string, mcpHostname?: string) {
    if (!username) {
      return {};
    }
    let whereClause = `WHERE username = ?`;
    const params = [username];

    if (mcpHostname) {
      whereClause += ` AND mcp_hostname = ?`;
      params.push(mcpHostname);
    }

    const totalStats = this.sql
      .exec(
        `SELECT COUNT(*) as total_requests, SUM(tokens) as total_tokens
         FROM history ${whereClause}`,
        ...params
      )
      .toArray()[0] as any;

    const topUrls = this.sql
      .exec(
        `SELECT url, COUNT(*) as count
         FROM history 
         ${whereClause}
         GROUP BY url
         ORDER BY count DESC
         LIMIT 10`,
        ...params
      )
      .toArray();

    const llmsTxtUrls = this.sql
      .exec(
        `SELECT DISTINCT hostname, url
         FROM history
         ${whereClause} AND is_llms_txt = 1
         ORDER BY hostname`,
        ...params
      )
      .toArray();

    const mcpHosts = this.sql
      .exec(
        `SELECT mcp_hostname as hostname, COUNT(*) as count
         FROM history
         WHERE username = ?
         GROUP BY mcp_hostname
         ORDER BY count DESC`,
        username
      )
      .toArray();

    return {
      totalRequests: totalStats.total_requests || 0,
      totalTokens: totalStats.total_tokens || 0,
      topUrls,
      llmsTxtUrls,
      mcpHosts,
    };
  }
  async getLeaderboard(mcpHostname?: string, limit?: number) {
    let userQuery = `
    SELECT username, COUNT(*) as total_requests, SUM(tokens) as total_tokens
    FROM history
  `;
    let serverQuery = `
    SELECT 
      mcp_hostname as hostname, 
      COUNT(*) as total_requests, 
      SUM(tokens) as total_tokens,
      COUNT(DISTINCT username) as unique_users
    FROM history
    GROUP BY mcp_hostname
    ORDER BY total_requests DESC
  `;
    let totalQuery = `SELECT COUNT(*) as total_requests, SUM(tokens) as total_tokens FROM history`;

    const params = [];
    if (mcpHostname) {
      userQuery += ` WHERE mcp_hostname = ?`;
      totalQuery += ` WHERE mcp_hostname = ?`;
      params.push(mcpHostname);
    }

    userQuery += ` GROUP BY username ORDER BY total_requests DESC`;
    totalQuery += ` LIMIT 1`;

    if (limit) {
      serverQuery += ` LIMIT 0,${limit}`;
      userQuery += ` LIMIT 0,${limit}`;
    }

    const users = this.sql.exec(userQuery, ...params).toArray();
    const servers = mcpHostname ? [] : this.sql.exec(serverQuery).toArray();
    const totals = this.sql.exec(totalQuery, ...params).toArray()[0] as any;

    // Get existing server hostnames from leaderboard
    const existingHostnames = new Set(servers.map((server) => server.hostname));

    // Add popular servers that aren't in the history
    const popularServersToAdd = popular
      .filter((item) => !existingHostnames.has(item.hostname))
      .map((item) => ({
        valid: item.valid,
        hostname: item.hostname,
        rank: item.rank || Infinity,
        // this can reduce # of requests but it also increases the size of index.json significantly. dunno where the sweet spot is
        //icon: item.icon,
        total_requests: 0,
        total_tokens: 0,
        unique_users: 0,
      }))
      .sort((a, b) => a.rank - b.rank);

    // Combine existing servers with popular ones
    const allServers = [
      ...servers.map((item) => ({ ...item, valid: true })),
      ...popularServersToAdd,
    ];

    return {
      users,
      servers: allServers,
      totalRequests: totals?.total_requests || 0,
      totalTokens: totals?.total_tokens || 0,
    };
  }
  async getActivityTrends(mcpHostname?: string) {
    const cacheKey = `${HistoryDO.TRENDS_CACHE_KEY}_${mcpHostname || "global"}`;

    // Check if we have cached data
    const cachedData = await this.storage.get(cacheKey);
    if (cachedData) {
      const cache = cachedData as { data: any; timestamp: number };
      const now = Date.now();

      // Return cached data if it's less than 24 hours old
      if (now - cache.timestamp < HistoryDO.CACHE_DURATION) {
        return cache.data;
      }
    }

    // Calculate new trends data
    const trendsData = await this.calculateActivityTrends(mcpHostname);

    // Cache the results
    await this.storage.put(cacheKey, {
      data: trendsData,
      timestamp: Date.now(),
    });

    return trendsData;
  }

  private async calculateActivityTrends(mcpHostname?: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fiftyTwoWeeksAgo = new Date(
      now.getTime() - 52 * 7 * 24 * 60 * 60 * 1000
    );

    // Get the earliest record to determine actual start date
    let earliestQuery = `SELECT MIN(created_at) as earliest FROM history`;
    const params = [];
    if (mcpHostname) {
      earliestQuery += ` WHERE mcp_hostname = ?`;
      params.push(mcpHostname);
    }

    const earliestResult = this.sql
      .exec(earliestQuery, ...params)
      .toArray()[0] as any;
    const earliestDate = earliestResult?.earliest
      ? new Date(earliestResult.earliest)
      : now;

    // Use the later of fiftyTwoWeeksAgo or earliestDate for weekly trends
    const weeklyStartDate =
      earliestDate > fiftyTwoWeeksAgo ? earliestDate : fiftyTwoWeeksAgo;
    const dailyStartDate =
      earliestDate > thirtyDaysAgo ? earliestDate : thirtyDaysAgo;

    // Daily trends for last 30 days
    const dailyTrends = await this.getDailyTrends(
      dailyStartDate,
      now,
      mcpHostname
    );

    // Weekly trends for last 52 weeks (or since start)
    const weeklyTrends = await this.getWeeklyTrends(
      weeklyStartDate,
      now,
      mcpHostname
    );

    return {
      daily: {
        period: `${dailyStartDate.toISOString().split("T")[0]} to ${
          now.toISOString().split("T")[0]
        }`,
        trends: dailyTrends,
      },
      weekly: {
        period: `${weeklyStartDate.toISOString().split("T")[0]} to ${
          now.toISOString().split("T")[0]
        }`,
        trends: weeklyTrends,
      },
      generatedAt: now.toISOString(),
      mcpHostname: mcpHostname || "global",
    };
  }

  private async getDailyTrends(
    startDate: Date,
    endDate: Date,
    mcpHostname?: string
  ) {
    let whereClause = `WHERE DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)`;
    const params = [startDate.toISOString(), endDate.toISOString()];

    if (mcpHostname) {
      whereClause += ` AND mcp_hostname = ?`;
      params.push(mcpHostname);
    }

    // Get daily active developer counts
    const dailyCountsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT username) as active_developers,
        COUNT(*) as total_requests,
        SUM(tokens) as total_tokens
      FROM history 
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const dailyCounts = this.sql.exec(dailyCountsQuery, ...params).toArray();

    // Get top 10 users for each day
    const dailyTopUsers = [];
    for (const day of dailyCounts) {
      let topUsersQuery = `
        SELECT 
          username,
          COUNT(*) as requests,
          SUM(tokens) as tokens
        FROM history 
        WHERE DATE(created_at) = ? ${mcpHostname ? "AND mcp_hostname = ?" : ""}
        GROUP BY username
        ORDER BY requests DESC, tokens DESC
        LIMIT 10
      `;

      const topUsersParams = [day.date];
      if (mcpHostname) {
        topUsersParams.push(mcpHostname);
      }

      const topUsers = this.sql
        .exec(topUsersQuery, ...topUsersParams)
        .toArray();

      dailyTopUsers.push({
        date: day.date,
        active_developers: day.active_developers,
        total_requests: day.total_requests,
        total_tokens: day.total_tokens,
        top_developers: topUsers,
      });
    }

    return dailyTopUsers;
  }

  private async getWeeklyTrends(
    startDate: Date,
    endDate: Date,
    mcpHostname?: string
  ) {
    let whereClause = `WHERE DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)`;
    const params = [startDate.toISOString(), endDate.toISOString()];

    if (mcpHostname) {
      whereClause += ` AND mcp_hostname = ?`;
      params.push(mcpHostname);
    }

    // SQLite doesn't have YEARWEEK, so we'll use strftime to get year and week
    const weeklyCountsQuery = `
      SELECT 
        strftime('%Y-%W', created_at) as year_week,
        DATE(created_at, 'weekday 0', '-6 days') as week_start,
        DATE(created_at, 'weekday 0') as week_end,
        COUNT(DISTINCT username) as active_developers,
        COUNT(*) as total_requests,
        SUM(tokens) as total_tokens
      FROM history 
      ${whereClause}
      GROUP BY strftime('%Y-%W', created_at)
      ORDER BY year_week DESC
    `;

    const weeklyCounts = this.sql.exec(weeklyCountsQuery, ...params).toArray();

    // Get top 10 users for each week
    const weeklyTopUsers = [];
    for (const week of weeklyCounts) {
      let topUsersQuery = `
        SELECT 
          username,
          COUNT(*) as requests,
          SUM(tokens) as tokens
        FROM history 
        WHERE strftime('%Y-%W', created_at) = ? ${
          mcpHostname ? "AND mcp_hostname = ?" : ""
        }
        GROUP BY username
        ORDER BY requests DESC, tokens DESC
        LIMIT 10
      `;

      const topUsersParams = [week.year_week];
      if (mcpHostname) {
        topUsersParams.push(mcpHostname);
      }

      const topUsers = this.sql
        .exec(topUsersQuery, ...topUsersParams)
        .toArray();

      weeklyTopUsers.push({
        year_week: week.year_week,
        week_start: week.week_start,
        week_end: week.week_end,
        active_developers: week.active_developers,
        total_requests: week.total_requests,
        total_tokens: week.total_tokens,
        top_developers: topUsers,
      });
    }

    return weeklyTopUsers;
  }
}
