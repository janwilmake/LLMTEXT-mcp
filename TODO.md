# TODO

High level

1. Our own llms.txt is perfect and auto-updates
2. Libraries works and properly guides people to do the same
3. MCP serves all work as intended.

Later:

- Hosted version of llms.txt generation, user-budget + cache
- See [backlog](BACKLOG.md)
- https://github.com/janwilmake/openapi-mcp-server/issues/35

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

## Finalize MCP listings and flow

- ✅ The check API should use parse-llms-txt and actually give you deeper information about 50 random links in your `llms.txt`
- ✅ When entering a new llms.txt URL to create an MCP, perform the check first, and only allow going to installation page when it's confirmed that it is actually good
- ✅ Improve check api testing on bun: https://bun.com/llms.txt. somehow it can't always find the md. Fix this!
- ✅ Use the check-api on all servers and ensure that the ones that have HTML only in their contents get filtered out. These aren't valid. Still keep them in the dataset as invalid servers, leading to check them.
- ✅ Show invalid servers at the bottom and replace "Add" button with "Check". Especially nice to showcase the famous companies with invalid llms.txt server.

## TODO

- ✅ Ensure to add a highlighted boolean prop to the list so popular ones will stand out. Same for `valid:false`!
- Flow of dev that looks for a lib should be able to search and below it should say "not found? create mcp"
- Deployment of github repo should become clearer from lib readme
- FAQ tab
- servers on same height as "popular llms.txt mcp servers"
- installthismcp icons are low-quality
- The broken `llms.txt`'s should be in a the check tab.
- If check fails, instruct people to create a better one using the library!
- Improve MCP by putting `llms.txt` url in tool description + the `{title,description,details}` of it, not the entire thing.
- Give people an option to opt-out of the social element before logging in with X (for simplicity, login with X remains required). Host this x-login-provider wrapper at `login.llmtext.com`.
- Make MCP available in p0docs + demo on how this works for Travers
- Make demo on how to make a `llms.txt` for another product, like Cloudflare's main website or groq, combined (it's missing!)
- https://github.com/parallel-web/parallel-llmtext public before tuesday, maybe rename to parallel-llm-context or parallel-context

## Launch

- On parallel docs, link to this (If X OAuth is OK)
- Open issue in https://github.com/AnswerDotAI/llms-txt
- Reach out to https://x.com/jeremyphoward (somehow)
- Get on llms.txt directories for parallel.ai/llms.txt: [llmstxt.site](https://llmstxt.site/) and [directory.llmstxt.cloud](https://directory.llmstxt.cloud/)
- Launch it on MCP directories in a way that context7/gitmcp did it too
- Use it for https://docs.parallel.ai/llms.txt and make demo
- X Launch post

## Friday/weekend:

Install ScreenStudio and make demos after making blog skeletons.
