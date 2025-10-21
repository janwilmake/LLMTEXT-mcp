export default {
  async fetch(request: Request): Promise<Response> {
    try {
      // Fetch the JSON data
      const response = await fetch("https://mcp.llmtext.com/index.json");
      const data: any = await response.json();

      // Generate llms.txt content
      let content = "# llms.txt\n\n";

      // Add summary
      const totalServers = data.servers.length;
      const activeServers = data.servers.filter(
        (s: any) => s.total_requests > 0
      ).length;
      const totalUsers = data.users.length;
      const totalRequests = data.users.reduce(
        (sum: number, u: any) => sum + u.total_requests,
        0
      );
      const totalTokens = data.users.reduce(
        (sum: number, u: any) => sum + u.total_tokens,
        0
      );

      content += `> MCP Server Usage Statistics\n`;
      content += `> Total Servers: ${totalServers} (${activeServers} active)\n`;
      content += `> Total Users: ${totalUsers}\n`;
      content += `> Total Requests: ${totalRequests}\n`;
      content += `> Total Tokens Ingested: ${totalTokens.toLocaleString()}\n\n`;

      // Add active servers (those with requests > 0)
      const activeServersList = data.servers;

      if (activeServersList.length > 0) {
        for (const server of activeServersList) {
          const name = server.hostname;
          const url = `https://${server.hostname}/llms.txt`;
          const description =
            server.total_requests > 0
              ? `${
                  server.total_requests
                } requests, ${server.total_tokens.toLocaleString()} tokens, ${
                  server.unique_users
                } user${server.unique_users !== 1 ? "s" : ""}`
              : undefined;

          content += `- [${name}](${url})${
            description === undefined ? "" : `: ${description}`
          }\n`;
        }
      }

      // Add inactive servers section
      const inactiveServers = data.servers.filter(
        (server: any) => server.total_requests === 0
      );

      if (inactiveServers.length > 0) {
        content += `\n## Inactive Servers\n\n`;
        for (const server of inactiveServers) {
          const name = server.hostname;
          const url = `https://${server.hostname}/llms.txt`;
          content += `- [${name}](${url}): No activity yet\n`;
        }
      }

      // Return as text/plain
      return new Response(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        },
      });
    } catch (error) {
      return new Response(
        "Error fetching or parsing data: " + (error as Error).message,
        {
          status: 500,
          headers: {
            "Content-Type": "text/plain",
          },
        }
      );
    }
  },
};
