# llms.txt Specification (Draft v0.1)

**Status:** Draft  
**Last Updated:** 2024-09-03  
**Authors:** Jeremy Howard, Jan Wilmake

## Abstract

This specification defines a standard format and location for machine-readable documentation files that provide Large Language Model (LLM) optimized content for websites and projects.

## 1. Motivation

Large Language Models require concise, structured information but face constraints:

- Limited context window sizes prevent processing entire websites
- HTML-to-text conversion is lossy and imprecise
- Documentation is scattered across multiple pages

The `llms.txt` standard addresses these challenges by providing a single entry point for LLM-optimized content.

## 2. File Location

### 2.1 Primary Location

The `llms.txt` file MUST be located at the root path:

```
https://example.com/llms.txt
```

### 2.2 Subpath Support

Implementations MAY support `llms.txt` files in subpaths for scoped documentation.

## 3. File Format

### 3.1 Content Type

`llms.txt` files MUST use Markdown format with UTF-8 encoding.

### 3.2 Structure

The file MUST contain sections in the following order:

1. **Title** (required): A level-1 heading (`# Title`)
2. **Summary** (optional): A blockquote with project overview
3. **Details** (optional): Zero or more non-heading markdown sections
4. **File Lists** (optional): Zero or more sections with level-2 headings

### 3.3 File List Format

File list sections MUST follow this structure:

```markdown
## Section Name

- [Link Title](url): Optional description
- [Link Title](url)
```

Where:

- Each item is a markdown list element
- Contains a required markdown hyperlink `[title](url)`
- MAY include a colon (`:`) followed by descriptive text

### 3.4 Reserved Section: "Optional"

A section titled `## Optional` has special semantics:

- URLs in this section MAY be omitted when context length is constrained
- Use for supplementary information not critical to understanding

### 3.5 Complete Example

```markdown
# Project Name

> Brief project summary with essential context

Additional details about the project and usage guidelines.

## Core Documentation

- [Quick Start](https://example.com/quickstart.html.md): Getting started guide
- [API Reference](https://example.com/api.html.md): Complete API documentation

## Optional

- [Advanced Topics](https://example.com/advanced.html.md): In-depth coverage
```

## 4. Companion Markdown Files

### 4.1 Convention

Websites SHOULD provide clean markdown versions of documentation pages at the same URL with `.md` appended:

- HTML: `https://example.com/docs/guide.html`
- Markdown: `https://example.com/docs/guide.html.md`

### 4.2 Index Files

For URLs without filenames, append `index.html.md`:

- HTML: `https://example.com/docs/`
- Markdown: `https://example.com/docs/index.html.md`

## 5. Relationship to Existing Standards

### 5.1 robots.txt

- `robots.txt` controls automated access permissions
- `llms.txt` provides curated content for inference
- Both files serve complementary purposes

### 5.2 sitemap.xml

- `sitemap.xml` lists all indexable pages
- `llms.txt` provides curated subset with LLM-optimized versions
- May reference external resources not in sitemap

## 6. Processing Guidelines

### 6.1 Parsing

Implementations MUST support:

- Markdown parsing for structure extraction
- URL extraction from hyperlinks
- Section identification via heading levels

### 6.2 Content Expansion (Optional)

Processors MAY:

- Fetch and aggregate linked markdown content
- Generate expanded context files
- Filter optional sections based on context limits

## 7. Best Practices

### 7.1 Content Guidelines

- Use clear, concise language
- Avoid unexplained jargon
- Provide informative link descriptions
- Test with multiple LLMs

### 7.2 Maintenance

- Keep links current and valid
- Update summary when project scope changes
- Version control the `llms.txt` file

## 8. MIME Type

Recommended MIME type: `text/markdown; charset=utf-8`

## 9. Security Considerations

- Validate and sanitize URLs before fetching
- Respect robots.txt and rate limits when processing linked content
- Consider authentication requirements for linked resources

## 10. Extensibility

This specification may be extended through:

- Custom section names (beyond "Optional")
- Additional metadata in blockquote syntax
- Implementation-specific processing directives

## Appendix A: ABNF Grammar (Informative)

```abnf
llms-txt = title [summary] [details] *file-list

title = "# " text newline

summary = "> " text newline

details = *(markdown-block)

file-list = heading list-items

heading = "## " text newline

list-items = *list-item

list-item = "- [" text "](" url ")" [":" text] newline
```

## Appendix B: References

- Markdown Specification: [CommonMark](https://commonmark.org/)
- robots.txt: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html)
- Sitemap Protocol: [sitemaps.org](https://www.sitemaps.org/)

---

**Contributing:** [GitHub Repository](https://github.com/AnswerDotAI/llms-txt)  
**Discussion:** [Discord Channel](https://discord.gg/aJPygMvPEN)
