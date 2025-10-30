<!-- https://contextarea.com/rules-httpsuithu-og3vrs7kln288o -->

# Discussion: llms.txt Discovery and Placement Strategy

## Current State and Ambiguity

The current llms.txt specification states that files should be "located in the root path `/llms.txt` of a website **(or, optionally, in a subpath)**" but provides no concrete guidance on:

- How to discover llms.txt files in subpaths
- Whether multiple llms.txt files can coexist at different levels
- What conventions should govern subpath naming
- How tooling should handle discovery in a standardized way

This ambiguity has real consequences. As noted in the LLMTEXT toolkit launch, many implementations fail validation because they serve llms.txt at non-root locations like `https://www.mintlify.com/docs/llms.txt` or `https://nextjs.org/docs/llms.txt`, making them hard to find programmatically.

## Proposal: A Three-Tiered Discovery Mechanism

### 1. Primary Location: `/llms.txt` at Root (Required)

Every website implementing the standard **must** serve a primary llms.txt at the root domain:

- `https://example.com/llms.txt`

This serves as the canonical discovery point, following the established pattern of `/robots.txt` and `/sitemap.xml`. Tools, agents, and MCP servers should always check this location first.

**Rationale:** Predictable, universal discovery without requiring HTTP negotiations or HTML parsing.

### 2. Secondary Locations: Subpath llms.txt Files (Optional)

Websites **may** serve additional llms.txt files at any subpath for scoped documentation:

- `https://example.com/docs/api/llms.txt` (API-specific documentation)
- `https://github.com/username/repo/llms.txt` (Repository-level documentation)
- `https://example.com/products/widget/llms.txt` (Product-specific information)

**Use cases:**

- **Multi-product companies:** Separate llms.txt for each product line
- **Code hosting platforms:** Per-repository documentation contexts
- **Large documentation sites:** Section-specific contexts to avoid token bloat
- **Multi-tenant platforms:** User or organization-specific contexts

### 3. Discovery Mechanism: Link Headers → Link Tags → Path Walking

To enable programmatic discovery of subpath llms.txt files without requiring standardized paths, implement a cascading discovery mechanism:

#### Option A: HTTP Link Header (Preferred)

```http
Link: </docs/api/llms.txt>; rel="llms-txt"
```

When an agent requests any URL, the server can indicate the relevant llms.txt via the `Link` response header. This works for any content type and requires no HTML parsing.

**Example workflow:**

1. Agent requests `https://example.com/docs/api/endpoints.html`
2. Server responds with `Link: </docs/api/llms.txt>; rel="llms-txt"`
3. Agent discovers context-appropriate llms.txt

#### Option B: HTML Link Tag (Fallback)

For HTML responses, use a `<link>` tag in the `<head>`:

```html
<link rel="llms-txt" href="/docs/api/llms.txt" />
```

This requires HTML parsing but remains straightforward for web-based content.

#### Option C: Path Segment Walking (Last Resort)

If neither Link header nor HTML tag is present, agents may attempt discovery by walking up path segments:

For URL `https://example.com/docs/api/v2/endpoints.html`, try:

1. `/docs/api/v2/llms.txt`
2. `/docs/api/llms.txt`
3. `/docs/llms.txt`
4. `/llms.txt` (root, always exists per requirement)

**Caveats:** This creates multiple HTTP requests and may result in false positives. Should be used sparingly.

## Benefits of This Approach

### 1. **Backward Compatibility**

Existing implementations with root-level llms.txt continue working without changes. The requirement for root-level placement matches current best practices.

### 2. **Scalability**

Large sites can scope contexts appropriately. Instead of a 36k token llms.txt like Cloudflare's current implementation, they could have:

- `/llms.txt` (high-level overview)
- `/workers/llms.txt` (Workers-specific docs)
- `/r2/llms.txt` (R2-specific docs)
- `/pages/llms.txt` (Pages-specific docs)

### 3. **Discoverability**

The Link header mechanism enables automatic, efficient discovery without guessing paths or parsing HTML for every page.

### 4. **Flexibility for Platform Providers**

GitHub, GitLab, or documentation hosting platforms can serve repository or project-specific llms.txt files while maintaining their own root-level overview.

### 5. **Token Efficiency**

Agents can load precisely the context they need rather than ingesting massive omnibus llms.txt files. The llms.txt MCP tool could use Link headers to automatically discover the most relevant context.

## Implementation Considerations

### For Website Operators

**Minimum viable implementation:**

```http
GET /llms.txt HTTP/1.1
Host: example.com

HTTP/1.1 200 OK
Content-Type: text/markdown
```

**Enhanced implementation with subpaths:**

```http
GET /docs/api/endpoint-guide.html HTTP/1.1
Host: example.com

HTTP/1.1 200 OK
Content-Type: text/html
Link: </docs/api/llms.txt>; rel="llms-txt"
```

### For Tool Builders

The LLMTEXT Check tool and llms.txt MCP should:

1. **Always validate** that `/llms.txt` exists at root
2. **Parse Link headers** from responses when discovering context
3. **Support HTML link tag** parsing as fallback
4. **Optionally implement** path segment walking with rate limiting
5. **Cache discovery results** to minimize redundant requests

### For the Specification

The llms.txt spec should be updated to include:

1. Explicit requirement for root-level `/llms.txt`
2. Permission for subpath llms.txt files
3. Specification of the `rel="llms-txt"` link relation
4. Recommendation for Link headers over HTML tags
5. Example implementations for common web servers (nginx, Apache, CDNs)

## Potential Challenges

### 1. **Link Header Adoption**

Many CMS platforms and static site generators don't easily support custom Link headers. The spec should provide clear implementation examples.

### 2. **Caching Complexity**

CDNs and proxies must properly cache Link headers. Documentation should address common caching scenarios.

### 3. **Path Walking Abuse**

Without rate limiting, agents performing path segment walking could generate significant traffic. The spec should recommend limits (e.g., maximum 5 attempts, exponential backoff).

### 4. **Ambiguity Resolution**

If multiple llms.txt files are discovered (via Link header + path walking), which takes precedence? Proposal: Link header > path walking, most specific path wins.

## Conclusion

By requiring `/llms.txt` at the root while enabling optional subpath placement with standardized discovery via Link headers, the llms.txt standard can maintain simplicity for basic implementations while supporting the scalability needs of complex, multi-product websites. This approach:

- Preserves the simplicity that made `/robots.txt` successful
- Enables the flexibility needed for modern web architectures
- Provides clear, programmatic discovery mechanisms
- Supports the token-efficient context management that makes llms.txt valuable

The LLMTEXT toolkit launch demonstrates both the promise of llms.txt adoption and the practical challenges of ambiguous specifications. By formalizing discovery mechanisms now, we can ensure the standard scales effectively as AI agents become the primary consumers of web content.
