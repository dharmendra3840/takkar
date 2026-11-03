// IndexNow: tells Bing, Yandex, Seznam and Naver (and through Bing, the search behind ChatGPT and Copilot)
// that pages are new or changed. The key is public by design; the same text is served at /<key>.txt.
export const HOST = 'www.playtakkar.in';
export const KEY = '84e846720f3e3a6fff97831f86ad2652';

/** Submits up to 10,000 URLs on this site. Returns the HTTP status: 200 or 202 means accepted. */
export async function submitUrls(urls) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
  });
  return res.status;
}
