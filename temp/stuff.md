Here’s what I found on the EVE Online ESI (EVE Swagger Interface) API, specifically around authentication and rate/request limits:

Authentication via SSO

ESI uses EVE’s Single Sign-On (SSO) for handling authentication. Each endpoint that requires authentication will display a lock icon in the Swagger UI and specify the required scope if you hover over it. You'll need to configure your developer application’s keys and scopes accordingly.
developers.eveonline.com
+13
esi-docs
+13
developers.eveonline.com
+13

OAuth versioning: The older endpoints (oauth/authorize, oauth/token, oauth/verify) were deprecated in late 2021. You should now use v2/oauth/authorize and v2/oauth/token instead. These new endpoints issue JWT tokens, which can be validated client-side using publicly available metadata.
developers.eveonline.com

Token lifespan: Authentication relies on two types of tokens:

Access tokens, which are valid for ~20 minutes.

Refresh tokens, which can be used indefinitely (unless revoked) to obtain new access tokens.
EVE Online Forums
+5
EVE Online Forums
+5
GitHub
+5

Revocation: Users can revoke a third-party application's access via CCP's official page (for instance, via EVE's third-party applications management). Additionally, some services, like zKillboard, also offer their own management interfaces.
EVE Online Forums
+1

Rate Limits & Error Handling

Unlike older APIs, ESI generally does not enforce fixed request rate limits. Instead, it relies on an error limit mechanism: if an app generates too many erroneous requests, further requests will be blocked until the next time frame.
EVE Online Forums
+6
esi-docs
+6
Medium
+6

Error rate limits:

If 100 errors occur within a 60-second window, your app will start receiving HTTP 420 (or similar throttling) responses for the remainder of that window.
developers.eveonline.com
developers.eveonline.com
+1

These error limits help prevent misuse without capping valid traffic.

Cache considerations:

ESI uses HTTP caching headers like Expires and Last-Modified to indicate when data should be refreshed. Requesting data before its expiration is wasteful and may count as abuse.
esi-docs

Specific undocumented rate limits:

Some endpoints—such as characters/{character_id}/corporationhistory/ and markets/{region_id}/history/—do impose stricter limits: 300 requests per IP per minute. These constraints are not documented in the official API docs but noted in community-maintained sources.
EVE University Wiki
+2
EVE Online
+2

Best Practices:

Ensure you handle and monitor ESI’s error-limit headers (X-ESI-Error-Limit-Remain and X-ESI-Error-Limit-Reset) to avoid triggering throttling or bans.
developers.eveonline.com
+11
developers.eveonline.com
+11
esi-docs
+11

Spread out high-volume traffic over time rather than in sudden spikes.

Use appropriate User-Agent headers that include contact info—CCP can reach out if your app is causing issues.
EVE Online
esi-docs
+1

Community Commentary

From the Reddit discussion on r/evetech:

“Do you really need realtime information?... Just provide him a way to instantly refresh the status… and then just keep refreshing every 30 or 60 seconds.”
developers.eveonline.com
+5
Reddit
+5
EVE University Wiki
+5

This reflects the community’s approach to minimize redundant requests while working within cached boundaries.

Summary Table
Topic Details
Authentication SSO via OAuth v2, using JWT tokens, with both access and refresh tokens
Access Token Valid for ~20 minutes
Refresh Token Indefinite (unless revoked)
Revocation Via CCP’s third-party app management interface
Rate Limiting None general—error-based throttling instead (100 errors/min)
Undocumented Limits 300 req/min per IP for certain endpoints (e.g., market history)
Caching Use Expires headers; avoid premature refreshes
Best Practices Monitor error-limit headers, include User-Agent, avoid traffic spikes
Your Key Question: "Creating an app to get high rate limit?"

Unfortunately, there’s no special ‘high rate limit’ granted by creating an app. The overall mechanism applies uniformly to all developers.

Your app must operate within ESI’s existing error limit framework and any endpoint-specific limits.

If you need to work around stricter limits (e.g., for market history), consider routing through your own proxy with built-in caching and rate control (e.g., using tools like eve-esi-proxy).
EVE University Wiki
+7
EVE Online Forums
+7
developers.eveonline.com
+7
developers.eveonline.com
GitHub
+2
EVE University Wiki
+2
