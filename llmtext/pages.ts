// HTML template generation for server-side rendered pages

export type TabId = "create" | "check" | "install" | "faq";

interface PageMeta {
  title: string;
  description: string;
  path: string;
}

const TAB_META: Record<TabId, PageMeta> = {
  create: {
    title: "Create llms.txt - LLMTEXT.com",
    description:
      "Generate an llms.txt file with accompanied markdown content from multiple sources to help AI agents access everything easily.",
    path: "/create",
  },
  check: {
    title: "Validate llms.txt - LLMTEXT.com",
    description:
      "Check if your llms.txt file follows the official specification from llmstxt.org. Validate format, content-type, and linked pages.",
    path: "/check",
  },
  install: {
    title: "Install llms.txt MCP Servers - LLMTEXT.com",
    description:
      "Turn any llms.txt URL into a dedicated MCP server. Browse and install popular llms.txt MCP servers for Claude, Cursor, and other LLMs.",
    path: "/install",
  },
  faq: {
    title: "FAQ - LLMTEXT.com",
    description:
      "Frequently asked questions about llms.txt, MCP servers, validation, and how to reduce hallucinations in AI agents.",
    path: "/faq",
  },
};

const TABS: { id: TabId; label: string; num: string }[] = [
  { id: "create", label: "CREATE", num: "01" },
  { id: "check", label: "CHECK", num: "02" },
  { id: "install", label: "INSTALL", num: "03" },
  { id: "faq", label: "FAQ", num: "04" },
];

interface ServerData {
  users: any[];
  servers: any[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(num: number): string {
  if (num >= 1000000)
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return num?.toString() || "";
}

function extractApexDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return hostname;
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${extractApexDomain(domain)}&sz=32`;
}

function getMcpName(domain: string): string {
  return domain.replace(/\./g, "-");
}

function getInstallMcpUrl(hostname: string): string {
  const mcpName = getMcpName(hostname);
  return `https://installthismcp.com/${mcpName}?url=https://mcp.llmtext.com/${hostname}/mcp`;
}

function renderHead(activeTab: TabId): string {
  const meta = TAB_META[activeTab];
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>${escapeHtml(meta.title)}</title>
    <meta name="title" content="${escapeHtml(meta.title)}">
    <meta name="description" content="${escapeHtml(meta.description)}">
    <meta name="keywords" content="llms.txt, MCP, Model Context Protocol, Claude, Cursor, AI, LLM, markdown, documentation">
    <meta name="author" content="Parallel">

    <link rel="canonical" href="https://llmtext.com${meta.path}">

    <meta property="og:type" content="website">
    <meta property="og:url" content="https://llmtext.com${meta.path}">
    <meta property="og:title" content="${escapeHtml(meta.title)}">
    <meta property="og:description" content="${escapeHtml(meta.description)}">
    <meta property="og:image" content="https://llmtext.com/og-dark.jpg">
    <meta property="og:image:alt" content="${escapeHtml(meta.title)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="https://llmtext.com${meta.path}">
    <meta name="twitter:title" content="${escapeHtml(meta.title)}">
    <meta name="twitter:description" content="${escapeHtml(meta.description)}">
    <meta name="twitter:image" content="https://llmtext.com/og-dark.jpg">
    <meta name="twitter:image:alt" content="${escapeHtml(meta.title)}">

    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
    <link rel="manifest" href="/site.webmanifest">

    <meta name="theme-color" content="#1D1C1A" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#1D1C1A" media="(prefers-color-scheme: dark)">

    <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --bg: #ffffff;
            --fg: #000000;
            --primary: #1a1a1a;
            --primary-light: #404040;
            --border: #000000;
            --secondary: #666666;
            --hover-bg: #f0f0f0;
            --error: #000000;
            --warning: #404040;
            --success: #1a1a1a;
            --table-border: #cccccc;
        }

        body {
            font-family: 'IBM Plex Mono', monospace;
            background: var(--bg);
            color: var(--fg);
            line-height: 1.6;
            font-size: 14px;
        }

        .header {
            border-bottom: 2px solid var(--border);
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .logo-container {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .logo-box {
            background: var(--fg);
            color: var(--bg);
            padding: 0.25rem 0.5rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            border: 2px solid var(--fg);
            display: flex;
            align-items: baseline;
            gap: 0.1rem;
            text-decoration: none;
        }

        .logo-main { font-size: 1rem; font-weight: 700; }
        .logo-com { font-size: 0.7rem; font-weight: 700; }

        .powered-by {
            font-size: 0.55rem;
            color: var(--secondary);
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }

        .parallel-logo { height: 10px; }

        .nav {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-wrap: wrap;
            margin-top: -16px;
        }

        .nav-btn {
            height: 40px;
            padding: 0.5rem 0.5rem;
            display: flex;
            align-items: center;
            border: 2px solid var(--border);
            background: transparent;
            color: var(--fg);
            text-decoration: none;
            font-size: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }

        .nav-btn:hover {
            background: var(--primary);
            color: var(--bg);
        }

        .github-icon {
            width: 40px;
            height: 40px;
            border: 2px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--fg);
            text-decoration: none;
            background: transparent;
            transition: all 0.2s;
        }

        .github-icon:hover {
            background: var(--primary);
            color: var(--bg);
        }

        .github-icon svg { width: 20px; height: 20px; }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem 1rem;
        }

        h1 {
            text-align: center;
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
            border: 2px solid var(--border);
            padding: 1rem;
            background: var(--bg);
        }

