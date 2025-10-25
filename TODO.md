# TODO

High level

1. Our own llms.txt is perfect and auto-updates
2. Libraries works and properly guides people to do the same
3. MCP serves all work as intended.

Later:

- Hosted version of llms.txt generation, user-budget + cache
- See [backlog](BACKLOG.md)
- https://github.com/janwilmake/openapi-mcp-server/issues/35

# WEEKEND

`installthismcp` - Fix UI here (1 hour)

- ✅ icons are low-quality, should be sharper (maybe use different api?)
- ✅ Find best intermediate solution to giving icons: https://x.com/janwilmake/status/1982034203211358495
- It looks a bit spammy/sketchy. I think consistency in the look and feel across open-source projects with our name on it is important. remove blue bg
- align installthismcp color-schema and add disclaimer 'what is installthismcp'?
- We can try to retrieve the JSON from GET and IF present, use that for icons, and title. also if present show the websiteUrl and version, and have a button to expand instructions.

You're an expert in front-end design and implementation. Refine the screens across this app using the latest standards and trends for high-usability software apps. Your focus should be on intentional design that doesn't distract from the core functions of the app. Use mainly whites and grays for UI elements, with occasional use of color for buttons in highlighted states.

`llmtext.login` - add in a in-between page (max a few hours)

- Give people an option to opt-out of the social element before logging in with X (for simplicity, login with X remains required). Host this x-login-provider wrapper at `login.llmtext.com`.

`extract-from-sitemap` - a day???

- Deployment of github repo should become clearer from lib readme. Ideally, should recur daily.

## Launch

- Install ScreenStudio and make demos after making blog skeletons.
- Demo on how this works for Travers
- Make demo on how to make a `llms.txt` for another product, like Cloudflare's main website or groq, combined (it's missing!)
- https://github.com/parallel-web/parallel-llmtext public before tuesday, maybe rename to parallel-llm-context or parallel-context
- On parallel docs, link to this (If X OAuth is OK)
- Open issue in https://github.com/AnswerDotAI/llms-txt
- Reach out to https://x.com/jeremyphoward (somehow)
- Get on llms.txt directories for parallel.ai/llms.txt: [llmstxt.site](https://llmstxt.site/) and [directory.llmstxt.cloud](https://directory.llmstxt.cloud/)
- Launch it on MCP directories in a way that context7/gitmcp did it too
- Use it for https://docs.parallel.ai/llms.txt and make demo
- X Launch post
