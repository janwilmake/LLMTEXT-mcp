Usage:

1. Copy over [next-agent-rewriter.ts](next-agent-rewriter.ts)

2. In `middleware.ts`

```ts
import { agentRewriter } from "./next-agent-rewriter";

export function middleware(request: NextRequest) {
  const rewriteResponse = agentRewriter(request, {
    // Set to true if you want the default to be HTML (when accept header is not specified)
    defaultHtml: false,

    rewriteTo: (pathname) =>
      // rewrite to another location: wherever the md-version is found
      `https://llm.mydomain.com${pathname}${
        pathname.includes(".") ? "" : ".md"
      }`,
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
