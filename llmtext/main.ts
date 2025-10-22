/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

export interface Env {
  // No bindings needed - user will configure via settings if needed
}

const PARALLEL_API_BASE = "https://api.parallel.ai";
const PARALLEL_OAUTH_BASE = "https://platform.parallel.ai";
const CLIENT_ID = "llmtext.com";
const REDIRECT_URI = "http://localhost:8787/callback";
const COOKIE_NAME = "parallel_api_key";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/llms.txt") {
      return handleLlmsTxt();
    }

    // Handle OAuth callback
    if (path === "/callback") {
      return handleCallback(request);
    }

    // Get API key from cookie
    const apiKey = getApiKeyFromCookie(request);

    // If no API key, redirect to OAuth
    if (!apiKey) {
      return redirectToOAuth(path);
    }

    // Extract URL from path (remove leading slash)
    const targetUrl = path.slice(1);

    if (!targetUrl) {
      return new Response(
        "Usage: https://llmtext.com/example.com or https://llmtext.com/https://example.com",
        { status: 400 }
      );
    }

    // Normalize URL (add protocol if missing)
    const normalizedUrl = normalizeUrl(targetUrl);

    try {
      // Call Parallel Extract API
      const extractResponse = await fetch(
        `${PARALLEL_API_BASE}/v1beta/extract`,
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "parallel-beta": "search-extract-2025-10-10",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            urls: [normalizedUrl],
            excerpts: false,
            full_content: true,
          }),
        }
      );

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        return new Response(
          `Parallel API error (${extractResponse.status}): ${errorText}`,
          { status: extractResponse.status }
        );
      }

      const extractData = (await extractResponse.json()) as ExtractResponse;

      // Check for errors
      if (extractData.errors && extractData.errors.length > 0) {
        const error = extractData.errors[0];
        return new Response(
          `Extract error: ${error.error_type}${
            error.content ? `\n${error.content}` : ""
          }`,
          { status: 500 }
        );
      }

      // Return full content
      if (extractData.results && extractData.results.length > 0) {
        const result = extractData.results[0];
        return new Response(result.full_content || "No content extracted", {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
          },
        });
      }

      return new Response("No results found", { status: 404 });
    } catch (error) {
      return new Response(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        { status: 500 }
      );
    }
  },
} satisfies ExportedHandler<Env>;

function normalizeUrl(url: string): string {
  // If URL doesn't start with http:// or https://, add https://
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

function getApiKeyFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

async function redirectToOAuth(originalPath: string): Promise<Response> {
  // Generate PKCE challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state = btoa(
    JSON.stringify({
      originalPath,
      codeVerifier,
      timestamp: Date.now(),
    })
  );

  const authUrl = new URL(`${PARALLEL_OAUTH_BASE}/getKeys/authorize`);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "key:read");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  return Response.redirect(authUrl.toString(), 302);
}

async function handleCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }

  if (!code || !state) {
    return new Response("Missing code or state parameter", { status: 400 });
  }

  let stateData: {
    originalPath: string;
    codeVerifier: string;
    timestamp: number;
  };
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return new Response("Invalid state parameter", { status: 400 });
  }

  // Exchange code for token
  try {
    const tokenResponse = await fetch(`${PARALLEL_OAUTH_BASE}/getKeys/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: stateData.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return new Response(`Token exchange failed: ${errorText}`, {
        status: tokenResponse.status,
      });
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // Set cookie and redirect to original path
    const headers = new Headers();
    headers.set("Location", stateData.originalPath || "/");
    const securePart = REDIRECT_URI.startsWith("http://") ? "" : " Secure;";
    headers.set(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(
        tokenData.access_token
      )}; HttpOnly;${securePart} SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`
    );

    return new Response(null, { status: 302, headers });
  } catch (error) {
    return new Response(
      `Error exchanging token: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { status: 500 }
    );
  }
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Type definitions for Parallel API responses
interface ExtractResponse {
  extract_id: string;
  results: ExtractResult[];
  errors: ExtractError[];
}

interface ExtractResult {
  url: string;
  excerpts: string[] | null;
  full_content: string | null;
  title: string | null;
  publish_date: string | null;
}

interface ExtractError {
  url: string;
  error_type: string;
  http_status_code: number | null;
  content: string | null;
}

const handleLlmsTxt = async () => {
  try {
    // Fetch the JSON data
    const response = await fetch("https://mcp.llmtext.com/index.json");
    const data: any = await response.json();

    // Generate llms.txt content
    let content = "# llms.txt\n\n";

    // Add summary
    const totalServers = data.servers.length;
    const activeServers = data.servers.filter(
      (s: any) => s.total_requests > 0
    ).length;
    const totalUsers = data.users.length;
    const totalRequests = data.users.reduce(
      (sum: number, u: any) => sum + u.total_requests,
      0
    );
    const totalTokens = data.users.reduce(
      (sum: number, u: any) => sum + u.total_tokens,
      0
    );

    content += `> MCP Server Usage Statistics\n`;
    content += `> Total Servers: ${totalServers} (${activeServers} active)\n`;
    content += `> Total Users: ${totalUsers}\n`;
    content += `> Total Requests: ${totalRequests}\n`;
    content += `> Total Tokens Ingested: ${totalTokens.toLocaleString()}\n\n`;

    // Add active servers (those with requests > 0)
    const activeServersList = data.servers;

    if (activeServersList.length > 0) {
      for (const server of activeServersList) {
        const name = server.hostname;
        const url = `https://${server.hostname}/llms.txt`;
        const description =
          server.total_requests > 0
            ? `${
                server.total_requests
              } requests, ${server.total_tokens.toLocaleString()} tokens, ${
                server.unique_users
              } user${server.unique_users !== 1 ? "s" : ""}`
            : undefined;

        content += `- [${name}](${url})${
          description === undefined ? "" : `: ${description}`
        }\n`;
      }
    }

    // Return as text/plain
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response(
      "Error fetching or parsing data: " + (error as Error).message,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );
  }
};
