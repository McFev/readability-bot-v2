export const APP_URL = process.env.APP_URL ?? "https://" + process.env.VERCEL_URL;
export const READABILITY_API_URL = getApiUrlFromEnv();

function getApiUrlFromEnv() {
  if (process.env.READABILITY_API_URL) {
    return process.env.READABILITY_API_URL;
  } else if (process.env.VERCEL_URL) {
    return "https://" + process.env.VERCEL_URL + "/api/readability";
  } else {
    return "https://readability-bot-v2.vercel.app/api/readability";
  }
}

export function constructReadableUrl(url) {
  const readableUrl = `${READABILITY_API_URL}?url=${encodeURIComponent(url)}`;
  return readableUrl;
}

