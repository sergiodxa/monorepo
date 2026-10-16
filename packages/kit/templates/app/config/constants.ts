/**
 * Values the app is configured with that never change between requests. Edit them when the app
 * gets its own domain, since links and identifiers built from them are published.
 */

/** The origin the app is published at: canonical links, the sitemap and robots.txt name it. */
export const SITE_URL = "https://example.com";

/** The app's name, as `og:site_name` and structured data publish it. */
export const SITE_NAME = "App";

/** The description a page without its own publishes, in search results and link previews. */
export const SITE_DESCRIPTION = "A Remix app on Cloudflare Workers.";

/** Where problem `type` URIs point; each problem's slug follows it, so it ends in `/`. */
export const PROBLEMS_URL = "https://example.com/problems/";

/** Who the app's email comes from: an address on a domain Cloudflare Email Routing verified. */
export const MAIL_FROM = { email: "no-reply@example.com", name: "App" };
