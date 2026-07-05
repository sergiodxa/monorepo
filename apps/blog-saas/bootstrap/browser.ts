/**
 * Client-side entrypoint that boots the `remix/ui` runtime so server-rendered
 * pages hydrate in the browser. Mirrors `apps/r3-blog/bootstrap/browser.ts`,
 * with the module glob adjusted to blog-saas's layout: blog-saas has no
 * `resources` directory, so its client-safe view components live under
 * `app/views` (the analog of r3-blog's `resources`). The `app/http/controllers`
 * modules are intentionally excluded — they are server route handlers that pull
 * in worker-only imports (e.g. `cloudflare:workers`) and must never reach the
 * client bundle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { run } from "remix/ui";

/**
 * Lazily-loadable client modules keyed by their source path (relative to this
 * file). Each entry is an import thunk; nothing loads until {@link run} resolves
 * a hydration target through `loadModule`. Server-only modules (`*.server.*`)
 * are excluded so they never reach the client bundle.
 */
let clientModules = import.meta.glob([
	"!../**/*.server.*",
	"../app/views/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
]);

run({
	/**
	 * Resolves a hydration `moduleUrl` to its exported client entry component.
	 *
	 * @param moduleUrl URL of the source module emitted in the hydration payload.
	 * @param exportName Named export within the module to hydrate.
	 * @returns The resolved entry component function.
	 */
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;

		let load = clientModules[`..${pathname}`];
		if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);

		let mod = await load();

		if (!mod || typeof mod !== "object") {
			throw new Error(`Invalid client entry module: ${moduleUrl}`);
		}

		let entry = Reflect.get(mod, exportName);

		if (typeof entry !== "function") {
			throw new Error(`Missing client entry export ${exportName} in ${moduleUrl}`);
		}

		return entry;
	},

	/**
	 * Fetches frame content for the `remix/ui` runtime, forwarding the frame
	 * target so the server can render the requested sub-frame.
	 *
	 * @param src URL of the frame to resolve.
	 * @param signal Abort signal cancelling the in-flight request.
	 * @param target Optional frame target sent via the `x-remix-target` header.
	 * @returns The response body stream, falling back to its text.
	 */
	async resolveFrame(src, signal, target) {
		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let response = await fetch(src, { credentials: "same-origin", headers, signal });
		return response.body ?? response.text();
	},
});
