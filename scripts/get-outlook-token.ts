import dotenv from "dotenv";
import http from "http";
import { URL } from "url";

dotenv.config();

const clientId = process.env.OUTLOOK_CLIENT_ID;
const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
const tenant = process.env.OUTLOOK_TENANT_ID || "common";
const redirectUri =
  process.env.OUTLOOK_REDIRECT_URI || "http://localhost:3333/callback";
const scope = [
  "openid",
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
].join(" ");

if (!clientId) {
  console.error("Set OUTLOOK_CLIENT_ID in .env");
  process.exit(1);
}

const authorizeUrl =
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize` +
  `?client_id=${encodeURIComponent(clientId)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}` +
  `&response_mode=query` +
  `&scope=${encodeURIComponent(scope)}`;

const listenUrl = new URL(redirectUri);

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope,
  });

  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }

  return data;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname !== listenUrl.pathname) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const err = url.searchParams.get("error");
    if (err) {
      throw new Error(url.searchParams.get("error_description") || err);
    }

    const code = url.searchParams.get("code");
    if (!code) {
      throw new Error("No authorization code in callback");
    }

    const tokens = await exchangeCode(code);

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Outlook login ok. You can close this tab.");

    console.log("\nOutlook tokens\n");
    console.log("access_token:\n", tokens.access_token);
    console.log("\nrefresh_token:\n", tokens.refresh_token || "(none — add offline_access and try again)");
    console.log("\nexpires_in:", tokens.expires_in);
    console.log("\nCopy access_token into the /send body as accessToken.\n");

    server.close();
    process.exit(0);
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(error.message);
    console.error(error.message);
    server.close();
    process.exit(1);
  }
});

server.listen(Number(listenUrl.port) || 3333, listenUrl.hostname, () => {
  console.log("Open this URL, sign in with Outlook, and approve Mail.Send:\n");
  console.log(authorizeUrl);
  console.log(`\nWaiting on ${redirectUri}`);
  console.log("Azure app redirect URI must match that exactly.\n");
});