        h1 a { color: var(--fg); text-decoration: none; }
        h1 u { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 2px; }

        .subtitle {
            text-align: center;
            font-size: 0.9rem;
            margin-bottom: 2rem;
            color: var(--fg);
        }

        .tabs-container {
            max-width: 900px;
            margin: 0 auto;
        }

        .tabs {
            display: flex;
            gap: 0;
            margin-bottom: 0;
            overflow-x: auto;
            border-bottom: 2px solid var(--border);
        }

        .tab {
            padding: 0.75rem 1rem;
            background: transparent;
            border: 2px solid var(--border);
            border-bottom: none;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--fg);
            position: relative;
            white-space: nowrap;
            font-family: inherit;
            margin-right: -2px;
            text-decoration: none;
            display: inline-block;
        }

        .tab:hover:not(.active) { background: var(--hover-bg); }

        .tab.active {
            background: var(--primary);
            color: var(--bg);
            z-index: 2;
        }

        .tab-panel {
            border: 2px solid var(--border);
            padding: 2rem;
            background: var(--bg);
            margin-top: -2px;
        }

        h2 {
            font-size: 1.25rem;
            margin-bottom: 1.5rem;
            font-weight: 700;
            border-bottom: 2px solid var(--border);
            padding-bottom: 0.5rem;
        }

        .input-group {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
        }

        input[type="text"] {
            flex: 1;
            min-width: 200px;
            padding: 0.75rem;
            border: 2px solid var(--border);
            background: var(--bg);
            font-family: inherit;
            font-size: 0.9rem;
            color: var(--fg);
        }

        input[type="text"]:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: inset 0 0 0 1px var(--primary);
        }

        input[type="text"]::placeholder { color: var(--secondary); }

        .btn-primary {
            padding: 0.75rem 1.5rem;
            background: var(--primary);
            color: var(--bg);
            border: 2px solid var(--border);
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            white-space: nowrap;
        }

        .btn-primary:hover:not(:disabled) { background: var(--primary-light); }
        .btn-primary:disabled { background: var(--secondary); cursor: not-allowed; }

        .search-input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid var(--border);
            background: var(--bg);
            font-family: inherit;
            font-size: 0.85rem;
            color: var(--fg);
            margin-bottom: 1rem;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: inset 0 0 0 1px var(--primary);
        }

        .search-input::placeholder { color: var(--secondary); }

        .stats {
            text-align: right;
            font-size: 0.7rem;
            color: var(--fg);
            margin-bottom: 1rem;
            font-weight: 600;
        }

        h3 {
            font-size: 0.9rem;
            margin-bottom: 1rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .table-container {
            overflow-x: auto;
            border: 2px solid var(--border);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg);
        }

        th {
            text-align: left;
            padding: 0.75rem;
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 2px solid var(--border);
            background: var(--bg);
            position: sticky;
            top: 0;
        }

        td {
            padding: 0.75rem;
            border-bottom: 1px solid var(--table-border);
            font-size: 0.8rem;
        }

        tr:last-child td { border-bottom: none; }
        tr:hover { background: var(--hover-bg); }

        .source-name { display: flex; align-items: center; gap: 0.5rem; }
        .source-name a { color: var(--fg); text-decoration: none; }
        .source-name a:hover { text-decoration: underline; }

        .favicon { width: 16px; height: 16px; }

        .btn-add {
            padding: 0.4rem 0.75rem;
            background: transparent;
            border: 1px solid var(--border);
            font-size: 0.7rem;
            cursor: pointer;
            font-weight: 600;
            font-family: inherit;
            text-decoration: none;
            color: var(--fg);
            display: inline-block;
        }

        .btn-add:hover {
            background: var(--primary);
            color: var(--bg);
        }

        .validation-result {
            margin-top: 1.5rem;
            padding: 1rem;
            border: 2px solid var(--border);
            background: var(--bg);
        }

        .validation-result.valid { border-color: var(--success); }
        .validation-result.invalid { border-color: var(--error); }
        .validation-result h4 { font-size: 1rem; margin-bottom: 0.75rem; font-weight: 700; }

        .validation-list { list-style: none; margin: 0; padding: 0; }

        .validation-list li {
            padding: 0.5rem 0;
            font-size: 0.85rem;
            border-bottom: 1px solid var(--table-border);
        }

        .validation-list li:last-child { border-bottom: none; }
        .validation-list.errors li::before { content: '\\2717 '; margin-right: 0.5rem; }
        .validation-list.warnings li::before { content: '\\26A0 '; margin-right: 0.5rem; }

        .metadata-section {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 2px solid var(--border);
        }

        .metadata-section h5 { font-size: 0.9rem; margin-bottom: 0.75rem; font-weight: 600; }

        .metadata-table { width: 100%; font-size: 0.85rem; }
        .metadata-table td { padding: 0.5rem; border-bottom: 1px solid var(--table-border); }
        .metadata-table td:first-child { font-weight: 600; color: var(--secondary); width: 40%; }

        .install-mcp-btn {
            margin-top: 1rem;
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: var(--primary);
            color: var(--bg);
            border: 2px solid var(--border);
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            font-family: inherit;
        }

        .install-mcp-btn:hover:not(.disabled) { background: var(--primary-light); }
        .install-mcp-btn.disabled { background: var(--secondary); cursor: not-allowed; }

        .fix-suggestion {
            margin-top: 1rem;
            padding: 1rem;
            background: var(--hover-bg);
            border: 2px solid var(--border);
        }

        .fix-suggestion h5 { font-size: 0.9rem; margin-bottom: 0.5rem; }
        .fix-suggestion p { font-size: 0.85rem; margin-bottom: 1rem; }

        .fix-suggestion a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: var(--primary);
            color: var(--bg);
            border: 2px solid var(--border);
            font-size: 0.9rem;
            font-weight: 600;
            text-decoration: none;
            font-family: inherit;
        }

        .fix-suggestion a:hover { background: var(--primary-light); }

        .loading { text-align: center; padding: 2rem; color: var(--secondary); }

        .invalid-domains-section {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 2px solid var(--border);
        }

        .no-results {
            text-align: center;
            padding: 2rem;
            color: var(--secondary);
            font-size: 0.85rem;
        }

        .create-suggestion {
            margin-top: 1rem;
            padding: 1rem;
            background: var(--hover-bg);
            border: 2px solid var(--border);
            text-align: center;
        }

        .create-suggestion p { font-size: 0.85rem; margin-bottom: 1rem; }

        .create-suggestion a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: var(--primary);
            color: var(--bg);
            border: 2px solid var(--border);
            font-size: 0.9rem;
            font-weight: 600;
            text-decoration: none;
            font-family: inherit;
        }

        .create-suggestion a:hover { background: var(--primary-light); }

        .faq-container { max-width: 800px; margin: 0 auto; }
        .faq-section { margin-bottom: 2rem; }

        .faq-section h3 {
            font-size: 1.1rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--border);
        }

        .faq-item {
            margin-bottom: 0.5rem;
            border: 2px solid var(--border);
            background: var(--bg);
        }

        .faq-item summary {
            padding: 1rem;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            list-style: none;
            display: flex;
            align-items: center;
            justify-content: space-between;
            user-select: none;
        }

        .faq-item summary::before {
            content: '[ ]';
            margin-right: 0.5rem;
            color: var(--primary);
            white-space: nowrap;
            flex-shrink: 0;
        }

        .faq-item[open] summary::before {
            content: '[\\2713]';
            white-space: nowrap;
            flex-shrink: 0;
        }

        .faq-item summary:hover { background: var(--hover-bg); }

        .faq-answer {
            padding: 0 1rem 1rem 1rem;
            font-size: 0.85rem;
            line-height: 1.6;
        }

        .faq-answer p { margin-bottom: 0.75rem; }
        .faq-answer ul, .faq-answer ol { margin: 0.75rem 0; padding-left: 1.5rem; }
        .faq-answer li { margin-bottom: 0.5rem; }

        .faq-answer code {
            background: var(--hover-bg);
            padding: 0.2rem 0.4rem;
            font-family: inherit;
            border: 1px solid var(--table-border);
        }

        .faq-answer a { color: var(--fg); text-decoration: underline; }
        .faq-answer a:hover { background: var(--hover-bg); }

        /* Hide user/token/volume columns for now */
        th:nth-child(3), td:nth-child(3),
        th:nth-child(4), td:nth-child(4),
        th:nth-child(5), td:nth-child(5) { display: none; }

        @media (max-width: 640px) {
            .tab { padding: 0.5rem 0.75rem; font-size: 0.7rem; }
            th:nth-child(3), td:nth-child(3),
            th:nth-child(4), td:nth-child(4),
            th:nth-child(5), td:nth-child(5) { display: none; }
            td:nth-child(1) { max-width: 180px; }
            td:nth-child(2) { max-width: 180px; }
            .source-name { max-width: 100%; overflow: hidden; }
            .source-name a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
            .btn-add { white-space: nowrap; font-size: 0.65rem; padding: 0.35rem 0.6rem; }
            th:nth-child(6), td:nth-child(6) { width: 70px; padding-left: 0.5rem; padding-right: 0.5rem; }
            .install-mcp-btn { font-size: 0.8rem; padding: 0.6rem 1rem; white-space: nowrap; }
            .input-group { flex-direction: column; }
            .btn-primary { width: 100%; white-space: nowrap; }
            .faq-item summary { padding: 0.75rem; font-size: 0.85rem; }
            .faq-answer { padding: 0 0.75rem 0.75rem 0.75rem; font-size: 0.8rem; }
        }

        @media (max-width: 450px) {
            td:nth-child(2) { max-width: 100px !important; }
            .btn-add { font-size: 0.6rem; padding: 0.3rem 0.5rem; }
            th:nth-child(6), td:nth-child(6) { width: 60px; padding-left: 0.25rem; padding-right: 0.25rem; }
            th:nth-child(1), td:nth-child(1) { width: 40px; padding-left: 0.5rem; padding-right: 0.5rem; }
        }

        @media (min-width: 640px) {
            .header { padding: 1.5rem 2rem; }
            .logo-main { font-size: 1.25rem; }
            .logo-com { font-size: 0.85rem; }
            .parallel-logo { height: 13px; }
            .nav-btn { padding: 0.5rem 1rem; font-size: 0.75rem; }
            h1 { font-size: 2rem; }
            .tab { padding: 0.75rem 1.2rem; font-size: 0.8rem; }
            .tab-panel { padding: 2rem; }
            h2 { font-size: 1.5rem; }
            .input-group { flex-direction: row; gap: 1rem; }
            input[type="text"] { font-size: 0.95rem; }
            h3 { font-size: 1rem; }
            td { font-size: 0.875rem; }
            .btn-add { font-size: 0.75rem; }
        }

        @media (min-width: 1024px) {
            .container { padding: 3rem 2rem; }
            h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        }
    </style>
