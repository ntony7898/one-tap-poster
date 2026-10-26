# One-Tap Poster — path to a real backend and iOS

## (a) Backend: Supabase (swap `api.js` only)
`api.js` is the only data module; `app.js` calls `window.API.*` (all async). Write `api.supabase.js` with the same methods and load it instead.

**Auth:** Supabase Auth — Sign in with Apple (required on iOS if any third-party login is offered), Google, email magic link. `signIn` → OAuth, then claim a handle.

**Tables** (all with RLS on):
- `profiles(id uuid pk = auth.uid, handle citext unique, name, bio, created_at, is_banned)`
- `posts(id, author_id, style, seed bigint, pal int, mix int, text varchar(80), remix_of_post, challenge_day date, created_at, hidden bool)` — store the recipe; optionally a rendered PNG in Storage for OG previews.
- `likes(user_id, post_id, pk(user_id,post_id))`, `follows(follower_id, followee_id, pk)`
- `challenges(day date pk, prompt, style)` (or keep deterministic client list), `challenge_entries(day, user_id, post_id, unique(day,user_id))` → enforces one per day.
- `reports(id, reporter_id, post_id|user_id, reason, status)`, `blocks(blocker_id, blocked_id)`
- Views / RPC: `feed_following`, `feed_discover` (exclude blocked + hidden), `leaderboard_daily`, `leaderboard_alltime` (materialised, refreshed by cron), counters via triggers.

**RLS:** read posts/profiles where not hidden and author not blocked by me; insert/update/delete only `author_id = auth.uid()`; likes/follows/blocks/reports insert only as self; reports readable only by moderators (role claim).
**Storage:** `posters/` bucket (public read, owner write) only if server-side PNGs/OG images are wanted; avatars stay generated.
**Moderation:** profanity/slur filter on text on the client *and* in a Postgres trigger or Edge Function; report button on every post and profile; block user (hides both ways); moderator queue (simple admin page or Supabase dashboard) with 24h response target; auto-hide after N reports.
**Deep links:** keep `#/p/<recipe>` (works without a server); add `/p/<id>` Edge Function for OG image previews later.

**App Store UGC rules (Guideline 1.2):** EULA/terms the user accepts with zero tolerance for objectionable content; method to filter objectionable content; mechanism to report offensive content with timely response; ability to block abusive users; published contact info. Also 5.1.1(v): in-app account deletion if accounts exist.

## (b) iOS wrap with Capacitor
- `npx cap init "One-Tap Poster" com.tonynguyen.onetapposter --web-dir .` ; add iOS; same static files.
- Sharing: `@capacitor/share` with a file written via `@capacitor/filesystem` (Web Share files is flaky in WKWebView); optional direct Instagram Stories via `instagram-stories://share` pasteboard (needs Facebook App ID), TikTok via TikTok OpenSDK share kit.
- Save to Photos: `NSPhotoLibraryAddUsageDescription`.
- Share extension (later): receive text from other apps → open Create prefilled (App Group + URL scheme / universal links for `/p/…`).
- Sign in with Apple is mandatory if Google/other social logins are offered (4.8).
- Privacy nutrition labels: test build = "Data Not Collected"; with backend: Contact Info (email), User Content (posts), Identifiers (user ID) — linked to user, not used for tracking. Add privacy manifest (PrivacyInfo.xcprivacy) for required-reason APIs (UserDefaults).
- Universal links (apple-app-site-association on a custom domain — GitHub Pages project path can’t host it at root of github.io).

## Decisions for Tony
1. Supabase project/org + region, and a custom domain (needed for universal links/OG previews).
2. Which logins (Apple only vs Apple + Google + email).
3. Moderation owner and response SLA; word-filter list; minimum age rating (UGC → likely 12+/17+).
4. Keep posts as recipes only, or also store PNGs (cost vs. previews).
5. Whether the demo community stays as onboarding seed content (clearly labelled) or is removed at launch.
