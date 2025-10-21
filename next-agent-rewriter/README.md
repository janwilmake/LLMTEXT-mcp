Usage:

1. Copy over [next-agent-rewriter.ts](next-agent-rewriter.ts)

2. In `middleware.ts`

```ts
import { agentRewriter, rewriteToStatic } from "./next-agent-rewriter";

export function middleware(request: NextRequest) {
  const rewriteResponse = agentRewriter(request, {
    // Set to true if you want the default to be HTML (when accept header is not specified)
    defaultHtml: false,
    // Handler to respond a url to rewrite to when agent-friendly response is preferred
    rewriteTo: rewriteToStatic("https://llm.parallel.ai"),
,
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
