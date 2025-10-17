/// <reference types="@cloudflare/workers-types" />
/// <reference lib="esnext" />

import { extractFromSitemap } from "./mod.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const apiKey = request.headers
      .get("Authorization")
      ?.slice("Bearer ".length);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Authorization header not configured" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse parameters from request
    const url = new URL(request.url);
    const origin =
      url.searchParams.get("origin") || url.searchParams.get("hostname");
    const forceExtract = url.searchParams.get("forceExtract") === "true";

    if (!origin) {
      return new Response(
        JSON.stringify({
          error: "Missing 'origin' or 'hostname' query parameter",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const results = await extractFromSitemap(origin, forceExtract, apiKey);
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json;charset=utf8" },
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
