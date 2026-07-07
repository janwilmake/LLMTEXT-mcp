/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

import { renderPage, type TabId } from "./pages";

export interface Env {}

const PARALLEL_OAUTH_BASE = "https://platform.parallel.ai";
const CLIENT_ID = "llmtext.com";
const REDIRECT_URI = "https://llmtext.com/callback";
const COOKIE_NAME = "parallel_api_key";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Cache index.json for 5 minutes
let cachedData: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchIndexData(): Promise<any> {
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < CACHE_TTL) {
    return cachedData.data;
  }
  try {
    const response = await fetch("https://mcp.llmtext.com/index.json");
    const data = await response.json();
    cachedData = { data, timestamp: now };
    return data;
  } catch {
    return cachedData?.data || null;
  }
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}

const TAB_ROUTES: Record<string, TabId> = {
  "/create": "create",
  "/check": "check",
  "/install": "install",
  "/faq": "faq",
};

export default {
  async fetch(
    request: Request,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Redirect root to /install
    if (path === "/") {
      return Response.redirect(`${url.origin}/install`, 302);
    }

    // Legacy: /check/{hostname} redirect
    if (path.startsWith("/check/")) {
      const hostname = path.split("/check/")[1];
      const checkUrl = `https://${hostname}/llms.txt`;
      return Response.redirect(
        `${url.origin}/check?url=${encodeURIComponent(checkUrl)}`,
        302,
      );
    }

    // Legacy: /?check= redirect
    if (path === "/" && url.searchParams.has("check")) {
      const checkUrl = url.searchParams.get("check")!;
      return Response.redirect(
        `${url.origin}/check?url=${encodeURIComponent(checkUrl)}`,
        302,
      );
    }

    if (path === "/llms.txt") {
      return handleLlmsTxt();
    }

    if (path === "/authorize") {
      const redirectTo = url.searchParams.get("redirect_to") || "/";
      return redirectToOAuth(redirectTo);
    }

    if (path === "/callback") {
      return handleCallback(request);
    }

    // Tab pages
    const tabId = TAB_ROUTES[path];
    if (tabId) {
      const data = tabId === "install" ? await fetchIndexData() : null;
      return htmlResponse(renderPage(tabId, data));
    }

    // 404 for everything else
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function redirectToOAuth(originalPath: string): Promise<Response> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state = btoa(
    JSON.stringify({
      originalPath,
      codeVerifier,
      timestamp: Date.now(),
    }),
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

    const headers = new Headers();
    headers.set("Location", stateData.originalPath || "/");
    const securePart = REDIRECT_URI.startsWith("http://") ? "" : " Secure;";
    headers.set(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(
        tokenData.access_token,
      )}; HttpOnly;${securePart} SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`,
    );

    return new Response(null, { status: 302, headers });
  } catch (error) {
    return new Response(
      `Error exchanging token: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { status: 500 },
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

const handleLlmsTxt = async () => {
  try {
    const data = await fetchIndexData();
    if (!data) throw new Error("Failed to fetch data");

    let content = "# llms.txt\n\n";

    const activeServersList = data.servers.filter((x: any) => !!x.valid);
    const totalServers = activeServersList.length;
    const activeServers = activeServersList.filter(
      (s: any) => s.total_requests > 0,
    ).length;
    const totalUsers = data.users.length;
    const totalRequests = data.users.reduce(
      (sum: number, u: any) => sum + u.total_requests,
      0,
    );
    const totalTokens = data.users.reduce(
      (sum: number, u: any) => sum + u.total_tokens,
      0,
    );

    content += `> MCP Server Usage Statistics\n`;
    content += `> Total Servers: ${totalServers} (${activeServers} active)\n`;
    content += `> Total Users: ${totalUsers}\n`;
    content += `> Total Requests: ${totalRequests}\n`;
    content += `> Total Tokens Ingested: ${totalTokens.toLocaleString()}\n\n`;

    content += `## llms.txt MCP Servers\n\n`;

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
        headers: { "Content-Type": "text/plain" },
      },
    );
  }
};
