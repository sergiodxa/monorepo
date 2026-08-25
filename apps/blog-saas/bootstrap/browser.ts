/**
 * Client-side entrypoint that boots the `remix/ui` runtime so server-rendered
 * pages hydrate in the browser. The module glob loads client modules from
 * `app/views` and `routes`, so the client bundle carries only browser-safe
 * view and route code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { run } from "remix/ui";

/**
 * Lazily-loadable client modules keyed by their source path relative to this
 * file. Each entry is an import thunk; nothing loads until {@link run}
 * resolves a hydration target through `loadModule`.
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
	 * target so the server renders the requested sub-frame for the submission
	 * that triggered the reload.
	 *
	 * @param src URL of the frame to resolve.
	 * @param options Frame target, abort signal, and submission for this load.
	 * @returns The response, whose body is rendered into the frame.
	 */
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		/**
		 * A form declaring the default encoding sends its body under that type,
		 * matching what the server reads. A file part carries no text, so it
		 * goes across as its filename, matching a urlencoded file input.
		 */
		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						Array.from(formData, ([key, value]) => [
							key,
							typeof value === "string" ? value : value.name,
						]),
					)
				: formData;

		/**
		 * The response carries the URL it was redirected to, which the frame
		 * reads to update its own source after a submission.
		 */
		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
