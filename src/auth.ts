import { createFlickr } from "flickr-sdk";

export interface FlickrCredentials {
  consumerKey: string;
  consumerSecret: string;
  oauthToken: string;
  oauthTokenSecret: string;
}

export function loadCredentials(): FlickrCredentials {
  const consumerKey = process.env.FLICKR_CONSUMER_KEY;
  const consumerSecret = process.env.FLICKR_CONSUMER_SECRET;
  const oauthToken = process.env.FLICKR_OAUTH_TOKEN;
  const oauthTokenSecret = process.env.FLICKR_OAUTH_TOKEN_SECRET;

  const missing: string[] = [];
  if (!consumerKey) missing.push("FLICKR_CONSUMER_KEY");
  if (!consumerSecret) missing.push("FLICKR_CONSUMER_SECRET");
  if (!oauthToken) missing.push("FLICKR_OAUTH_TOKEN");
  if (!oauthTokenSecret) missing.push("FLICKR_OAUTH_TOKEN_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Run "npm run setup-auth" to configure credentials, or set them in your .env file.`
    );
  }

  return {
    consumerKey: consumerKey!,
    consumerSecret: consumerSecret!,
    oauthToken: oauthToken!,
    oauthTokenSecret: oauthTokenSecret!,
  };
}

export function createAuthenticatedClient(creds: FlickrCredentials) {
  return createFlickr({
    consumerKey: creds.consumerKey,
    consumerSecret: creds.consumerSecret,
    oauthToken: creds.oauthToken,
    oauthTokenSecret: creds.oauthTokenSecret,
  });
}

export async function validateCredentials(
  flickr: any
): Promise<{ userId: string; username: string }> {
  try {
    const res = await flickr("flickr.test.login", {});
    return {
      userId: res.user.id,
      username: res.user.username._content,
    };
  } catch (err: any) {
    throw new Error(
      `Flickr authentication failed: ${err.message ?? err}. ` +
        `Check your credentials or re-run "npm run setup-auth".`
    );
  }
}
