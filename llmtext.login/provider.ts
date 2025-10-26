/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

export interface Env {
  SELF_CLIENT_ID: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
  ENCRYPTION_SECRET: string;
  TEMP_STATE: KVNamespace;
}

interface OAuthState {
  clientId: string;
  redirectUri: string;
  clientState: string | null;
  resource: string;
  codeVerifier: string;
}

interface TokenData {
  userId: string;
  username: string;
  name: string;
  profileImageUrl?: string;
  verified?: boolean;
  xAccessToken: string;
  hideFromLeaderboard?: boolean;
  exp: number;
}

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function handleOAuth(
  request: Request,
  env: Env,
  allowedClients?: string[]
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // OPTIONS handling
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }

  if (
    !env.X_CLIENT_ID ||
    !env.X_CLIENT_SECRET ||
    !env.SELF_CLIENT_ID ||
    !env.TEMP_STATE
  ) {
    return new Response("Environment misconfigured", { status: 500 });
  }

  // OAuth 2.0 Authorization Server Metadata
  if (path === "/.well-known/oauth-authorization-server") {
    return new Response(
      JSON.stringify(
        {
          issuer: url.origin,
          authorization_endpoint: `${url.origin}/authorize`,
          token_endpoint: `${url.origin}/token`,
          token_endpoint_auth_methods_supported: ["none"],
          registration_endpoint: `${url.origin}/register`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code"],
          code_challenge_methods_supported: ["S256"],
          scopes_supported: ["users.read", "tweet.read", "offline.access"],
        },
        null,
        2
      ),
      { headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // OAuth 2.0 Protected Resource Metadata
  if (path === "/.well-known/oauth-protected-resource") {
    return new Response(
      JSON.stringify(
        {
          resource: url.origin,
          authorization_servers: [url.origin],
          scopes_supported: ["users.read", "tweet.read", "offline.access"],
          bearer_methods_supported: ["header"],
          resource_documentation: url.origin,
        },
        null,
        2
      ),
      { headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Dynamic Client Registration
  if (path === "/register") {
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: getCorsHeaders(),
      });
    }

    try {
      const body = await request.json();

      if (
        !body.redirect_uris ||
        !Array.isArray(body.redirect_uris) ||
        body.redirect_uris.length === 0
      ) {
        return new Response(
          JSON.stringify({
            error: "invalid_client_metadata",
            error_description: "redirect_uris must be a non-empty array",
          }),
          {
            status: 400,
            headers: {
              ...getCorsHeaders(),
              "Content-Type": "application/json",
            },
          }
        );
      }

      const hostnames = new Set<string>();
      for (const uri of body.redirect_uris) {
        try {
          hostnames.add(new URL(uri).hostname);
        } catch (e) {
          return new Response(
            JSON.stringify({
              error: "invalid_redirect_uri",
              error_description: `Invalid redirect URI: ${uri}`,
            }),
            {
              status: 400,
              headers: {
                ...getCorsHeaders(),
                "Content-Type": "application/json",
              },
            }
          );
        }
      }

      return new Response(
        JSON.stringify(
          {
            client_id: Array.from(hostnames)[0],
            redirect_uris: body.redirect_uris,
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code"],
            response_types: ["code"],
          },
          null,
          2
        ),
        {
          status: 201,
          headers: {
            ...getCorsHeaders(),
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "invalid_client_metadata" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
        }
      );
    }
  }

  // Authorization endpoint with consent screen
  if (path === "/authorize") {
    const clientId = url.searchParams.get("client_id");
    let redirectUri = url.searchParams.get("redirect_uri");
    const clientState = url.searchParams.get("state");
    const resource =
      url.searchParams.get("resource") ||
      (clientId ? `https://${clientId}` : url.origin);

    if (!clientId) {
      return new Response("client_id is required", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    if (!isValidDomain(clientId) && clientId !== "localhost") {
      return new Response("Invalid client_id", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    if (allowedClients && !allowedClients.includes(clientId)) {
      return new Response(
        `Client ${clientId} not allowed. Allowed: ${allowedClients.join(", ")}`,
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (!redirectUri) {
      redirectUri = `https://${clientId}/callback`;
    }

    try {
      const redirectUrl = new URL(redirectUri);
      if (
        redirectUrl.protocol === "http:" &&
        redirectUrl.hostname !== "localhost" &&
        redirectUrl.hostname !== "127.0.0.1"
      ) {
        return new Response("redirect_uri must use HTTPS unless localhost", {
          status: 400,
          headers: getCorsHeaders(),
        });
      }
    } catch {
      return new Response("Invalid redirect_uri format", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store OAuth state
    const oauthState: OAuthState = {
      clientId,
      redirectUri,
      clientState,
      resource,
      codeVerifier,
    };

    const stateId = generateCodeVerifier();
    await env.TEMP_STATE.put(stateId, JSON.stringify(oauthState), {
      expirationTtl: 600,
    });

    // Build X OAuth URL
    const xUrl = new URL("https://x.com/i/oauth2/authorize");
    xUrl.searchParams.set("response_type", "code");
    xUrl.searchParams.set("client_id", env.X_CLIENT_ID);
    xUrl.searchParams.set("redirect_uri", `${url.origin}/callback`);
    xUrl.searchParams.set("scope", "users.read tweet.read offline.access");
    xUrl.searchParams.set("state", stateId);
    xUrl.searchParams.set("code_challenge", codeChallenge);
    xUrl.searchParams.set("code_challenge_method", "S256");

    // Consent screen matching llmtext.com design
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in with X - LLMTEXT</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #fcfcfa;
      color: #1d1b16;
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e5e0;
      gap: 0.5rem;
    }

    .logo {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .logo-box {
      background: #1d1b16;
      padding: 0.0rem 0.5rem;
      display: flex;
      align-items: baseline;
      gap: 0.1rem;
      border-radius: 2px;
    }

    .logo-main {
      font-size: 1rem;
      font-weight: bold;
      letter-spacing: 0.05em;
      color: white;
    }

    .logo-com {
      font-size: 0.7rem;
      font-weight: bold;
      letter-spacing: 0.05em;
      color: white;
    }

    .container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }

    .auth-card {
      background: white;
      border: 2px solid #1d1b16;
      border-radius: 8px;
      padding: 2rem;
      max-width: 500px;
      width: 100%;
    }

    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      color: #1d1b16;
    }

    .subtitle {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 2rem;
    }

    .info-box {
      background: #f5f5f0;
      border: 1px solid #e5e5e0;
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.85rem;
      color: #666;
    }

    .checkbox-container {
      margin-bottom: 1.5rem;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    input[type="checkbox"] {
      margin-top: 0.25rem;
      width: 18px;
      height: 18px;
      cursor: pointer;
      flex-shrink: 0;
    }

    .checkbox-label {
      font-size: 0.85rem;
      color: #1d1b16;
      cursor: pointer;
      user-select: none;
    }

    .btn-primary {
      width: 100%;
      padding: 0.875rem 2rem;
      background: #1d1b16;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-primary:hover {
      background: #2d2b26;
    }

    .btn-secondary {
      width: 100%;
      padding: 0.875rem 2rem;
      background: transparent;
      color: #1d1b16;
      border: 2px solid #ccc;
      border-radius: 4px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 0.75rem;
      transition: background 0.2s;
    }

    .btn-secondary:hover {
      background: #f0f0ed;
    }

    @media (min-width: 640px) {
      .logo-main {
        font-size: 1.25rem;
      }

      .logo-com {
        font-size: 0.85rem;
      }

      h1 {
        font-size: 1.75rem;
      }

      .auth-card {
        padding: 2.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-box">
        <span class="logo-main">LLMTEXT</span>
        <span class="logo-com">.com</span>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="auth-card">
      <h1>Sign in with X</h1>
      <p class="subtitle">LLMTEXT needs you to login with X to continue</p>

      <div class="info-box">
        By signing in, you allow LLMTEXT to access your X profile information. This helps us provide personalized features and improve your experience.
      </div>

      <form id="authForm">
        <div class="checkbox-container">
          <input type="checkbox" id="hideFromLeaderboard" name="hideFromLeaderboard">
          <label for="hideFromLeaderboard" class="checkbox-label">
            I do not want to be shown in the leaderboard
          </label>
        </div>

        <button type="submit" class="btn-primary">Continue with X</button>
        <button type="button" onclick="window.close()" class="btn-secondary">Cancel</button>
      </form>
    </div>
  </div>

  <script>
    document.getElementById('authForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const hideFromLeaderboard = document.getElementById('hideFromLeaderboard').checked;
      const url = new URL('${xUrl}');
      if (hideFromLeaderboard) {
        url.searchParams.set('hide_from_leaderboard', '1');
      }
      window.location.href = url.toString();
    });
  </script>
</body>
</html>`,
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  }

  // X OAuth callback
  if (path === "/callback") {
    const code = url.searchParams.get("code");
    const stateId = url.searchParams.get("state");
    const hideFromLeaderboard =
      url.searchParams.get("hide_from_leaderboard") === "1";

    if (!code || !stateId) {
      return new Response("Missing code or state", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const stateJson = await env.TEMP_STATE.get(stateId);
    if (!stateJson) {
      return new Response("Invalid or expired state", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const state: OAuthState = JSON.parse(stateJson);

    // Exchange code for token with X
    const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(
          `${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`
        )}`,
      },
      body: new URLSearchParams({
        code,
        redirect_uri: `${url.origin}/callback`,
        grant_type: "authorization_code",
        code_verifier: state.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      return new Response(`X API error: ${await tokenResponse.text()}`, {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const tokenData = (await tokenResponse.json()) as any;

    // Get user info from X
    const userResponse = await fetch(
      "https://api.x.com/2/users/me?user.fields=profile_image_url,verified",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    if (!userResponse.ok) {
      return new Response("Failed to get user info", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const userData = (await userResponse.json()) as any;
    const user = userData.data;

    // Create auth code
    const authCode = generateCodeVerifier();
    await env.TEMP_STATE.put(
      `code:${authCode}`,
      JSON.stringify({
        userId: user.id,
        username: user.username,
        name: user.name,
        profileImageUrl: user.profile_image_url?.replace("_normal", "_400x400"),
        verified: user.verified,
        xAccessToken: tokenData.access_token,
        hideFromLeaderboard,
        clientId: state.clientId,
        redirectUri: state.redirectUri,
        resource: state.resource,
      }),
      { expirationTtl: 600 }
    );

    await env.TEMP_STATE.delete(stateId);

    // Redirect to client
    const redirectUrl = new URL(state.redirectUri);
    redirectUrl.searchParams.set("code", authCode);
    if (state.clientState) {
      redirectUrl.searchParams.set("state", state.clientState);
    }

    return new Response(null, {
      status: 302,
      headers: { ...getCorsHeaders(), Location: redirectUrl.toString() },
    });
  }

  // Token endpoint
  if (path === "/token") {
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: getCorsHeaders(),
      });
    }

    const formData = await request.formData();
    const code = formData.get("code");
    const clientId = formData.get("client_id");
    const redirectUri = formData.get("redirect_uri");
    const resource = formData.get("resource");

    if (!code || !clientId) {
      return new Response(JSON.stringify({ error: "invalid_request" }), {
        status: 400,
        headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
      });
    }

    const authDataJson = await env.TEMP_STATE.get(`code:${code}`);
    if (!authDataJson) {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
      });
    }

    const authData = JSON.parse(authDataJson);

    if (
      authData.clientId !== clientId ||
      (redirectUri && authData.redirectUri !== redirectUri) ||
      authData.resource !== resource
    ) {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
      });
    }

    // Create encrypted access token with hideFromLeaderboard preference
    const tokenData: TokenData = {
      userId: authData.userId,
      username: authData.username,
      name: authData.name,
      profileImageUrl: authData.profileImageUrl,
      verified: authData.verified,
      xAccessToken: authData.xAccessToken,
      hideFromLeaderboard: authData.hideFromLeaderboard || false,
      exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    };

    const accessToken = `simple_${await encrypt(
      JSON.stringify(tokenData),
      env.ENCRYPTION_SECRET
    )}`;

    await env.TEMP_STATE.delete(`code:${code}`);

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        token_type: "bearer",
        scope: "users.read tweet.read offline.access",
      }),
      { headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // /me endpoint
  if (path === "/me") {
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
      });
    }

    const authHeader = request.headers.get("Authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer realm="main", login_url="${url.origin}/authorize?client_id=${env.SELF_CLIENT_ID}"`,
        },
      });
    }

    try {
      if (!accessToken.startsWith("simple_")) throw new Error("Invalid format");

      const tokenData: TokenData = JSON.parse(
        await decrypt(accessToken.substring(7), env.ENCRYPTION_SECRET)
      );

      if (tokenData.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
      }

      return new Response(
        JSON.stringify({
          id: tokenData.userId,
          username: tokenData.username,
          name: tokenData.name,
          profile_image_url: tokenData.profileImageUrl,
          verified: tokenData.verified,
          hide_from_leaderboard: tokenData.hideFromLeaderboard || false,
        }),
        { headers: { ...getCorsHeaders(), "Content-Type": "application/json" } }
      );
    } catch {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer realm="main", error="invalid_token"`,
        },
      });
    }
  }

  return null;
}

function isValidDomain(domain: string): boolean {
  return (
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
      domain
    ) &&
    domain.includes(".") &&
    domain.length <= 253
  );
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function encrypt(text: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );

  const combined = new Uint8Array(
    salt.length + iv.length + encrypted.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function decrypt(encrypted: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const combined = new Uint8Array(
    atob(encrypted.replace(/-/g, "+").replace(/_/g, "/"))
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}