</head>`;
}

function renderHeader(): string {
  return `
<body>
    <div class="header">
        <div class="logo-container">
            <a href="/install" class="logo-box">
                <span class="logo-main">LLMTEXT</span>
                <span class="logo-com">.com</span>
            </a>
            <div class="powered-by">
                <span>powered by</span>
                <a href="https://parallel.ai" target="_blank">
                    <img src="/dark-parallel-text-270.svg" alt="parallel" class="parallel-logo">
                </a>
            </div>
        </div>
        <div class="nav">
            <a href="https://github.com/janwilmake/llmtext-mcp/issues/new" class="nav-btn" target="_blank">FEEDBACK</a>
            <a href="https://parallel.ai/blog/LLMTEXT-for-llmstxt" class="nav-btn" target="_blank">LEARN MORE</a>
            <a href="https://github.com/janwilmake/llmtext-mcp" class="github-icon" target="_blank">
                <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
            </a>
        </div>
    </div>

    <div class="container">
        <h1>TOOLS FOR THE <a href="https://llmstxt.org" target="_blank"><u>llms.txt</u></a> STANDARD</h1>
        <p class="subtitle">Reduce hallucinations in Cursor, Claude, and other LLMs</p>

        <div class="tabs-container">`;
}

function renderTabs(activeTab: TabId): string {
  let html = `\n            <div class="tabs">`;
  for (const tab of TABS) {
    const isActive = tab.id === activeTab;
    html += `\n                <a href="/${tab.id}" class="tab${isActive ? " active" : ""}">${tab.num} ${tab.label}</a>`;
  }
  html += `\n            </div>\n`;
  return html;
}

function renderCreateContent(): string {
  return `
            <div class="tab-panel">
                <h2>CREATE llms.txt FROM SOURCES</h2>
                <p style="margin-bottom: 1.5rem;">Generate an llms.txt with accompanied markdown content from
                    multiple sources, to help agents access everything easily.</p>
                <a href="https://github.com/janwilmake/llmtext-mcp/tree/main/extract-from-sitemap"
                    class="btn-primary" style="text-decoration: none;">VIEW ON GITHUB</a>
            </div>`;
}

function renderCheckContent(): string {
  return `
            <div class="tab-panel">
                <h2>VALIDATE llms.txt FILES</h2>
                <p style="margin-bottom: 1.5rem;">Check if your llms.txt file follows the official specification
                    from llmstxt.org</p>

                <div class="input-group">
                    <input type="text" id="check-url" placeholder="https://example.com/llms.txt">
                    <button class="btn-primary" onclick="handleCheckValidation()" id="check-btn">VALIDATE</button>
                </div>

                <div id="validation-result"></div>

                <div id="invalid-domains-list" class="invalid-domains-section" style="display: none;">
                    <h3>INVALID SUBMITTED llms.txt FILES</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>SOURCE</th>
                                    <th>CHECK</th>
                                </tr>
                            </thead>
                            <tbody id="invalid-domains-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>`;
}

