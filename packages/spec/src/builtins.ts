/**
 * The built-in capability set, and how a host chooses part of it.
 *
 * Kept apart from the runner because importing a plugin is not free: `cli` and
 * `browser` spawn processes and `db` imports Bun's SQL client, so a module that
 * imports all eight can only be loaded by a Bun or Node process. A host that
 * cannot load them — or should not offer them — assembles its own list of
 * factories instead and hands it to `runTests`, which is why the runner takes a
 * plugin set rather than reaching for this module itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Plugin } from "./plugin";

import { createBrowserPlugin } from "./plugins/browser";
import { createCliPlugin } from "./plugins/cli";
import { createDbPlugin } from "./plugins/db";
import { createEnvPlugin } from "./plugins/env";
import { createFsPlugin } from "./plugins/fs";
import { createHttpPlugin } from "./plugins/http";
import { createJwtPlugin } from "./plugins/jwt";
import { createUrlPlugin } from "./plugins/url";

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
};

/**
 * Build the built-in plugins, all of them or a chosen few.
 *
 * Choosing a subset is not a permission decision. A namespace left out is not
 * denied — it does not exist, so a spec naming it fails to resolve rather than
 * being told which flag would allow it. That is the right shape for a capability
 * a host will never offer under any grant: a denial implies a flag that would
 * lift it, and there is none.
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
