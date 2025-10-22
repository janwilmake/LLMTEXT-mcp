# More

## Improve recurring llms.txt generation

- `llms.txt`: For each source, group links by path like they do in https://github.com/apify/actor-llmstxt-generator/pull/16
- Fix it so it works for recursive sitemaps: https://developers.cloudflare.com/sitemap.xml
- Remove newlines in descriptions to be according to spec.
- Ensure not to hit `/extract` urls count limitation or other errors. log them.
- Check spec and see what else is non-compliant.
- Setup auto-update of https://github.com/janwilmake/parallel-llmtext using parallel secret and cloudflare deployment secret; Set to update and redeploy hourly while optimizing for cost. Important to have this as well, or our llms.txt will get outdated.
- Setup auto-prompt for https://github.com/parallel-web/parallel-sdk-typescript and https://github.com/parallel-web/parallel-sdk-python (and get prs merged for this)

Question: what's the easiest way for people to set up doing prompts and other apis from private enterprise repos in a reliable way?

- try github way first
- then make it easier using contextarea if possible

## Benchmark

Can I somehow benchmark running the MCP within Claude Sonnet 4.5 programmatically, then also running Context7, and compare total tokens ingested for a correct answer? It would need to be complicated queries that require getting several docs pages for this to work well.

## New APIs for extracting context from multiple pages

1. somehow use objective and other capabilities of `/extract`
2. likely need to also create a sitemap cache with a DO per domain, but let's deprioritize this since it's sponsored fully by parallel now with $10/user.

## PR: Improve human/machine toggling interface

- Button on `/ai/{path}` page that opens `{path}.md`
- Bug: parallel.ai clicking "ai" doesn't go to `/ai`. Weird loop in development too

## Improve parallel.ai/llms.txt

- Optional: use Sanity; Sanity uses [portable text](https://github.com/sanity-io/block-content-to-markdown) to retrieve the content. there is [a library](https://github.com/sanity-io/block-content-to-markdown) to turn this datastructure into markdown.

# Idea - LLMTEXT MCP => Hosted version of the library?

- Optimize for speed (more parallelism, add description to extract endpoint)
- Allow for >500 urls (use DO and reset fetch counter during extraction using alarm)
- Host the result on `subdoman_domain_tld.markdownvariant.com` and bring MCP hosting together
- Determine other authored content, maybe include this as well?

# Sitemap creation library

- If sitemap wasn't found, generate one? https://docs.firecrawl.dev/features/map

# Newer MCP features

<!-- No direct benefit but cool to have later -->

- Icon: retrieve icon from hostname or apex hostname, pass it into MCP protocol
- MCP UI protocol: for retrieving urls show token count, for leaderboard make a very nice rendering with carousels
- Add ratelimit of requests per user!

# Premium - Slop Guide tool

Create a higher level slopguide tool:

- takes in an 'objective' and 'urls'. instructed to pass wider scope of urls than normal
- concatenates all urls, then uses `/chat/completions` asked to reply with subset of relevant files/sections.
- create subset doc and respond with it

This tool would take a little longer but creates perfect docs for a particular objective, naturally creating a 2-step flow without polluting context.

Let parallel.ai pay for this compute with appropriate ratelimit per user.

# Allow GitHub repos

- By default, use file hierarchy for this with readme upfront like I did with llms.uithub.com.
- If available, use `llms.txt` in it's stead
- Url structure can be `/owner/repo/mcp`, I can easily parse it as long as it ends with `/mcp`

(Maybe it's better to make this a separate project!)

# Get tokenws per page into llms.txt

We can parse and alter the llms.txt (and cache) to retrieve token counts and add that to the descriptions.
