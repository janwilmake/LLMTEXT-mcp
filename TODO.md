# TODO

High level

1. Our own llms.txt is perfect and auto-updates
2. Libraries works and properly guides people to do the same
3. MCP serves all work as intended.

Later:

- Hosted version of llms.txt generation, user-budget + cache
- See [backlog](BACKLOG.md)

## Parallel PR

- ✅ intercept `accept:text/markdown` requests
- ✅ Route accept: `text/markdown` requests should rewrite to llm.parallel.ai
- ✅ `.md` suffix should be catched as well if `rewriteTo` is available
- ✅ `llms.txt, llms-full.txt, /mcp` should rewrite to llm.parallel.ai (if available)
- ✅ Put all .md files into https://github.com/janwilmake/parallel-llmtext using build script.
- ✅ Every path on parallel.ai has `.md` available (ensure they are all in sitemap, no 404s are in sitemap, and we re-generate from that new sitemap)
- ✅ Add `<link rel="alternate" type="text/markdown" href="{path}.md" title="Docs" />` into metadata for each html page!

## Website

- ✅ Adhere to figma design
- ✅ Ensure mcp.parallel.ai serves data as JSON at `index.json`, including top 10 users leaderboard
- ✅ link from hostname to raw `llms.txt`
- ✅ Fetch that and overwrite `window.data` in the HTML using node-script pre-deploy
- ✅ Document check API and add llmstxt-check-tool.
- ✅ Checktool bug: 404 for https://docs.zapier.com/llms.txt and even for https://modelcontextprotocol.io/llms.txt even though they exist.

## Finalize MCP + listings

- Use the check-api on all servers and ensure that the ones that have HTML only in their contents get filtered out. These aren't valid.
- When entering a new llms.txt URL to create an MCP, perform the check first, and only redirect to installation page when it's confirmed that it is actually good
- Ensure relative links are also correctly fetched from the right hostname. Ensure hostname is part of description clearly.
- Give people an option to opt-out of the social element before logging in with X (for simplicity, login with X remains required). Host this x-login-provider wrapper at `login.llmtext.com`
- Make MCP available in p0docs + demo on how this works for Travers
- Make demo on how to make a `llms.txt` for another product, like Cloudflare's main website, combined (it's missing!)
- Talk to Lukas/Khushi on how to launch this!
- Consider improving the MCP with the extract API.

## Launch

- Open issue in https://github.com/AnswerDotAI/llms-txt
- Reach out to https://x.com/jeremyphoward (somehow)
- Get on llms.txt directories for parallel.ai/llms.txt: [llmstxt.site](https://llmstxt.site/) and [directory.llmstxt.cloud](https://directory.llmstxt.cloud/)
- On parallel cookbook, remove old stuff, add this one.
- On parallel docs, link to this (If X OAuth is OK)
- Launch it on MCP directories in a way that context7/gitmcp did it too
- Use it for https://docs.parallel.ai/llms.txt and make demo
- X Launch post

## Draft Blogpost/learnings

- Why this a fair alternative to context7
- Reasoning over a table of contents > vector search?
- Every website needs an llms.txt, not just docs sites!
- Parallel.ai llms.txt combines main website + docs + socials
