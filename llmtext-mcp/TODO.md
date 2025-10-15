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

# Goal 2: Launch and distribute

- ✅ Retrieve MCP servers from one of these: https://llmstxt.site https://github.com/thedaviddias/llms-txt-hub https://directory.llmstxt.cloud into static file
- ✅ Use this to server-render install links to all of these, add search on top.
- Add good SEO into frontpage - make og image using chatgpt
- Open issue in https://github.com/AnswerDotAI/llms-txt and reach out to https://x.com/jeremyphoward
- Use it for https://docs.parallel.ai/llms.txt and make demo

# Nice to have:

- Icon retrieve icon from hostname or apex hostname, pass it into MCP protocol
- Add favicon and og to website
- MCP UI protocol: for retrieving urls show token count, for leaderboard make a very nice rendering with carousels
- Advocate to Parallel that we need X login for daily active developers stats
- Maybe needed: improve instructions
- Add ratelimit of requests per user!

# Premium - Slop Guide tool

Create a higher level slopguide tool:

- takes in an 'objective' and 'urls'. instructed to pass wider scope of urls than normal
- concatenates all urls, then uses `/chat/completions` asked to reply with subset of relevant files/sections.
- create subset doc and respond with it

This tool would take a little longer but creates perfect docs for a particular objective, naturally creating a 2-step flow without polluting context.

Let parallel.ai pay for this compute with appropriate ratelimit per user.

# Parallel improved context

Create larger `llms.txt` hosted at https://parallel.ai/llms.txt with docs + sdks + blogs

# Meeting Lukas

- task mcp positioning within product
- agent-friendly
- llms.txt mcp
