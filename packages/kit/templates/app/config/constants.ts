/**
 * Values the app is configured with that never change between requests. Edit them when the app
 * gets its own domain, since links and identifiers built from them are published.
 */

/** Where problem `type` URIs point; each problem's slug follows it, so it ends in `/`. */
export const PROBLEMS_URL = "https://example.com/problems/";

/** Who the app's email comes from: an address on a domain Cloudflare Email Routing verified. */
export const MAIL_FROM = { email: "no-reply@example.com", name: "App" };
