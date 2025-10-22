RULES:
https://uithub.com/janwilmake/gists/tree/main/named-codeblocks.md

@index.html: use to improve the layout

check api: https://check.llmtext.com/openapi.json

improve the check tab:

- if ?check={url} is present, go to that tab call the check api immediately.
- the search/install form should actually link to ?check={url} instead of installthismcp directly
- render all details nicely in table format in human readable way and for each problem, provide suggestions according to https://llmstxt.org recommendations
- if it's all good, link to "Install this MCP" which goes to the installthismcp.com page for the mcp. if not, this button should still be visible, but disabled.

give me a full new implementation of this index.html
