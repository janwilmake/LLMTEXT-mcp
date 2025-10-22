This repo allows you to create a static markdown bundle based on one or multiple sources. The sources must either have a functional and complete sitemap, or should specify custom urls to be extracted.

## Step by Step Guide

1. Create a `llmtext.json` file in the root of your project. This is where you define your sources to be extracted from. For an example combining multiple sources, see [this example](https://github.com/janwilmake/parallel-llmtext/blob/main/llmtext.json).
2. Run `npx extract-from-sitemap` (or add it to your `package.json` scripts, [like this](https://github.com/janwilmake/parallel-llmtext/blob/main/package.json))
3. Set up CI/CD in your repo to automatically update your extracted static files as often as needed. **Example coming soon**
4. Use an agent-rewriter such as [next-agent-rewriter](../next-agent-rewriter) to rewrite agent requests to the appropriate static markdown files. In addition, it's best practice to add a link in your html to show the markdown variant is available, like this: `<link rel="alternate" type="text/markdown" href="{path}.md" title="Docs" />`

## Known limitations

This library is in active development. Known limitations:

- Does not work for nested sitemaps
- Does not work on sitemaps that are too large

I am working on addressing these issues.
