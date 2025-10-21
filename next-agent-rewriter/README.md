Usage:

1. Copy over [next-agent-rewriter.ts](next-agent-rewriter.ts)

2. In `middleware.ts`

```ts
import { agentRewriter } from "./next-agent-rewriter";

export function middleware(request: NextRequest) {
  const rewriteResponse = agentRewriter(request, {
    // Set to true if you want the default to be HTML (when accept header is not specified)
    defaultHtml: false,

    rewriteTo: (pathname) => {
      const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
      const hasExtension = lastSegment.includes(".");
      return `https://llm.parallel.ai${pathname}${hasExtension ? "" : ".md"}`;
    },
  });
  if (rewriteResponse) {
    return rewriteResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
```
