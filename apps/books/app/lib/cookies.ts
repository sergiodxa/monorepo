/**
 * The cookies the funnel sets. The attribution cookie is how a campaign survives from the
 * page a visitor lands on to the form or checkout they finish on, since the app keeps no
 * session; it is signed so the campaign a sale is credited to comes from this app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cookie } from "remix/cookie";

import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";

/** Ninety days, matching how long the attribution middleware lets a first touch stand. */
const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * The signed cookie holding a visitor's first and last touch. Built when the router is,
 * so the signing secret is read by the request that needs it.
 *
 * @returns The cookie the attribution middleware reads and writes.
 * @example attribution({ store: attributionCookie() })
 */
export function attributionCookie(): Cookie {
	return createCookie("attribution", {
		path: "/",
		maxAge: ATTRIBUTION_MAX_AGE,
		httpOnly: true,
		sameSite: "Lax",
		secure: true,
		secrets: [env.COOKIE_SECRET],
	});
}
