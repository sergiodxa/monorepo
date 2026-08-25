/**
 * Bun dev-tools server: it builds the client bundle with `Bun.build` at startup,
 * then serves a static HTML shell for every tool page, the bundled client JS at
 * `/client.js`, and JSON export actions that write authored content to disk.
 * Starts only under `APP_ENV=development`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, type Result } from "@pkg/result";
import { createRouter } from "remix/router";

import { runAtlasExport } from "./atlas-export";
import { runBinaryExport, runExport, runSpriteExport } from "./export";
import { runImporterExport } from "./importer-export";
import { runMapExport } from "./map-export";
import { PathSafetyError } from "./path-safety";
import routes from "./routes";
import { runSpeciesExport } from "./species-export";
import { runTrainerExport } from "./trainer-export";

/** Default dev-server port, distinct from the game's so both can run at once. */
const DEFAULT_PORT = 4321;

/** Absolute path to the client entry that `Bun.build` bundles for the browser. */
const CLIENT_ENTRY = new URL("./client.tsx", import.meta.url).pathname;

/**
 * Static HTML shell served for every tool page: the `#app` mount point plus the
 * bundled client module, which renders the whole tree in the browser.
 */
const HTML_SHELL = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>PKMN Dev Tools</title>
		<style>
			html,
			body {
				margin: 0;
				background: #09090b;
			}
		</style>
	</head>
	<body>
		<div id="app"></div>
		<script type="module" src="/client.js"></script>
	</body>
</html>
`;

/**
 * Bundles the client entry for the browser with Bun and returns the JS text.
 * Throws if the build fails so the server never boots with a broken bundle.
 *
 * @returns The bundled client JavaScript as a UTF-8 string.
 */
async function buildClientBundle(): Promise<string> {
	let result = await Bun.build({
		entrypoints: [CLIENT_ENTRY],
		target: "browser",
		minify: false,
	});

	if (!result.success) {
		let messages = result.logs
			.map((log) => {
				let { position } = log;
				if (!position) return log.message;
				return `${position.file}:${position.line}:${position.column}: ${log.message}`;
			})
			.join("\n");
		throw new Error(`Client bundle build failed:\n${messages}`);
	}

	return await result.outputs[0]!.text();
}

/**
 * Builds the dev-tools router: tool pages serve the HTML shell, `/client.js`
 * serves the pre-built bundle, and the export actions validate and write their
 * payloads, mapping validation to 400, path rejections to 403, success to 200.
 *
 * @param clientBundle The bundled client JS to serve at `/client.js`.
 * @returns A configured router whose `fetch` handles every dev-tools request.
 */
function createDevRouter(clientBundle: string) {
	let router = createRouter();

	function serveShell() {
		return new Response(HTML_SHELL, {
			headers: { "content-type": "text/html; charset=utf-8" },
		});
	}

	router.map(routes.launcher, serveShell);
	router.map(routes.sprite, serveShell);
	router.map(routes.map, serveShell);
	router.map(routes.species, serveShell);
	router.map(routes.trainer, serveShell);
	router.map(routes.importer, serveShell);

	router.map(routes.client, () => {
		return new Response(clientBundle, {
			headers: { "content-type": "text/javascript; charset=utf-8" },
		});
	});

	/**
	 * Runs a JSON export handler: parses the body, invokes the export function,
	 * and maps the outcome to JSON. A malformed body or payload is a 400, a
	 * path-safety rejection a 403, and success returns the handler's own body.
	 *
	 * @param request The incoming export request.
	 * @param run The export function to feed the parsed payload.
	 * @param body Projects a success result into the JSON response body.
	 * @returns The JSON response to send.
	 */
	async function handleExport<Data>(
		request: Request,
		run: (payload: unknown) => Promise<Result<Data, Error>>,
		body: (data: Data) => Record<string, unknown>,
	): Promise<Response> {
		let payload: unknown;
		try {
			payload = await request.json();
		} catch {
			return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}

		let result = await run(payload);
		if (isFailure(result)) {
			let status = result.error instanceof PathSafetyError ? 403 : 400;
			return Response.json({ error: result.error.message }, { status });
		}

		return Response.json(body(result.data));
	}

	router.map(routes.export.action, (ctx) =>
		handleExport(ctx.request, runExport, (data) => ({
			path: data.path,
			bytesWritten: data.bytesWritten,
		})),
	);

	router.map(routes.exportBinary.action, (ctx) =>
		handleExport(ctx.request, runBinaryExport, (data) => ({
			path: data.path,
			bytesWritten: data.bytesWritten,
		})),
	);

	router.map(routes.exportSprite.action, (ctx) =>
		handleExport(ctx.request, runSpriteExport, (data) => ({
			id: data.id,
			path: data.path,
			url: data.url,
			bytesWritten: data.bytesWritten,
		})),
	);

	router.map(routes.exportAtlas.action, (ctx) =>
		handleExport(ctx.request, runAtlasExport, (data) => ({
			id: data.id,
			path: data.path,
			url: data.url,
			atlasId: data.atlasId,
			region: data.region,
			bytesWritten: data.bytesWritten,
		})),
	);

	router.map(routes.exportTrainer.action, (ctx) =>
		handleExport(ctx.request, runTrainerExport, (data) => ({
			path: data.path,
			bytesWritten: data.bytesWritten,
		})),
	);

	router.map(routes.exportMap.action, (ctx) =>
		handleExport(ctx.request, runMapExport, (data) => ({
			id: data.id,
			path: data.path,
			url: data.url,
			bytesWritten: data.bytesWritten,
		})),
	);

	router.map(routes.exportSpecies.action, (ctx) =>
		handleExport(ctx.request, runSpeciesExport, (data) => ({
			id: data.id,
			path: data.path,
			bytesWritten: data.bytesWritten,
		})),
	);

	router.map(routes.exportImport.action, (ctx) =>
		handleExport(ctx.request, runImporterExport, (data) => ({
			id: data.id,
			path: data.path,
			url: data.url,
			atlasId: data.atlasId,
			regions: data.regions,
			bytesWritten: data.bytesWritten,
		})),
	);

	return router;
}

/**
 * Boots the dev-tools server: enforces the development gate, builds the client
 * bundle, wires the router, and starts `Bun.serve`. The port comes from `PORT`
 * or {@link DEFAULT_PORT}.
 *
 * @returns The running `Bun.serve` instance.
 */
async function main() {
	if (process.env.APP_ENV !== "development") {
		throw new Error("Dev tools refuse to start: set APP_ENV=development (use `bun run dev`).");
	}

	let clientBundle = await buildClientBundle();
	let router = createDevRouter(clientBundle);
	let port = Number(process.env.PORT ?? DEFAULT_PORT);

	let server = Bun.serve({
		port,
		fetch(request) {
			return router.fetch(request);
		},
	});

	console.info(`Dev tools running at ${server.url.href}`);
	return server;
}

await main();
