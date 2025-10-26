import { handleOAuth, Env } from "./provider";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle OAuth routes
    const oauthResponse = await handleOAuth(request, env);
    if (oauthResponse) return oauthResponse;

    // Demo homepage - client-side authentication
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SimplerAuth</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}body{font:14px system-ui;background:#fcfcfa;color:#1d1b16;min-height:100vh;display:flex;align-items:center;justify-content:center}@media(prefers-color-scheme:dark){body{background:#1d1b16;color:#fcfcfa}}.container{text-align:center;max-width:320px}.card{background:#fcfcfa;border:1px solid #d8d0bf;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(29,27,22,.1)}@media(prefers-color-scheme:dark){.card{background:#1d1b16;border-color:#d8d0bf33}}.avatar{width:80px;height:80px;border-radius:50%;margin:0 auto 16px;display:block;border:2px solid #d8d0bf}.name{font-weight:600;font-size:16px;margin-bottom:8px}.username{margin-bottom:8px;color:#d8d0bf}.loading{color:#d8d0bf}
  </style>
</head>
<body>
  <div class="container">
    <div class="card" id="content">
      <p class="loading">Loading...</p>
    </div>
  </div>
  <script>
    (async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      
      if (code) {
        // Exchange code for token
        try {
          const tokenResponse = await fetch('${url.origin}/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              client_id: '${env.SELF_CLIENT_ID}',
              resource: '${url.origin}',
            }),
          });
          
          if (!tokenResponse.ok) {
            throw new Error('Token exchange failed');
          }
          
          const tokenData = await tokenResponse.json();
          localStorage.setItem('access_token', tokenData.access_token);
          
          // Clear code from URL
          history.replaceState({}, '', location.pathname);
        } catch (error) {
          console.error('Auth error:', error);
          document.getElementById('content').innerHTML = '<p class="loading">Login failed. <a href="/">Try again</a></p>';
          return;
        }
      }
      
      const accessToken = localStorage.getItem('access_token');
      
      if (!accessToken) {
        // No token - show login button
        const loginUrl = '${url.origin}/authorize?client_id=${
        env.SELF_CLIENT_ID
      }&redirect_uri=${encodeURIComponent(url.origin)}';
        document.getElementById('content').innerHTML = '<a href="' + loginUrl + '" style="color:#fb631b;text-decoration:none;font-weight:600">Login with X</a>';
        return;
      }
      
      // Fetch user profile
      try {
        const meResponse = await fetch('${url.origin}/me', {
          headers: { Authorization: 'Bearer ' + accessToken },
        });
        
        if (!meResponse.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const user = await meResponse.json();
        
        // Display user profile
        document.getElementById('content').innerHTML = \`
          <img src="\${user.profile_image_url || '/default-avatar.png'}" alt="Avatar" class="avatar">
          <p class="name">\${user.name}</p>
          <p class="username">@\${user.username}</p>
          <p>\${user.verified ? '✓ Verified' : 'Unverified'}</p>
          <p style="margin-top:16px"><a href="#" onclick="localStorage.removeItem('access_token');location.reload()" style="color:#fb631b;text-decoration:none">Logout</a></p>
        \`;
      } catch (error) {
        console.error('Profile error:', error);
        localStorage.removeItem('access_token');
        document.getElementById('content').innerHTML = '<p class="loading">Session expired. <a href="/">Login again</a></p>';
      }
    })();
  </script>
</body>
</html>`,
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  },
};
