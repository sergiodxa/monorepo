/**
 * The web route contract: every page the app serves, by name. Controllers and links build
 * URLs with `routes.<name>.href()`, so a pattern changes here and nowhere else.
 */

import { get, route } from "remix/routes";

/** The pages, and the 404 page for any path no other route claims. */
export default route({
	home: get("/"),
	robots: get("/robots.txt"),
	sitemap: get("/sitemap.xml"),
	notFound: "/*path",
});
