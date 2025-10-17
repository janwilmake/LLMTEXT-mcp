/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

import { DurableObject } from "cloudflare:workers";
import { withSimplerAuth, UserContext } from "simplerauth-client";
import { convertRestToMcp } from "rest-mcp";
//@ts-ignore
import popular from "./popular.json";

const DO_ID = "history-v2";
export interface Env {
  HISTORY_DO: DurableObjectNamespace<HistoryDO>;
  PORT?: string;
}

interface CachedLlmsTxt {
  content: string;
  hostname: string;
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
        const historyDO = env.HISTORY_DO.get(env.HISTORY_DO.idFromName(DO_ID));
        const leaderboard = await historyDO.getLeaderboard(undefined, 10);

        // Get existing server hostnames from leaderboard
        const existingHostnames = new Set(
          leaderboard.servers.map((server) => server.hostname)
        );

        // Add popular servers that aren't in the history
        const popularServersToAdd = popular
          .filter((hostname) => !existingHostnames.has(hostname))
          .map((hostname) => ({
            hostname,
            total_requests: 0,
            total_tokens: 0,
          }));

        // Combine existing servers with popular ones
        const allServers = [...leaderboard.servers, ...popularServersToAdd];

        const htmlContent = `<!DOCTYPE html>
<html lang="en">

<head>
    <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />

    <meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>llmtext - An MCP server for every llms.txt</title>
<meta name="description" content="Get an MCP server that knows your llms.txt to always retrieve the right context when needed." />
<meta name="robots" content="index, follow" />

<!-- Facebook Meta Tags -->
<meta property="og:url" content="https://llmtext.com" />
<meta property="og:type" content="website" />
<meta property="og:title" content="llmtext - An MCP server for every llms.txt" />
<meta property="og:description" content="Get an MCP server that knows your llms.txt to always retrieve the right context when needed." />
<meta property="og:image" content="https://llmtext.com/og.png" />
<meta property="og:image:alt" content="Get an MCP server that knows your llms.txt to always retrieve the right context when needed."/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>

<!-- Twitter Meta Tags -->
<meta name="twitter:card" content="summary_large_image" />
<meta property="twitter:domain" content="llmtext.com" />
<meta property="twitter:url" content="https://llmtext.com" />
<meta name="twitter:title" content="llmtext - An MCP server for every llms.txt" />
<meta name="twitter:description" content="Get an MCP server that knows your llms.txt to always retrieve the right context when needed." />
<meta name="twitter:image" content="https://llmtext.com/og.png" />

    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
            background: #fafafa;
            color: #1d1d1f;
            line-height: 1.47059;
            font-weight: 400;
            letter-spacing: -0.022em;
        }

        .header {
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 16px;
            z-index: 10;
        }

        .brand-header {
            position: absolute;
            top: 20px;
            left: 20px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            z-index: 10;
        }

        .brand-logo {
            background-color: #4fc1ae;
            padding-left: 5px;
            padding-right: 5px;
            padding-top: 0px;
            padding-bottom: 0px;
            border-radius: 2px;
            font-size: 28px;
            font-weight: 700;
            color: #1d1d1f;
            text-decoration: none;
            letter-spacing: -0.02em;
            margin-bottom: 2px;
        }

        .brand-by {
            font-size: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            color: #86868b;
            margin-bottom: 4px;
            font-weight: 400;
        }

        .parallel-logo {
            height: 12px;
            width: auto;
            margin-bottom: 2px;
        }

        .read-more {
            font-size: 12px;
            color: #007aff;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
        }

        .read-more:hover {
            color: #0051d0;
        }

        .tool-link {
            background: white;
            color: #007aff;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 590;
            transition: all 0.2s ease;
            border: 1px solid #d2d2d7;
        }

        .tool-link:hover {
            background: #007aff;
            color: white;
            transform: translateY(-1px);
        }

        .tools-label {
            margin-top: 10px;
            font-size: 12px;
        }

        .container {
            max-width: 980px;
            margin: 0 auto;
            padding: 80px 20px;
        }

        h1 {
            font-size: 48px;
            font-weight: 600;
            letter-spacing: -0.005em;
            text-align: center;
            margin-top: 24px;
            margin-bottom: 24px;
            color: #1d1d1f;
        }

        .subtitle {
            font-size: 21px;
            font-weight: 400;
            text-align: center;
            margin-bottom: 20px;
            color: #86868b;
        }

        .form-section {
            background: white;
            border-radius: 18px;
            padding: 48px;
            margin-bottom: 80px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .input-group {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        input[type="url"] {
            flex: 1;
            font-size: 17px;
            padding: 16px 20px;
            border: 2px solid #d2d2d7;
            border-radius: 12px;
            background: #f5f5f7;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        input[type="url"]:focus {
            outline: none;
            border-color: #007aff;
            background: white;
        }

        .install-btn {
            background: #007aff;
            color: white;
            border: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 17px;
            font-weight: 590;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
        }

        .install-btn:hover {
            background: #0051d0;
            transform: translateY(-1px);
        }

        .leaderboard {
            background: white;
            border-radius: 18px;
            padding: 48px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .leaderboard h2 {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 32px;
            text-align: center;
        }

        .mcp-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 0;
            border-bottom: 1px solid #f5f5f7;
        }

        .mcp-item:last-child {
            border-bottom: none;
        }

        .mcp-info {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .mcp-rank {
            font-size: 24px;
            font-weight: 600;
            color: #86868b;
            min-width: 32px;
        }

        .mcp-favicon {
            width: 20px;
            height: 20px;
            border-radius: 4px;
            background: #f5f5f7;
        }

        .mcp-details {
            display: flex;
            flex-direction: column;
        }

        .mcp-name {
            font-size: 19px;
            font-weight: 590;
            color: #1d1d1f;
        }

        .mcp-stats {
            font-size: 15px;
            color: #86868b;
            margin-top: 2px;
        }

        .mcp-install {
            background: #34c759;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 590;
            transition: all 0.2s ease;
        }

        .mcp-install:hover {
            background: #30d158;
            transform: translateY(-1px);
        }

        /* Mobile styles */
        @media (max-width: 768px) {
            .header {
                position: static;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                margin-bottom: 20px;
                padding: 0;
            }

            .tools-label {
                margin-top: 0;
                margin-bottom: 8px;
                order: -1;
            }

            .tool-link {
                padding: 10px 20px;
                font-size: 16px;
                width: 100%;
                text-align: center;
                max-width: 280px;
            }

            .brand-header {
                position: static;
                align-items: center;
                margin-bottom: 30px;
            }

            .brand-logo {
                font-size: 32px;
                padding: 2px 8px;
            }

            .brand-by {
                font-size: 10px;
            }

            .parallel-logo {
                height: 14px;
            }

            .read-more {
                font-size: 14px;
            }

            .container {
                padding: 40px 16px;
            }

            h1 {
                font-size: 36px;
                line-height: 1.1;
                margin-top: 0px;
                margin-bottom: 16px;
            }

            .subtitle {
                font-size: 18px;
                margin-bottom: 30px;
                padding: 0 10px;
            }

            .form-section,
            .leaderboard {
                padding: 24px 20px;
                border-radius: 16px;
                margin-bottom: 40px;
            }

            .input-group {
                flex-direction: column;
                gap: 16px;
            }

            input[type="url"] {
                width: 100%;
                font-size: 16px;
                padding: 14px 16px;
            }

            .install-btn {
                width: 100%;
                padding: 14px 24px;
                font-size: 16px;
            }

            .leaderboard h2 {
                font-size: 26px;
                margin-bottom: 24px;
            }

            .mcp-item {
                flex-direction: column;
                gap: 16px;
                align-items: stretch;
                padding: 16px 0;
            }

            .mcp-info {
                width: 100%;
                gap: 12px;
            }

            .mcp-rank {
                font-size: 20px;
                min-width: 28px;
            }

            .mcp-favicon {
                width: 18px;
                height: 18px;
            }

            .mcp-name {
                font-size: 17px;
                word-break: break-word;
            }

            .mcp-stats {
                font-size: 14px;
                line-height: 1.3;
            }

            .mcp-install {
                width: 100%;
                text-align: center;
                padding: 12px 20px;
                margin-top: 8px;
                border-radius: 10px;
            }
        }

        /* Extra small mobile styles */
        @media (max-width: 480px) {
            .container {
                padding: 30px 12px;
            }

            h1 {
                font-size: 30px;
            }

            .subtitle {
                font-size: 16px;
            }

            .form-section,
            .leaderboard {
                padding: 20px 16px;
            }

            .brand-logo {
                font-size: 28px;
            }

            .leaderboard h2 {
                font-size: 24px;
            }
        }
    </style>
    <link rel="preload" href="/dark-parallel-text-270.svg" as="image">

</head>

<body>
    <div class="brand-header">
        <a href="/" class="brand-logo">LLMTEXT</a>
        <span class="brand-by">powered by <img src="/dark-parallel-text-270.svg" alt="Parallel AI" class="parallel-logo" /></span>
        <a href="https://parallel.ai/blog" class="read-more" target="_blank">read more &gt;</a>
    </div>

    <div class="header">
        <span class="tools-label">Tools</span>
        <a href="https://check.llmtext.com" class="tool-link" target="_blank">llms.txt checker</a>
        <a href="https://extract.llmtext.com" class="tool-link" target="_blank">generate llms.txt</a>
    </div>

    <div class="container">
        <h1>Turn Your Docs into a Dedicated MCP Server</h1>
        <p class="subtitle">Eliminate token bloat in docs to improve LLM understanding.</p>

        <div class="form-section">
            <form id="mcpForm" class="input-group">
                <input type="url" id="llmsTxtUrl" placeholder="https://example.com/llms.txt" required
                    aria-label="llms.txt URL">
                <button type="submit" class="install-btn">Install</button>
            </form>
        </div>

        <div class="leaderboard">
            <h2>Popular llms.txt MCP Servers</h2>
            <div id="mcpList">
                ${allServers
                  .map((server, index) => {
                    const installUrl = `https://installthismcp.com/${encodeURIComponent(
                      server.hostname + " llms.txt"
                    )}?url=${encodeURIComponent(
                      "https://llmtext.com/" + server.hostname + "/mcp"
                    )}`;
                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${server.hostname}&sz=32`;

                    return `<div class="mcp-item">
                    <div class="mcp-info">
                        <div class="mcp-rank">${index + 1}</div>
                        <img src="${faviconUrl}" alt="${
                      server.hostname
                    } favicon" class="mcp-favicon" onerror="this.style.display='none'">
                        <div class="mcp-details">
                            <div class="mcp-name">${server.hostname}</div>
                            ${
                              server.total_requests ||
                              server.total_tokens ||
                              server.unique_users
                                ? `<div class="mcp-stats">usage - ${server.total_requests.toLocaleString()} requests • ${(
                                    server.total_tokens || 0
                                  ).toLocaleString()} tokens ingested by ${(
                                    server.unique_users || 0
                                  ).toLocaleString()} users</div>`
                                : ""
                            }
                        </div>
                    </div>
                    <a href="${installUrl}" class="mcp-install" target="_blank">Install</a>
                </div>`;
                  })
                  .join("")}
            </div>
        </div>
    </div>

    <script>
        document.getElementById('mcpForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const url = document.getElementById('llmsTxtUrl').value;

            try {
                const hostname = new URL(url).hostname;
                const installUrl = \`https://installthismcp.com/\${encodeURIComponent(hostname + ' llms.txt')}?url=\${encodeURIComponent('https://llmtext.com/' + hostname + '/mcp')}\`;
                window.open(installUrl, '_blank');
            } catch (error) {
                alert('Please enter a valid URL');
            }
        });
    </script>
</body>

</html>`;

        return new Response(htmlContent, {
          headers: { "Content-Type": "text/html" },
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
            { headers: { "Content-Type": "text/plain" } }
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
    { isLoginRequired: false }
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

    console.log("ok", response.ok, url, response.status);
    if (!response.ok) {
      console.log("not ok", await response.text());
      return null;
    }

    const contentType = response.headers.get("content-type") || "";

    console.log({ contentType });
    // Only accept text/markdown or text/plain
    if (
      !contentType.includes("text/markdown") &&
      !contentType.includes("text/plain")
    ) {
      return null;
    }

    const content = await response.text();

    const cachedData: CachedLlmsTxt = {
      content,
      hostname,
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

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MCP-URL-Fetcher/1.0",
        Accept: "text/markdown,text/plain",
      },
    });

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

The URL ${url} returned HTML content (Content-Type: ${contentType}).

For better results with HTML content, consider using:
- An HTML-to-Markdown MCP server
- A web scraping tool that converts HTML to plain text
- A different endpoint that returns plain text or JSON

This content has been replaced with this warning to avoid cluttering your context with raw HTML.`;
      tokens = await countTokens(content);
    } else {
      // Fetch actual content for non-HTML
      content = await response.text();
      tokens = await countTokens(content);
    }

    const responseTime = Date.now() - startTime;

    return {
      url,
      content,
      contentType,
      responseTime,
      tokens,
      isHtml,
      success: true,
    };
  } catch (error) {
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

  if (request.method === "GET") {
    return new Response("Only Streamable HTTP is supported", {
      status: 405,
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
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
      {
        status: 404,
        headers: corsHeaders,
      }
    );
  }

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

      const initializeResult = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: `${llmsTxtData.hostname} llms.txt`,
            version: "1.0.0",
          },
          instructions: `This MCP server provides access to the llms.txt file from ${llmsTxtData.hostname}. Use the 'get' tool to fetch content from URLs, with the llms.txt content included in the tool description.`,
        },
      };

      return new Response(JSON.stringify(initializeResult, undefined, 2), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
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
          title: `Get context for ${llmsTxtData.hostname}`,
          description: `Fetch content and return them as plain text. Always first retrieve relevant context before doing something that requires new information This MCP server is configured for ${llmsTxtData.hostname} with the following llms.txt content:\n\n${llmsTxtData.content}`,
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
          const singleUrl = args?.url;
          const multipleUrls = args?.urls;

          if (!singleUrl && !multipleUrls) {
            result = "Error: Either 'url' or 'urls' parameter is required";
            isError = true;
          } else {
            try {
              // Determine which URLs to fetch
              let urlsToFetch: string[] = [];

              if (singleUrl) {
                new URL(singleUrl); // Validate URL
                urlsToFetch = [singleUrl];
              } else if (multipleUrls && Array.isArray(multipleUrls)) {
                // Validate all URLs
                for (const url of multipleUrls) {
                  if (typeof url !== "string") {
                    throw new Error(`Invalid URL type: ${typeof url}`);
                  }
                  new URL(url); // Validate URL
                }
                urlsToFetch = multipleUrls;
              } else {
                throw new Error("Invalid URL format");
              }

              // Limit number of URLs to prevent abuse
              if (urlsToFetch.length > 10) {
                result = "Error: Maximum 10 URLs allowed per request";
                isError = true;
              } else {
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
              }
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

    return {
      users,
      servers,
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
