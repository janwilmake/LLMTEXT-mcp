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

## Make it appealing

- ✅ Retrieve MCP servers from one of these: https://llmstxt.site https://github.com/thedaviddias/llms-txt-hub https://directory.llmstxt.cloud into static file
- ✅ Use this to server-render install links to all of these, add search on top.
- ✅ Make favicon / icon files
- ✅ Make og:image using chatgpt
- ✅ Add good SEO into frontpage
