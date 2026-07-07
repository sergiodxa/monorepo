/**
 * Bun dev-tools server. It builds the client bundle with `Bun.build` at startup,
 * then serves requests through a `remix/fetch-router` router: a static HTML shell
 * for every tool page, the bundled client JS at `/client.js`, and a JSON export
 * action that writes authored content to disk. Development-only; refuses to start
 * unless `APP_ENV=development`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { createRouter } from "remix/fetch-router";

import { runExport } from "./export";
import { PathSafetyError } from "./path-safety";
import routes from "./routes";

/** Default port for the dev server; chosen to avoid clashing with the game. */
const DEFAULT_PORT = 4321;

/** Absolute path to the client entry that `Bun.build` bundles for the browser. */
const CLIENT_ENTRY = new URL("./client.tsx", import.meta.url).pathname;

/**
 * Static HTML shell served for every tool page. Contains the `#app` mount point
 * and loads the bundled client module, which renders the component tree CSR. No
 * server-side rendering happens here.
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
		let messages = result.logs.map((log) => String(log)).join("\n");
		throw new Error(`Client bundle build failed:\n${messages}`);
	}

	return await result.outputs[0]!.text();
}

/**
 * Builds the dev-tools router. Tool pages serve the HTML shell, `/client.js`
 * serves the pre-built bundle, and the export action validates and writes its
 * payload, mapping validation/path errors to 400/403 and success to 200.
 *
 * @param clientBundle The bundled client JS to serve at `/client.js`.
 * @returns A configured router whose `fetch` handles every dev-tools request.
 */
function createDevRouter(clientBundle: string) {
	let router = createRouter();

	/** Serves the static HTML shell for a tool page. */
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

	router.map(routes.client, () => {
		return new Response(clientBundle, {
			headers: { "content-type": "text/javascript; charset=utf-8" },
		});
	});

	router.map(routes.export.action, async (ctx) => {
		let payload: unknown;
		try {
			payload = await ctx.request.json();
		} catch {
			return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
		}

		let result = await runExport(payload);
		if (isFailure(result)) {
			// A path-safety rejection is a forbidden target (403); a malformed
			// payload is a bad request (400).
			let status = result.error instanceof PathSafetyError ? 403 : 400;
			return Response.json({ error: result.error.message }, { status });
		}

		return Response.json({ path: result.data.path, bytesWritten: result.data.bytesWritten });
	});

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