function renderInstallContent(data: ServerData | null): string {
  const validServers = data
    ? data.servers.filter((s: any) => !!s.valid)
    : [];
  const invalidServers = data
    ? data.servers.filter((s: any) => !s.valid)
    : [];
  const serverCount = validServers.length;

  let tableRows = "";
  if (validServers.length > 0) {
    validServers.forEach((server: any, index: number) => {
      const mcpUrl = getInstallMcpUrl(server.hostname);
      const llmstxtUrl = `https://${server.hostname}/llms.txt`;
      tableRows += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>
                                <div class="source-name">
                                    <img src="${getFaviconUrl(server.hostname)}" alt="" class="favicon" loading="lazy">
                                    <a href="${escapeHtml(llmstxtUrl)}" target="_blank" rel="noopener">${escapeHtml(server.hostname)}</a>
                                </div>
                            </td>
                            <td>${formatNumber(server.total_tokens)}</td>
                            <td>${formatNumber(server.total_requests)}</td>
                            <td>${formatNumber(server.unique_users)}</td>
                            <td><a href="${escapeHtml(mcpUrl)}" class="btn-add" target="_blank" rel="noopener">&#11015; INSTALL</a></td>
                        </tr>`;
    });
  } else {
    tableRows = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">LOADING DATA...</td></tr>`;
  }

  let invalidTableRows = "";
  if (invalidServers.length > 0) {
    invalidServers.forEach((server: any) => {
      const llmstxtUrl = `https://${server.hostname}/llms.txt`;
      invalidTableRows += `
                        <tr>
                            <td>
                                <div class="source-name">
                                    <img src="${getFaviconUrl(server.hostname)}" alt="" class="favicon" loading="lazy">
                                    <a href="${escapeHtml(llmstxtUrl)}" target="_blank" rel="noopener">${escapeHtml(server.hostname)}</a>
                                </div>
                            </td>
                            <td><a href="/check?url=${encodeURIComponent(llmstxtUrl)}" class="btn-add">&#9888; CHECK</a></td>
                        </tr>`;
    });
  }

  return `
            <div class="tab-panel">
                <h2>TURN ANY llms.txt URL INTO A DEDICATED MCP SERVER</h2>

                <div class="input-group">
                    <input type="text" id="llmtext-url" placeholder="https://example.com/llms.txt">
                    <button class="btn-primary" onclick="handleCheckUrl()">CHECK & INSTALL</button>
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem;">
                    <h3>POPULAR llms.txt MCP SERVERS</h3>
                    <div id="stats" class="stats">${serverCount > 0 ? formatNumber(serverCount) + " MCP SERVERS CREATED" : "LOADING..."}</div>
                </div>

                <input type="text" id="search-input" class="search-input" placeholder="SEARCH BY DOMAIN NAME..." oninput="handleSearch()">

                <div class="table-container">
                    <table id="servers-table">
                        <thead>
                            <tr>
                                <th>RANK</th>
                                <th>SOURCE</th>
                                <th>TOKENS</th>
                                <th>VOLUME</th>
                                <th>USERS</th>
                                <th>INSTALL</th>
                            </tr>
                        </thead>
                        <tbody id="servers-tbody">${tableRows}</tbody>
                    </table>
                </div>
                <div id="no-results" class="no-results" style="display: none;">NO MATCHING SERVERS FOUND</div>

                <div id="create-suggestion" class="create-suggestion" style="display: none;">
                    <p>Can't find what you're looking for? Create your own llms.txt file!</p>
                    <a href="/create">CREATE llms.txt</a>
                </div>

                ${
                  invalidServers.length > 0
                    ? `
                <div class="invalid-domains-section">
                    <h3>INVALID SUBMITTED llms.txt FILES</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>SOURCE</th>
                                    <th>CHECK</th>
                                </tr>
                            </thead>
                            <tbody>${invalidTableRows}</tbody>
                        </table>
                    </div>
                </div>`
                    : ""
                }
            </div>`;
}

function renderFaqContent(): string {
  // All details are open by default - no JS needed
  return `
            <div class="tab-panel">
                <h2>FREQUENTLY ASKED QUESTIONS</h2>

                <div class="faq-container">
                    <div class="faq-section">
                        <h3>GETTING STARTED</h3>

                        <details class="faq-item" open>
                            <summary>What is llms.txt?</summary>
                            <div class="faq-answer">
                                <p>llms.txt is a standardized file format (similar to robots.txt) that helps AI
                                    agents and LLMs efficiently navigate and understand your website's content. It
                                    provides a structured table of contents with links to markdown or plain text
                                    versions of your pages.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Why is llms.txt important?</summary>
                            <div class="faq-answer">
                                <p>As AI traffic grows exponentially, traditional web scraping becomes inefficient
                                    and costly. llms.txt allows you to serve AI-friendly content directly, reducing
                                    latency and bandwidth while improving the quality of information AI agents can
                                    retrieve from your site.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>What does the llms.txt MCP allow me to do?</summary>
                            <div class="faq-answer">
                                <p>The llms.txt MCP (Model Context Protocol) server turns any valid llms.txt file
                                    into a structured resource that AI assistants like Claude can directly access.
                                    This means developers can reference documentation, APIs, or content from any
                                    llms.txt-enabled website without hallucination or manual copying.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>What's the difference between llms.txt MCP and Context7?</summary>
                            <div class="faq-answer">
                                <p>While Context7 uses vector search to find relevant content, llms.txt MCP provides
                                    structured navigation through a table of contents. This allows for more precise
                                    retrieval and reasoning over content organization, often more efficiently than
                                    embedding-based search for well-documented resources.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Who should use "Create"?</summary>
                            <div class="faq-answer">
                                <p>The Create tool is perfect for website owners whose CMS doesn't support markdown
                                    output. It generates an llms.txt file AND converts all your pages to markdown
                                    automatically using the Parallel Extract API, saving you from manual conversion
                                    work.</p>
                            </div>
                        </details>
                    </div>

                    <div class="faq-section">
                        <h3>TECHNICAL QUESTIONS</h3>

                        <details class="faq-item" open>
                            <summary>What format should my llms.txt file follow?</summary>
                            <div class="faq-answer">
                                <p>Your llms.txt must follow the <a href="https://llmstxt.org"
                                        target="_blank">official specification</a>. Key requirements include:</p>
                                <ul>
                                    <li>Served at your root domain: <code>yoursite.com/llms.txt</code></li>
                                    <li>Content-Type must be text/plain or text/markdown</li>
                                    <li>Contains markdown-formatted links to plain text/markdown pages</li>
                                    <li>Keep total size under 10k tokens</li>
                                    <li>Each linked page should also be under 10k tokens</li>
                                </ul>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Why is my llms.txt failing validation?</summary>
                            <div class="faq-answer">
                                <p>Common validation failures include:</p>
                                <ul>
                                    <li><strong>Wrong location:</strong> File must be at root (yoursite.com/llms.txt)</li>
                                    <li><strong>Wrong content-type:</strong> Must respond with text/plain or text/markdown</li>
                                    <li><strong>Links return HTML:</strong> Linked pages must return plain text/markdown</li>
                                    <li><strong>Too large:</strong> File exceeds 10k tokens</li>
                                    <li><strong>Full docs in one file:</strong> Should link to separate pages</li>
                                </ul>
                                <p>Use our <a href="/check"><strong>CHECK</strong></a> tool to identify specific issues.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>How do I fix "links return HTML" errors?</summary>
                            <div class="faq-answer">
                                <p>Your llms.txt should link to markdown or plain text versions of pages, not HTML. Options:</p>
                                <ol>
                                    <li>Configure your CMS to serve markdown versions at alternate URLs</li>
                                    <li>Use our <a href="/create"><strong>CREATE</strong></a> tool to automatically convert and host markdown versions</li>
                                    <li>Set up content negotiation to return markdown when Accept header is text/markdown</li>
                                </ol>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>What's the recommended token limit for llms.txt files?</summary>
                            <div class="faq-answer">
                                <p>Keep your llms.txt file under <strong>10k tokens</strong>. The file itself should
                                    be compact--a table of contents, not the full content. Each page it links to
                                    should also stay under 10k tokens. This ensures efficient context usage and
                                    faster processing by AI agents.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Do I need to host markdown versions of my pages?</summary>
                            <div class="faq-answer">
                                <p>Yes, the URLs in your llms.txt must return content with Content-Type text/plain
                                    or text/markdown. If your site only serves HTML, use our <a href="/create"><strong>CREATE</strong></a>
                                    tool which automatically scrapes and converts your pages to markdown using the
                                    Parallel Extract API.</p>
                            </div>
                        </details>
                    </div>

                    <div class="faq-section">
                        <h3>PRACTICAL USAGE</h3>

                        <details class="faq-item" open>
                            <summary>How do I install an MCP server?</summary>
                            <div class="faq-answer">
                                <p>Click any "&#11015; INSTALL" button on our site to visit
                                    <strong>installthismcp.com</strong>, which provides step-by-step instructions
                                    for installing MCP servers into Claude Desktop or other compatible AI assistants.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>What makes a "high quality" llms.txt?</summary>
                            <div class="faq-answer">
                                <p>A high-quality llms.txt has:</p>
                                <ul>
                                    <li><strong>Clear structure:</strong> Logical organization with descriptive titles</li>
                                    <li><strong>Concise entries:</strong> Brief but informative descriptions for each link</li>
                                    <li><strong>Proper scope:</strong> Links to pages, not entire docs in one file</li>
                                    <li><strong>Accessible content:</strong> All linked pages return markdown/plain text</li>
                                    <li><strong>Right size:</strong> Both llms.txt and linked pages under 10k tokens</li>
                                    <li><strong>Updated regularly:</strong> Reflects current site structure</li>
                                </ul>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>How often should I update my llms.txt?</summary>
                            <div class="faq-answer">
                                <p>Update your llms.txt whenever you add, remove, or significantly reorganize
                                    content. For documentation sites, this might be with each release. For blogs,
                                    consider updating monthly or when adding major content sections.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>What happens if my llms.txt changes after creating an MCP?</summary>
                            <div class="faq-answer">
                                <p>MCP servers fetch content dynamically, so changes to your llms.txt are reflected
                                    immediately. There's no need to "reinstall" or update the MCP--it always reads
                                    the current version of your llms.txt file.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Can I have multiple llms.txt files for different sections?</summary>
                            <div class="faq-answer">
                                <p>The standard llms.txt lives at your domain root, but you can create llms.txt
                                    files for subdomains (e.g., docs.yoursite.com/llms.txt). Each subdomain's
                                    llms.txt can have its own MCP server.</p>
                            </div>
                        </details>
                    </div>

                    <div class="faq-section">
                        <h3>COMPARISON & INTEGRATION</h3>

                        <details class="faq-item" open>
                            <summary>How is this different from RAG or vector search?</summary>
                            <div class="faq-answer">
                                <p>Vector search (RAG) finds semantically similar content but loses document
                                    structure. llms.txt provides a navigable table of contents, allowing AI to
                                    reason about organization and relationships between topics. Both approaches are
                                    valuable--llms.txt excels for well-structured documentation, while RAG works
                                    better for unstructured knowledge bases.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Should I use llms.txt or a sitemap?</summary>
                            <div class="faq-answer">
                                <p>Use both! Sitemaps help search engines discover URLs. llms.txt provides
                                    AI-optimized content structure with markdown/text links. They serve
                                    complementary purposes--sitemaps for discovery, llms.txt for efficient AI
                                    consumption.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Which AI tools support llms.txt?</summary>
                            <div class="faq-answer">
                                <p>Any AI assistant with MCP support (like Claude Desktop) can use llms.txt via our
                                    MCP servers. Additionally, AI agents and browsers that follow the llmstxt.org
                                    standard can directly read these files. The ecosystem is growing rapidly.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Can I use this with my existing CMS?</summary>
                            <div class="faq-answer">
                                <p>Yes! If your CMS supports markdown export or custom content types, you can
                                    generate llms.txt directly. If not, use our <a href="/create"><strong>CREATE</strong></a> tool to
                                    automatically generate both the llms.txt and markdown versions from your
                                    existing HTML content.</p>
                            </div>
                        </details>
                    </div>

                    <div class="faq-section">
                        <h3>BUSINESS & STRATEGY</h3>

                        <details class="faq-item" open>
                            <summary>Why should my company invest in llms.txt?</summary>
                            <div class="faq-answer">
                                <p>As AI traffic grows, companies with llms.txt-enabled sites will:</p>
                                <ul>
                                    <li>Reduce server load from inefficient scraping</li>
                                    <li>Improve AI-generated recommendations about their products</li>
                                    <li>Enable developers to integrate with their APIs/docs without errors</li>
                                    <li>Prepare for the AI-first internet where agents are primary users</li>
                                </ul>
                                <p>Early adoption positions your content for the next wave of web traffic.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>What are the SEO implications of llms.txt?</summary>
                            <div class="faq-answer">
                                <p>llms.txt is complementary to traditional SEO. It doesn't affect traditional
                                    search rankings but optimizes your site for "agent search optimization"
                                    (ASO)--making your content more discoverable and accurately represented by AI
                                    agents and chatbots, which are becoming major traffic sources.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Is llms.txt a web standard or just a proposal?</summary>
                            <div class="faq-answer">
                                <p>llms.txt is an emerging community standard defined at <a
                                        href="https://llmstxt.org" target="_blank">llmstxt.org</a>. While not yet an
                                    official W3C standard, it's being rapidly adopted by major documentation sites
                                    and AI tool developers. Think of it like robots.txt in its early days.</p>
                            </div>
                        </details>

                        <details class="faq-item" open>
                            <summary>Who else is using llms.txt?</summary>
                            <div class="faq-answer">
                                <p>Check our <a href="/install"><strong>INSTALL</strong></a> page to see popular sites already using
                                    llms.txt. The list includes major documentation platforms, API providers, and
                                    developer tools. You can browse by popularity and tokens ingested.</p>
                            </div>
                        </details>
                    </div>
                </div>
            </div>`;
}

function renderCheckScript(): string {
  return `
    <script>
        function extractHostname(url) {
            try { return new URL(url).hostname; } catch (e) { return null; }
        }

        function getMcpName(domain) { return domain.replace(/\\./g, '-'); }

        function getInstallMcpUrl(hostname) {
            return 'https://installthismcp.com/' + getMcpName(hostname) + '?url=https://mcp.llmtext.com/' + hostname + '/mcp';
        }

        function checkUrlParameter() {
            var urlParams = new URLSearchParams(window.location.search);
            var checkUrl = urlParams.get('url') || urlParams.get('check');
            if (checkUrl) {
                window.history.replaceState({}, document.title, window.location.pathname);
                document.getElementById('check-url').value = checkUrl;
                setTimeout(function() { handleCheckValidation(); }, 100);
            }
        }

        async function handleCheckValidation() {
            var input = document.getElementById('check-url');
            var button = document.getElementById('check-btn');
            var resultDiv = document.getElementById('validation-result');
            var url = input.value.trim();
            if (!url) { alert('Please enter a URL'); return; }
            button.disabled = true;
            button.textContent = 'VALIDATING...';
            resultDiv.innerHTML = '<div class="loading">VALIDATING YOUR llms.txt FILE...</div>';
            try {
                var response = await fetch('https://check.llmtext.com/check?url=' + encodeURIComponent(url));
                var data = await response.json();
                renderValidationResult(data, url);
            } catch (error) {
                resultDiv.innerHTML = '<div class="validation-result invalid"><h4>\\u2717 VALIDATION ERROR</h4><p style="font-size: 0.85rem;">Failed to validate URL: ' + error.message + '</p></div>';
            } finally {
                button.disabled = false;
                button.textContent = 'VALIDATE';
            }
        }

        function renderValidationResult(data, url) {
            var resultDiv = document.getElementById('validation-result');
            var validClass = data.valid ? 'valid' : 'invalid';
            var icon = data.valid ? '\\u2713' : '\\u2717';
            var title = data.valid ? 'VALID llms.txt' : 'INVALID llms.txt';
            var hostname = extractHostname(url);
            var installUrl = hostname ? getInstallMcpUrl(hostname) : '#';
            var installDisabled = !data.valid ? 'disabled' : '';
            var html = '<div class="validation-result ' + validClass + '"><h4>' + icon + ' ' + title + '</h4>';
            if (data.errors && data.errors.length > 0) {
                html += '<h5 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.9rem;">ERRORS:</h5><ul class="validation-list errors">';
                data.errors.forEach(function(e) { html += '<li>' + e + '</li>'; });
                html += '</ul>';
            }
            if (data.warnings && data.warnings.length > 0) {
                html += '<h5 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.9rem;">WARNINGS:</h5><ul class="validation-list warnings">';
                data.warnings.forEach(function(w) { html += '<li>' + w + '</li>'; });
                html += '</ul>';
            }
            if (data.metadata) {
                html += '<div class="metadata-section"><h5>METADATA</h5><table class="metadata-table">';
                for (var key in data.metadata) {
                    var value = data.metadata[key];
                    if (value !== null && value !== undefined) {
                        var displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
                        html += '<tr><td>' + key + '</td><td>' + displayValue + '</td></tr>';
                    }
                }
                html += '</table></div>';
            }
            if (!data.valid) {
                html += '<div class="fix-suggestion"><h5>\\uD83D\\uDCA1 SUGGESTION</h5><p>Fix your llms.txt by recreating it with our library.</p><a href="/create">RECREATE WITH LIBRARY</a></div>';
            }
            html += '<a href="' + installUrl + '" class="install-mcp-btn ' + installDisabled + '" ' + (data.valid ? 'target="_blank" rel="noopener"' : '') + '>INSTALL THIS MCP</a></div>';
            resultDiv.innerHTML = html;
        }

        // Load invalid domains
        fetch('https://mcp.llmtext.com/index.json')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var invalidServers = data.servers.filter(function(s) { return !s.valid; });
                if (invalidServers.length === 0) return;
                var section = document.getElementById('invalid-domains-list');
                var tbody = document.getElementById('invalid-domains-tbody');
                section.style.display = 'block';
                tbody.innerHTML = '';
                invalidServers.forEach(function(server) {
                    var tr = document.createElement('tr');
                    var llmstxtUrl = 'https://' + server.hostname + '/llms.txt';
                    tr.innerHTML = '<td><div class="source-name"><img src="https://www.google.com/s2/favicons?domain=' + server.hostname.split('.').slice(-2).join('.') + '&sz=32" alt="" class="favicon"><a href="' + llmstxtUrl + '" target="_blank" rel="noopener">' + server.hostname + '</a></div></td><td><a href="/check?url=' + encodeURIComponent(llmstxtUrl) + '" class="btn-add">\\u26A0 CHECK</a></td>';
                    tbody.appendChild(tr);
                });
            });

        checkUrlParameter();
    </script>`;
}

function renderInstallScript(data: ServerData | null): string {
  const dataJson = data ? JSON.stringify(data) : "null";
  return `
    <script>
        window.data = ${dataJson};

        function extractApexDomain(hostname) {
            var parts = hostname.split('.');
            if (parts.length >= 2) return parts.slice(-2).join('.');
            return hostname;
        }

        function getFaviconUrl(domain) {
            return 'https://www.google.com/s2/favicons?domain=' + extractApexDomain(domain) + '&sz=32';
        }

        function getMcpName(domain) { return domain.replace(/\\./g, '-'); }

        function extractHostname(url) {
            try { return new URL(url).hostname; } catch (e) { return null; }
        }

        function formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\\.0$/, '') + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1).replace(/\\.0$/, '') + 'K';
            return num != null ? num.toString() : '';
        }

        function getInstallMcpUrl(hostname) {
            return 'https://installthismcp.com/' + getMcpName(hostname) + '?url=https://mcp.llmtext.com/' + hostname + '/mcp';
        }

        function handleCheckUrl() {
            var input = document.getElementById('llmtext-url');
            var url = input.value.trim();
            if (!url) { alert('Please enter a URL'); return; }
            window.location.href = '/check?url=' + encodeURIComponent(url);
        }

        function fuzzyMatch(text, query) {
            text = text.toLowerCase();
            query = query.toLowerCase();
            if (text.includes(query)) return true;
            var qi = 0;
            for (var i = 0; i < text.length && qi < query.length; i++) {
                if (text[i] === query[qi]) qi++;
            }
            return qi === query.length;
        }

        function handleSearch() {
            var query = document.getElementById('search-input').value.trim();
            if (!window.data || !window.data.servers) return;
            if (query === '') { window.filteredServers = null; renderServers(); return; }
            var validServers = window.data.servers.filter(function(s) { return s.valid; });
            window.filteredServers = validServers.filter(function(s) { return fuzzyMatch(s.hostname, query); });
            renderServers();
        }

        window.filteredServers = null;

        function renderServers() {
            var tbody = document.getElementById('servers-tbody');
            var stats = document.getElementById('stats');
            var noResults = document.getElementById('no-results');
            var createSuggestion = document.getElementById('create-suggestion');
            var tableContainer = document.querySelector('.table-container');
            if (!window.data || !window.data.servers) return;
            var serversToRender = window.filteredServers !== null ? window.filteredServers : window.data.servers.filter(function(s) { return s.valid; });
            var allValid = window.data.servers.filter(function(s) { return s.valid; });
            stats.innerText = formatNumber(allValid.length) + ' MCP SERVERS CREATED';
            if (serversToRender.length === 0) {
                tbody.innerHTML = '';
                tableContainer.style.display = 'none';
                noResults.style.display = 'block';
                createSuggestion.style.display = 'block';
            } else {
                tableContainer.style.display = 'block';
                noResults.style.display = 'none';
                createSuggestion.style.display = window.filteredServers !== null ? 'block' : 'none';
                tbody.innerHTML = '';
                serversToRender.forEach(function(server, index) {
                    var tr = document.createElement('tr');
                    var mcpUrl = getInstallMcpUrl(server.hostname);
                    var llmstxtUrl = 'https://' + server.hostname + '/llms.txt';
                    tr.innerHTML = '<td>' + (index + 1) + '</td><td><div class="source-name"><img src="' + getFaviconUrl(server.hostname) + '" alt="" class="favicon"><a href="' + llmstxtUrl + '" target="_blank" rel="noopener">' + server.hostname + '</a></div></td><td>' + formatNumber(server.total_tokens) + '</td><td>' + formatNumber(server.total_requests) + '</td><td>' + formatNumber(server.unique_users) + '</td><td><a href="' + mcpUrl + '" class="btn-add" target="_blank" rel="noopener">\\u2B07 INSTALL</a></td>';
                    tbody.appendChild(tr);
                });
            }
        }

        // Fetch fresh data
        fetch('https://mcp.llmtext.com/index.json')
            .then(function(r) { return r.json(); })
            .then(function(data) { window.data = data; renderServers(); })
            .catch(function(e) { console.error('Error fetching index.json:', e); });
    </script>`;
}

export function renderPage(
  activeTab: TabId,
  data: ServerData | null,
): string {
  let html = renderHead(activeTab);
  html += renderHeader();
  html += renderTabs(activeTab);

  switch (activeTab) {
    case "create":
      html += renderCreateContent();
      break;
    case "check":
      html += renderCheckContent();
      break;
    case "install":
      html += renderInstallContent(data);
      break;
    case "faq":
      html += renderFaqContent();
      break;
  }

  html += `\n        </div>\n    </div>`;

  // Add page-specific scripts before closing body
  switch (activeTab) {
    case "check":
      html += renderCheckScript();
      break;
    case "install":
      html += renderInstallScript(data);
      break;
  }

  html += `\n</body>\n</html>`;
  return html;
}
