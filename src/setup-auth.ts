import "dotenv/config";
import { createFlickr } from "flickr-sdk";
import { createServer } from "node:http";
import { URL } from "node:url";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const CALLBACK_PORT = 8976;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;
const ENV_PATH = resolve(process.cwd(), ".env");

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function updateEnvFile(key: string, value: string) {
  let content = "";
  if (existsSync(ENV_PATH)) {
    content = readFileSync(ENV_PATH, "utf-8");
  }

  const regex = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + "\n" + line + "\n";
  }

  writeFileSync(ENV_PATH, content);
}

async function main() {
  console.log("=== Flickr MCP Server — OAuth Setup ===\n");

  // Get consumer key/secret
  let consumerKey = process.env.FLICKR_CONSUMER_KEY;
  let consumerSecret = process.env.FLICKR_CONSUMER_SECRET;

  if (!consumerKey) {
    consumerKey = await prompt(
      "Enter your Flickr API Key (consumer key): "
    );
  } else {
    console.log(`Using FLICKR_CONSUMER_KEY from environment: ${consumerKey.slice(0, 6)}...`);
  }

  if (!consumerSecret) {
    consumerSecret = await prompt(
      "Enter your Flickr API Secret (consumer secret): "
    );
  } else {
    console.log(`Using FLICKR_CONSUMER_SECRET from environment.`);
  }

  if (!consumerKey || !consumerSecret) {
    console.error("API key and secret are required.");
    process.exit(1);
  }

  // Save consumer credentials to .env
  updateEnvFile("FLICKR_CONSUMER_KEY", consumerKey);
  updateEnvFile("FLICKR_CONSUMER_SECRET", consumerSecret);

  // Create flickr client for OAuth flow (no user tokens yet)
  const { oauth } = createFlickr({
    consumerKey,
    consumerSecret,
    oauthToken: false as unknown as string,
    oauthTokenSecret: false as unknown as string,
  });

  // Step 1: Get request token
  console.log("\nRequesting authorization from Flickr...");
  const { requestToken, requestTokenSecret } = await oauth.request(CALLBACK_URL);

  // Step 2: Build auth URL and open browser
  const authUrl = oauth.authorizeUrl(requestToken, "write");
  console.log(`\nOpen this URL in your browser to authorize:\n\n  ${authUrl}\n`);

  // Step 3: Wait for callback
  const verifier = await waitForCallback();

  // Step 4: Exchange for access token
  console.log("\nExchanging for access token...");

  // The oauth object needs the request token set for verification
  // We need to create a new client with the request token to verify
  const { oauth: oauth2 } = createFlickr({
    consumerKey,
    consumerSecret,
    oauthToken: requestToken,
    oauthTokenSecret: requestTokenSecret,
  });

  const result = await oauth2.verify(verifier);

  const { oauthToken, oauthTokenSecret, username, nsid } = result;

  // Save to .env
  updateEnvFile("FLICKR_OAUTH_TOKEN", oauthToken);
  updateEnvFile("FLICKR_OAUTH_TOKEN_SECRET", oauthTokenSecret);

  console.log(`\nAuthenticated as: ${username} (${nsid})`);
  console.log(`Credentials saved to ${ENV_PATH}`);
  console.log("\nYou can now start the server with: npm start");
  console.log(
    "Or configure Claude Desktop to use this server (see README)."
  );

  process.exit(0);
}

function waitForCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname === "/callback") {
        const verifier = url.searchParams.get("oauth_verifier");

        if (verifier) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>"
          );
          server.close();
          resolve(verifier);
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h1>Authorization failed</h1><p>No verifier received. Please try again.</p></body></html>"
          );
          server.close();
          reject(new Error("No oauth_verifier in callback"));
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(CALLBACK_PORT, () => {
      console.log(
        `Waiting for authorization callback on http://localhost:${CALLBACK_PORT}/callback ...`
      );
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth callback timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

main().catch((err) => {
  console.error("Setup failed:", err.message ?? err);
  process.exit(1);
});
