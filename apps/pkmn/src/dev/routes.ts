/**
 * Route table for the dev-tools server. Declares the tool-page URLs (launcher
 * plus the four editor placeholders), the client-bundle asset URL, and the
 * export form action. The server matches these to serve the static HTML shell,
 * the Bun-built client JS, and to handle disk-write actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, route } from "remix/fetch-router/routes";

/**
 * The dev-tools routes. Every tool page (`/`, `/sprite`, `/map`, `/species`,
 * `/trainer`) serves the same static shell — client-side view switching handles
 * navigation between them without a server round-trip. `client` serves the
 * bundled browser JS and `export` handles content persistence via `action`.
 */
export default route({
	launcher: get("/"),
	sprite: get("/sprite"),
	map: get("/map"),
	species: get("/species"),
	trainer: get("/trainer"),

	client: get("/client.js"),

	export: form("/dev/export"),
});
