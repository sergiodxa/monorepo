/**
 * The built-in capability set, and how a host chooses part of it.
 *
 * Kept apart from the runner because importing a plugin is not free: `cli` and
 * `browser` spawn processes and `db` imports Bun's SQL client. `runTests` takes
 * a plugin set so a host can assemble the factories it is able to load.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Plugin } from "./plugin.js";

import { createBrowserPlugin } from "./plugins/browser.js";
import { createCliPlugin } from "./plugins/cli.js";
import { createDbPlugin } from "./plugins/db.js";
import { createEnvPlugin } from "./plugins/env.js";
import { createFsPlugin } from "./plugins/fs.js";
import { createHttpPlugin } from "./plugins/http.js";
import { createJwtPlugin } from "./plugins/jwt.js";
import { createSamplePlugin } from "./plugins/sample.js";
import { createUrlPlugin } from "./plugins/url.js";

/**
 * Every built-in namespace, in the order a run registers them.
 *
 * The order is what a selection is sorted back into, so two hosts asking for the
 * same namespaces get the same list regardless of how they wrote it down.
 */
export const BUILTIN_NAMESPACES = [
	"fs",
	"cli",
	"http",
	"browser",
	"db",
	"url",
	"jwt",
	"env",
	"sample",
] as const;

/** A built-in namespace's name. */
export type BuiltinNamespace = (typeof BUILTIN_NAMESPACES)[number];

/** How each built-in namespace is constructed. */
const BUILTIN_FACTORIES: Record<BuiltinNamespace, () => Plugin> = {
	fs: createFsPlugin,
	cli: createCliPlugin,
	http: createHttpPlugin,
	browser: createBrowserPlugin,
	db: createDbPlugin,
	url: createUrlPlugin,
	jwt: createJwtPlugin,
	env: createEnvPlugin,
	sample: createSamplePlugin,
};

/**
 * Build the built-in plugins, all of them or a chosen few. Choosing a subset
 * is not a permission decision: a namespace left out simply does not exist,
 * so a spec naming it fails to resolve, on the same footing as a capability.
 *
 * @param only - Namespaces to build; omit for every built-in. Duplicates collapse.
 * @returns The plugins, in {@link BUILTIN_NAMESPACES} order.
 */
export function createBuiltinPlugins(only?: readonly BuiltinNamespace[]): Plugin[] {
	let wanted = new Set<BuiltinNamespace>(only ?? BUILTIN_NAMESPACES);
	let plugins: Plugin[] = [];
	for (let namespace of BUILTIN_NAMESPACES) {
		if (!wanted.has(namespace)) continue;
		plugins.push(BUILTIN_FACTORIES[namespace]());
	}
	return plugins;
}
