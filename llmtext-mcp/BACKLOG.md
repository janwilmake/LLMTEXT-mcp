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
