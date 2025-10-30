# CHANGELOG

This is an informal summary of changes happening within this repo.

## v1 (september 2025)

- ✅ Build this out from spec, see if that works out.
- ✅ Fix CORS issues in `simplerauth-client`
- ✅ Fix CORS for login.wilmake.com and deploy and publish
- ✅ test with `npx @modelcontextprotocol/inspector`
- ✅ Error connecting to LLMs.txt. Please confirm that you have permission to access the service, that you’re using the correct credentials, and that your server handles auth correctly.
- ✅ Bring simplerauth-client and with-mcp to the packages again
- CRAZY ONE SHOT, almost got it right! LETS IMPROVE THE withMcp docs to clarify that auth should be in the handler already (show example) https://letmeprompt.com/httpsflaredream-q4xf1v0
- ❌ Login was successful, but after that, login isnt' found.

## v2 (October 15, 2025)

- ✅ Hosted at `llmtext.com/{hostname}/mcp`
- ✅ Very nice landingpage
- ✅ Made it work with `/{hostname}` and dynamic MCP name / tool
- ✅ Make X oauth work for cursor/vscode and others! X OAuth is vital for leaderboard, it's not the same without it!
- ✅ Add daily active developer statistic for hostname.

### Make it appealing

- ✅ Retrieve MCP servers from one of these: https://llmstxt.site https://github.com/thedaviddias/llms-txt-hub https://directory.llmstxt.cloud into static file
- ✅ Use this to server-render install links to all of these, add search on top.
- ✅ Make favicon / icon files
- ✅ Make og:image using chatgpt
- ✅ Add good SEO into frontpage

### llms.txt generation guide

- ✅ Improve schema and cli further
- ✅ Create sitemap of everything together in the CLI

### Use `extract-from-sitemap` for parallel.ai

- ✅ This should be a script in `package.json` that simply puts it all in a repo
- ✅ Since it's quite fast, can be added to precommit or predeploy

## Further changes in week of october 20

### Parallel PR

- ✅ intercept `accept:text/markdown` requests
- ✅ Route accept: `text/markdown` requests should rewrite to llm.parallel.ai
- ✅ `.md` suffix should be catched as well if `rewriteTo` is available
- ✅ `llms.txt, llms-full.txt, /mcp` should rewrite to llm.parallel.ai (if available)
- ✅ Put all .md files into https://github.com/janwilmake/parallel-llmtext using build script.
- ✅ Every path on parallel.ai has `.md` available (ensure they are all in sitemap, no 404s are in sitemap, and we re-generate from that new sitemap)
- ✅ Add `<link rel="alternate" type="text/markdown" href="{path}.md" title="Docs" />` into metadata for each html page!

### Website

- ✅ Adhere to figma design
- ✅ Ensure mcp.parallel.ai serves data as JSON at `index.json`, including top 10 users leaderboard
- ✅ link from hostname to raw `llms.txt`
- ✅ Fetch that and overwrite `window.data` in the HTML using node-script pre-deploy
- ✅ Document check API and add llmstxt-check-tool.
- ✅ Checktool bug: 404 for https://docs.zapier.com/llms.txt and even for https://modelcontextprotocol.io/llms.txt even though they exist.

### Finalize MCP listings and flow

- ✅ The check API should use parse-llms-txt and actually give you deeper information about 50 random links in your `llms.txt`
- ✅ When entering a new llms.txt URL to create an MCP, perform the check first, and only allow going to installation page when it's confirmed that it is actually good
- ✅ Improve check api testing on bun: https://bun.com/llms.txt. somehow it can't always find the md. Fix this!
- ✅ Use the check-api on all servers and ensure that the ones that have HTML only in their contents get filtered out. These aren't valid. Still keep them in the dataset as invalid servers, leading to check them.
- ✅ Show invalid servers at the bottom and replace "Add" button with "Check". Especially nice to showcase the famous companies with invalid llms.txt server.

## One more iteration, october 24

- ✅ Ensure to add a highlighted boolean prop to the list so popular ones will stand out. Same for `valid:false`!
- ✅ FAQ tab
- ✅ The broken `llms.txt`'s should be in a the check tab.
- ✅ If check fails, instruct people to create a better one using the library!

`main.ts`

- ✅ Improve MCP by putting `llms.txt` url in tool description + the `{title,description,details}` of it, not the entire thing.
- ✅ fix cors problem

`index.html`

- ✅ better subtitle
- ✅ servers on same height as "popular llms.txt mcp servers"
- ✅ mobile-friendlier
- ✅ `?check` is annoying if it stays in the url, better to just trigger form submission directly
- ✅ dev that looks for a lib should be able to search (small search input below 'popular llms.txt mcp servers') that does simple fuzzy keyword search that filters the list, and below the list, it should suggest to 'create llms.txt linking to the first tab
- ✅ number the tabs with the number in lay-out for improved readability of the code
- ✅ made text inputs a bit less strong

`llmtext.check`

- ✅ Minimum 20% of 50 links should be broken

`filter-urls.ts` - fix icons

- ✅ use the google favicon api (https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://parallel.ai&size=16) and for llmtext my own, and add `data:image/png;base64,` to the JSON such that they are hardcoded in the html.
- ✅ use that icon in the img instead of the url. things should load much faster now.
- ✅ do not fall back to url
- ❌ reverted to just use the icon api at the frontend as it can't be done for all, the html becomes like 500kb, and causes us to require additional state. better to just have it done async and keep the html small!

## Fix llmtext.login (october 25)

✅ Created variation to the x oauth provider that adds a consent screen while removign all statefullness! It's a lot simpler now

## extract-from-sitemap auto-redeploy (october 27)

- ✅ find auto-run and re-deploy github ci/cd rule
- ✅ ensure `extract-from-sitemap` requires environment variable from github ci (maybe need to run with '--ci' flag or detect somehow)
- ✅ set up `parallel-llmtext` to rerun every 5 minutes. if it works: every 12 hours
- ✅ put files in `public`
