/**
 * Router context values installed by globally-applied middleware.
 *
 * The platform and tenant routers' root middleware populate `formData` and `render`
 * through property transforms, augmenting `RequestContext` the same way `db`, `log`,
 * and session middleware augment it from their own modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RemixNode } from "remix/component";
import type {} from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** Parsed request body form data, present for every routed request. */
		formData: FormData;
		/**
		 * Renders a `remix/component` node as a complete HTML document response, mapping every
		 * island to the chunk the build emitted for it.
		 * @param node - The `remix/component` JSX tree to serialize.
		 * @param init - Optional response init (status, extra headers).
		 * @returns A `Response` with the serialized HTML and `text/html` content type.
		 */
		render(node: RemixNode, init?: ResponseInit): Promise<Response>;
	}
}

export {};
