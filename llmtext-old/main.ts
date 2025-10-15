interface Env {
  CACHED_URLS: KVNamespace;
}

const ZIPOBJECT_BASE = "https://zipobject.com";
const READER_BASE = "https://llmtext-reader.vercel.app";

interface CacheEntry {
  url: string;
  timestamp: number;
}

export const prependProtocol = (maybeFullUrl: string): string => {
  if (
    maybeFullUrl.startsWith("http://") ||
    maybeFullUrl.startsWith("https://")
  ) {
    return maybeFullUrl;
  }
  return "https://" + maybeFullUrl;
};
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = prependProtocol(decodeURIComponent(url.pathname.slice(1)));
  console.log({ targetUrl });
  // Validate URL
  let targetUrlParse: URL;
  try {
    targetUrlParse = new URL(targetUrl);
    if (!targetUrlParse.searchParams.get("maxTokens")) {
      // default value for llmtext
      targetUrlParse.searchParams.set("maxTokens", "25000");
    }
    if (!targetUrlParse.searchParams.get("accept")) {
      // default value for llmtext
      targetUrlParse.searchParams.set("accept", "text/markdown");
    }
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  const kvKey = `v1.${targetUrl}`;
  // Check cache first
  const cachedResult = await env.CACHED_URLS.get<CacheEntry>(kvKey, "json");
  if (
    cachedResult &&
    Date.now() - cachedResult.timestamp < 24 * 60 * 60 * 1000
  ) {
    return fetch(cachedResult.url);
  }

  const zipObjectUrl = `${ZIPOBJECT_BASE}/${targetUrlParse.toString()}`;
  // Try ZIPObject first
  try {
    const zipResponse = await fetch(zipObjectUrl, {
      headers: { Accept: "text/markdown" },
    });

    if (zipResponse.ok) {
      // Cache the successful result
      await env.CACHED_URLS.put(
        kvKey,
        JSON.stringify({
          url: zipResponse.url,
          timestamp: Date.now(),
        }),
      );

      return zipResponse;
    }
  } catch (error) {
    console.error("ZIPObject fetch failed:", error);
  }

  // Try Reader API if ZIPObject fails
  try {
    const readerResponse = await fetch(
      `${READER_BASE}/md/${encodeURIComponent(targetUrl)}`,
    );

    if (readerResponse.ok) {
      // Cache the successful result
      await env.CACHED_URLS.put(
        kvKey,
        JSON.stringify({
          url: readerResponse.url,
          timestamp: Date.now(),
        }),
      );

      return readerResponse;
    }
  } catch (error) {
    console.error("Reader API fetch failed:", error);
  }

  // If both attempts fail, return 404
  return new Response("Content not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Unexpected error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
