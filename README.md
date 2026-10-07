# Career Intelligence App

Files: index.html (dashboard PWA), live.html (real AI analysis), privacy.html, netlify/functions/ai.mjs (server-side AI call), manifest, service worker, icons.

## Deploy (functions need Git or CLI, not drag and drop)
1. Push this folder to a GitHub repo.
2. Netlify: Add new site > Import from Git. Build command empty. Publish directory ".".
3. Site configuration > Environment variables: ANTHROPIC_API_KEY (required), CLAUDE_MODEL (optional).
4. Open the site, test Live AI.

## Google Play (Trusted Web Activity)
1. Create a Google Play Console developer account.
2. pwabuilder.com: enter your Netlify URL > Package for stores > Android. Download the zip (AAB, signing key, assetlinks.json).
3. Put the SHA-256 and package ID into .well-known/assetlinks.json, redeploy.
4. Play Console: create app, upload AAB, add listing from STORE_LISTING.md, privacy URL, data safety, content rating.
5. Test with a closed testing track, then promote to production.
Keep the signing key safe.
