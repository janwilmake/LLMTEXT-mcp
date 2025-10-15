import { Readability } from "@mozilla/readability";

import { JSDOM } from "jsdom";

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  url.searchParams.delete("path");
  const [accept, ...rest] = url.pathname.split("/").slice(1);
  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rest.join("/") + url.search);
    // Remove any malformed protocol strings
    targetUrl = targetUrl.replace(/^https?:\/+/, "");

    // Ensure proper protocol format
    if (!targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }
    new URL(targetUrl);
  } catch (e) {
    return new Response("Invalid URL", { status: 400 });
  }

  if (!["html", "json", "md"].includes(accept)) {
    return new Response("Invalid endpoint. Use /html|md|json/URL", {
      status: 400,
    });
  }

  let response: Response;
  try {
    console.log({ targetUrl });
    response = await fetch(targetUrl);
  } catch (e) {
    return new Response("Fetch failed:" + e.message + `\nTARGET:${targetUrl}`, {
      status: 400,
    });
  }
  if (!response.ok) {
    try {
      const text = await response.text();
      return new Response(text, { status: response.status });
    } catch (e) {
      return new Response(response.statusText, { status: response.status });
    }
  }
  const isHTML = response.headers.get("content-type")?.includes("text/html");
  if (!isHTML) {
    return new Response("No HTML", { status: 404 });
  }
  try {
    const html = await response.text();
    const doc = new JSDOM(html, { url: targetUrl });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article) {
      return new Response("Failed parsing into article", { status: 400 });
    }

    if (accept === "html") {
      return new Response(article?.content, {
        status: 200,
        headers: { "Content-Type": "text/html;charset=utf8" },
      });
    }

    if (accept === "md") {
      return new Response(article?.textContent, {
        status: 200,
        headers: { "Content-Type": "text/markdown;charset=utf8" },
      });
    }

    return new Response(JSON.stringify(article, undefined, 2), {
      status: 200,
      headers: { "Content-Type": "application/json;charset=utf8" },
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
};
