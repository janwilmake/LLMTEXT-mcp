# TODO

## Parallel PR

- ✅ intercept `accept:text/markdown` requests
- ✅ Route accept: `text/markdown` requests should rewrite to llm.parallel.ai
- ✅ `.md` suffix should be catched as well if `rewriteTo` is available
- ✅ `llms.txt, llms-full.txt, /mcp` should rewrite to llm.parallel.ai (if available)
- ✅ Put all .md files into https://github.com/janwilmake/parallel-llmtext using build script.
- ✅ Every path on parallel.ai has `.md` available (ensure they are all in sitemap, no 404s are in sitemap, and we re-generate from that new sitemap)
- ✅ Add `<link rel="alternate" type="text/markdown" href="{path}.md" title="Docs" />` into metadata for each html page!

## PR: Improve human/machine toggling interface

- Button on `/ai/{path}` page that opens `{path}.md`
- Bug: parallel.ai clicking "ai" doesn't go to `/ai`. Weird loop in development too

## Improve parallel.ai/llms.txt

- Optional: use Sanity; Sanity uses [portable text](https://github.com/sanity-io/block-content-to-markdown) to retrieve the content. there is [a library](https://github.com/sanity-io/block-content-to-markdown) to turn this datastructure into markdown.

## `developer-mcp.parallel.ai`

Rather than the X OAuthed MCP... Host a bare version of the MCP here, maybe?

# Sources

Create larger `llms.txt` hosted at https://parallel.ai/llms.txt with docs + sdks + blogs

- https://docs.parallel.ai/ (md already available)
- https://parallel.ai/ (use jina for each page)
- ❌ https://jobs.ashbyhq.com/parallel (use something like firecrawl)
- https://status.parallel.ai

Make a prompt that gets a summary of each SDK, make a PR for this in each SDK.

- https://github.com/parallel-web/parallel-sdk-python
- https://github.com/parallel-web/parallel-sdk-typescript

# Idea - LLMTEXT MCP => Hosted version of the library?

(Useful for easiest adoption)

- Optimize for speed (more parallelism, add description to extract endpoint)
- Allow for >500 urls (use DO and reset fetch counter during extraction using alarm)
- Host the result on `subdoman_domain_tld.markdownvariant.com` and bring MCP hosting together
- Determine other authored content, maybe include this as well?

# Sitemap creation library

- If sitemap wasn't found, generate one? https://docs.firecrawl.dev/features/map

# Further refinements

- ✅ LLMtext by parallel (-> read blogpost)
- Link to `llms.txt` files
- ⏳ For professionally linking it to LLMTEXT, put social login at https://login.llmtext.com with LLMTEXT X Account
- Highlight the social element more: top 10 users per server + overall top 10 leaderboard
- Give people an option to opt-out of the social element before logging in with X (for simplicity, login with X remains required)
- Make it OSS and easy to host yourself. Invite contributions.

# Blog

- Why this is better than context7
- Reasoning over a table of contents > vector search?
- Every website needs an llms.txt, not just docs sites!
- Parallel.ai llms.txt combines main website + docs + socials

# Launch

- Open issue in https://github.com/AnswerDotAI/llms-txt
- Reach out to https://x.com/jeremyphoward (somehow)
- On parallel cookbook, remove old stuff, add this one.
- On parallel docs, link to this (If X OAuth is OK)
- Launch it on MCP directories in a way that context7/gitmcp did it too
- Use it for https://docs.parallel.ai/llms.txt and make demo
- X Launch post
