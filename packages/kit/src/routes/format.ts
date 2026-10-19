/**
 * The two shapes `sdxc routes` prints: a table per route contract for a terminal, under each
 * router's global middleware, and a JSON array an agent parses, the same for every run over
 * the same files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MiddlewareEntry, RouteEntry, RouteListing } from "./index.js";

/** Where a router's global middleware wraps, a width every terminal shows whole. */
const LINE_WIDTH = 100;

/** The listing as pretty-printed JSON: the routes array alone, with a trailing newline. */
export function formatJSON(listing: RouteListing): string {
	return `${JSON.stringify(listing.routes, null, 2)}\n`;
}

/**
 * The listing as text: each router's global middleware once, since every route it maps runs it
 * first, then one aligned table per contract. MIDDLEWARE lists `lazy()` guards, then the
 * controller's chain, in the order they run.
 */
export function formatTable(listing: RouteListing): string {
	if (listing.routes.length === 0) return "No routes found in routes/.\n";
	let lines: string[] = [];
	let multiple = listing.routers.length > 1;
	for (let router of listing.routers) {
		lines.push(`Router ${router.file}`);
		if (router.middleware.length === 0) lines.push("  (no global middleware)");
		else lines.push(...wrap(router.middleware.map((entry) => entry.name)));
		lines.push("");
	}
	let contracts = [...new Set(listing.routes.map((route) => route.contract))];
	for (let contract of contracts) {
		let routes = listing.routes.filter((route) => route.contract === contract);
		let header = [
			"METHOD",
			"PATTERN",
			"NAME",
			...(multiple ? ["ROUTER"] : []),
			"CONTROLLER",
			"MIDDLEWARE",
		];
		let rows = routes.map((route) => [
			route.method,
			route.pattern,
			route.name,
			...(multiple ? [route.router ?? ""] : []),
			controller(route),
			names([...route.middleware.guards, ...route.middleware.controller]),
		]);
		let widths = header.map((cell, column) =>
			Math.max(cell.length, ...rows.map((row) => (row[column] ?? "").length)),
		);
		lines.push(contract);
		for (let row of [header, ...rows]) {
			lines.push(
				`  ${row
					.map((cell, column) =>
						column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0),
					)
					.join("  ")
					.trimEnd()}`,
			);
		}
		lines.push("");
	}
	return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * The listing as one block per route, every field on its own line, for a terminal too narrow
 * for the table. Middleware is split by where it runs: the router's, `lazy()` guards, then the
 * controller's chain, each in its run order.
 */
export function formatExpanded(listing: RouteListing): string {
	if (listing.routes.length === 0) return "No routes found in routes/.\n";
	let blocks = listing.routes.map((route, index) => {
		let fields: Array<[string, string]> = [
			["Method", route.method],
			["Pattern", route.pattern],
			["Name", route.name],
			["Contract", route.contract],
			["Router", route.router ?? ""],
			["Controller", controller(route)],
			["Router middleware", names(route.middleware.router)],
			["Guards", names(route.middleware.guards)],
			["Controller middleware", names(route.middleware.controller)],
		];
		let width = Math.max(...fields.map(([label]) => label.length));
		let lines = fields.map(([label, value]) => `${label.padEnd(width)} | ${value}`.trimEnd());
		let title = `--[ Route ${index + 1} ]`;
		let rule = Math.min(LINE_WIDTH, Math.max(...lines.map((line) => line.length)));
		return [title.padEnd(rule, "-"), ...lines].join("\n");
	});
	return `${blocks.join("\n\n")}\n`;
}

/** The controller column: the file with a named export after `#`, or why there is none. */
function controller(route: RouteEntry): string {
	if (route.controller === null) return "(not mapped)";
	if (route.controller.file === null) return "(unresolved)";
	if (route.controller.export === null || route.controller.export === "default") {
		return route.controller.file;
	}
	return `${route.controller.file}#${route.controller.export}`;
}

/** Names joined by commas in lines of at most {@link LINE_WIDTH} columns, each indented two spaces. */
function wrap(items: readonly string[]): string[] {
	let lines: string[] = [];
	let line = "";
	for (let [index, item] of items.entries()) {
		let piece = index === items.length - 1 ? item : `${item},`;
		if (line !== "" && line.length + 1 + piece.length > LINE_WIDTH - 2) {
			lines.push(`  ${line}`);
			line = piece;
		} else line = line === "" ? piece : `${line} ${piece}`;
	}
	if (line !== "") lines.push(`  ${line}`);
	return lines;
}

/** Middleware names joined in the order they run. */
function names(entries: readonly MiddlewareEntry[]): string {
	return entries.map((entry) => entry.name).join(", ");
}
