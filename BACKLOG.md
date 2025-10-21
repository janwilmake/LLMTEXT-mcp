# More

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
