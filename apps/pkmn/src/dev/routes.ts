/**
 * Route table for the dev-tools server: the tool-page URLs, the client-bundle
 * asset URL, and the export form actions. The server matches these to serve the
 * static HTML shell, the Bun-built client JS, and the disk-write actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, route } from "remix/routes";

/**
 * Every tool page serves the same static shell, leaving navigation between them to
 * client-side view switching. `client` serves the bundled browser JS; each
 * `export*` form persists to disk through its own action.
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
