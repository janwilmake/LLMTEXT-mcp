This worker provides a comprehensive site index crawler that:

## Features

1. **Robots.txt Parsing**

   - Parses all directives (User-agent, Allow, Disallow, Crawl-delay, Sitemap, Host)
   - Groups rules by user-agent

2. **Scraping Permission Logic**

   - Checks if the specified user-agent is allowed to scrape
   - Detects AI bot blocking patterns
   - Returns detailed reasoning for the decision

3. **Sitemap Parsing**

   - Handles both sitemap indexes and URL sets
   - Extracts loc, lastmod, changefreq, priority
   - Follows sitemap indexes (with depth limits)

4. **RSS/Atom Feed Detection & Parsing**

   - Checks common RSS paths (/feed, /rss.xml, etc.)
   - Parses both RSS 2.0 and Atom formats
   - Extracts title, link, description, items

5. **llms.txt Parsing**

   - Checks multiple common paths (/llms.txt, /docs/llms.txt, /.well-known/llms.txt)
   - Follows the llmstxt.org specification
   - Extracts title, description, details, and sections with file entries

6. **Refresh Recommendation**
   - Analyzes crawl-delay from robots.txt
   - Considers sitemap changefreq values
   - Calculates average RSS posting intervals

## Usage

```bash
# Query params style
curl "https://your-worker.dev/?domain=example.com&userAgent=MyBot"

# Path-based style
curl "https://your-worker.dev/crawl/example.com"
```
