# v1 (september 2025)

- ✅ Build this out from spec, see if that works out.
- ✅ Fix CORS issues in `simplerauth-client`
- ✅ Fix CORS for login.wilmake.com and deploy and publish
- ✅ test with `npx @modelcontextprotocol/inspector`
- ✅ Error connecting to LLMs.txt. Please confirm that you have permission to access the service, that you’re using the correct credentials, and that your server handles auth correctly.
- ✅ Bring simplerauth-client and with-mcp to the packages again
- CRAZY ONE SHOT, almost got it right! LETS IMPROVE THE withMcp docs to clarify that auth should be in the handler already (show example) https://letmeprompt.com/httpsflaredream-q4xf1v0
- ❌ Login was successful, but after that, login isnt' found.

# v2 (October 15, 2025)

- ✅ Hosted at `llmtext.com/{hostname}/mcp`
- ✅ Very nice landingpage
- ✅ Made it work with `/{hostname}` and dynamic MCP name / tool
- ✅ Make X oauth work for cursor/vscode and others! X OAuth is vital for leaderboard, it's not the same without it!
- ✅ Add daily active developer statistic for hostname.

# Make it appealing

- ✅ Retrieve MCP servers from one of these: https://llmstxt.site https://github.com/thedaviddias/llms-txt-hub https://directory.llmstxt.cloud into static file
- ✅ Use this to server-render install links to all of these, add search on top.
- ✅ Make favicon / icon files
- ✅ Make og:image using chatgpt
- ✅ Add good SEO into frontpage
-

# Determine way to do it

- ✅ LLMtext by parallel (-> read blogpost)
- blog: Why this is better than context7: Blog about reasoning over a table of contents versus vector search
- highlight the social element more: top 10 users per server + overall top10 leaderboard
- give people an option to opt-out of the social element before logging in with X

# Web publishers offering

- Understand who ingests your context
- Premium 'ai guide creation' tool

# Launch

- Open issue in https://github.com/AnswerDotAI/llms-txt
- Reach out to https://x.com/jeremyphoward
- On parallel cookbook, remove old stuff, add this one.
- On parallel docs, link to this (If X oauth is OK)
- Launch it on MCP directories in a way that context7/gitmcp did it too
- Use it for https://docs.parallel.ai/llms.txt and make demo
- X Launch post
