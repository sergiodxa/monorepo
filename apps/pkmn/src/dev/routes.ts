/**
 * Route table for the dev-tools server. Declares the tool-page URLs (launcher
 * plus the four editor placeholders), the client-bundle asset URL, and the
 * export form actions (text, binary, and sprite). The server matches these to
 * serve the static HTML shell, the Bun-built client JS, and to handle disk-write
 * actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, route } from "remix/fetch-router/routes";

/**
 * The dev-tools routes. Every tool page (`/`, `/sprite`, `/map`, `/species`,
 * `/trainer`) serves the same static shell — client-side view switching handles
 * navigation between them without a server round-trip. `client` serves the
 * bundled browser JS. `export` persists UTF-8 text; `exportBinary` persists
 * base64-decoded bytes; `exportSprite` writes a PNG and registers it in the
 * asset manifest. All persist via `action`.
 */
export default route({
	launcher: get("/"),
	sprite: get("/sprite"),
	map: get("/map"),
	species: get("/species"),
	trainer: get("/trainer"),
	importer: get("/importer"),

	client: get("/client.js"),

	export: form("/dev/export"),
	exportBinary: form("/dev/export/binary"),
	exportSprite: form("/dev/export/sprite"),
	exportAtlas: form("/dev/export/atlas"),
	exportTrainer: form("/dev/export/trainer"),
	exportMap: form("/dev/export/map"),
	exportSpecies: form("/dev/export/species"),
	exportImport: form("/dev/export/import"),
});
