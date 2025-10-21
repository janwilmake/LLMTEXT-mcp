import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface MediaType {
  type: string;
  quality: number;
  index: number;
}

interface AgentRewriterConfig {
  defaultHtml?: boolean;
  /**
   * Custom function to determine rewrite destination.
   * If returns a string, rewrites to that URL (can be external domain).
   * If returns null/undefined, uses default .md behavior.
   *
   * @param pathname - The current request pathname
   * @returns URL string (absolute or relative) or null/undefined
   *
   * @example
   * ```ts
   * // Rewrite to external CDN
   * rewriteTo: (pathname) => `https://cdn.example.com/docs${pathname}.md`
   *
   * // Conditional external rewrite
   * rewriteTo: (pathname) => {
   *   if (pathname.startsWith('/docs')) {
   *     return `https://docs.example.com${pathname}`;
   *   }
   *   return null; // Use default .md behavior
   * }
   * ```
   *
   */
  rewriteTo?: (pathname: string) => string | null | undefined;
}

/**
 * Middleware function that rewrites URLs based on Accept headers.
 * Supports rewriting to external domains via rewriteTo function.
 *
 * Context:
 * https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects.md
 * https://nextjs.org/docs/app/api-reference/file-conventions/middleware.md
 *
 * @param request - The incoming NextRequest
 * @param config - Configuration options
 * @returns NextResponse to rewrite, or null
 *
 */
export function agentRewriter(
  request: NextRequest,
  config: AgentRewriterConfig = {}
): NextResponse | null {
  const { defaultHtml = false, rewriteTo } = config;
  const pathname = request.nextUrl.pathname;

  // Special paths that should always be rewritten when rewriteTo is available
  const specialPaths = ["/llms.txt", "/llms-full.txt"];
  const isSpecialPath = specialPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (rewriteTo && isSpecialPath) {
    return rewriteToDestination(request, pathname, rewriteTo);
  }

  // Skip API routes, Next.js internals, and metadata files
  // Note: .md files are no longer skipped when rewriteTo is available
  const shouldSkip =
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    (!rewriteTo && pathname.endsWith(".md"));

  if (shouldSkip) {
    return null;
  }

  const acceptHeader = request.headers.get("accept");

  // No Accept header - use default behavior
  if (!acceptHeader || acceptHeader === "*/*") {
    if (defaultHtml) {
      return null;
    }
    return rewriteToDestination(request, pathname, rewriteTo);
  }

  // Check if markdown/plain should be served based on proper Accept header parsing
  if (shouldServeMarkdown(acceptHeader, pathname)) {
    return rewriteToDestination(request, pathname, rewriteTo);
  }

  return null;
}

/**
 * Helper to rewrite request to destination (custom or default .md)
 */
function rewriteToDestination(
  request: NextRequest,
  pathname: string,
  rewriteTo?: (pathname: string) => string | null | undefined
): NextResponse {
  // Try custom rewrite function first
  if (rewriteTo) {
    const customDestination = rewriteTo(pathname);
    if (customDestination) {
      const isAbsolute =
        customDestination.startsWith("http://") ||
        customDestination.startsWith("https://") ||
        customDestination.startsWith("//");
      // Support both absolute URLs and relative paths
      const destination = isAbsolute
        ? customDestination
        : `${request.nextUrl.origin}${
            customDestination.startsWith("/")
              ? customDestination
              : "/" + customDestination
          }`;

      return NextResponse.rewrite(destination);
    }
  }

  // Default: append .md to current path (only if not already .md)
  const url = request.nextUrl.clone();
  if (!url.pathname.endsWith(".md")) {
    url.pathname = `${url.pathname}.md`;
  }
  return NextResponse.rewrite(url);
}

/**
 * Parses Accept header and determines if markdown should be served.
 */
function shouldServeMarkdown(acceptHeader: string, pathname: string): boolean {
  if (pathname.endsWith(".md")) {
    return true;
  }
  const mediaTypes: MediaType[] = [];

  const types = acceptHeader.split(",").map((t) => t.trim());

  types.forEach((type, index) => {
    const [mediaType, ...params] = type.split(";").map((p) => p.trim());
    let quality = 1.0;

    for (const param of params) {
      const [key, value] = param.split("=").map((p) => p.trim());
      if (key === "q" && value) {
        quality = parseFloat(value);
        if (isNaN(quality) || quality < 0 || quality > 1) {
          quality = 1.0;
        }
      }
    }

    mediaTypes.push({
      type: mediaType.toLowerCase(),
      quality,
      index,
    });
  });

  mediaTypes.sort((a, b) => {
    if (b.quality !== a.quality) {
      return b.quality - a.quality;
    }
    return a.index - b.index;
  });

  const highestPriority = mediaTypes[0];
  if (!highestPriority) {
    return false;
  }

  const markdownTypes = ["text/markdown", "text/plain", "text/*"];
  const htmlTypes = ["text/html"];

  const highestMarkdown = mediaTypes.find((mt) =>
    markdownTypes.some((md) => matchesMediaType(mt.type, md))
  );

  const highestHtml = mediaTypes.find((mt) =>
    htmlTypes.some((html) => matchesMediaType(mt.type, html))
  );

  if (!highestHtml) {
    return !!highestMarkdown && highestMarkdown.quality > 0;
  }

  if (!highestMarkdown) {
    return false;
  }

  if (highestMarkdown.quality > highestHtml.quality) {
    return true;
  }

  if (highestMarkdown.quality === highestHtml.quality) {
    return highestMarkdown.index < highestHtml.index;
  }

  return false;
}

function matchesMediaType(type: string, pattern: string): boolean {
  if (pattern === "*/*") return true;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1);
    return type.startsWith(prefix);
  }
  return type === pattern;
}
