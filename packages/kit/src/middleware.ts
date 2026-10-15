/**
 * What `sdxc` commands share, published onto the context by middleware: the project they work
 * in, with its loaded configuration, and the `@sdxc/kit` package their templates, stubs, registry and
 * changelog come from, which a test replaces with a fixture package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandMiddleware } from "@sdxc/cli";

import { isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { Config } from "./config.js";

import { loadConfig } from "./config.js";
import { defaultPackageRoot } from "./create/templates.js";
import { findProjectRoot } from "./project.js";

/** The project a command works in. */
export interface Project {
	/** The nearest directory at or above the working directory holding a `package.json`. */
	root: string;
	/** The project's configuration, with every default filled in. */
	config: Config;
}

/** The project `project()` found, read as `ctx.project`. */
export const CurrentProject: { defaultValue?: Project } = createContextKey<Project>();

/** The directory of the `@sdxc/kit` package a command reads from, read as `ctx.packageRoot`. */
export const PackageRoot: { defaultValue?: string } = createContextKey<string>();

/**
 * Finds the project root and loads its configuration before the command runs. No project, or a
 * configuration that does not parse, ends the run with that message and exit code 1.
 */
export function project(): CommandMiddleware<{
	key: typeof CurrentProject;
	value: Project;
	property: "project";
}> {
	return async (ctx, next) => {
		let root = await findProjectRoot(ctx.cwd);
		if (isFailure(root)) return root;
		let loaded = await loadConfig(root.data);
		if (isFailure(loaded)) return loaded;
		ctx.set(
			CurrentProject,
			{ root: root.data, config: loaded.data.config },
			{ property: "project" },
		);
		await next();
	};
}

/**
 * Publishes the `@sdxc/kit` package directory. `packageRoot(directory)` installs that one;
 * `packageRoot()` keeps the one an earlier middleware installed, or installs the package this
 * module runs from, so a command lists it in its own chain and a test's CLI overrides it.
 */
export function packageRoot(directory?: string): CommandMiddleware<{
	key: typeof PackageRoot;
	value: string;
	property: "packageRoot";
}> {
	return async (ctx, next) => {
		if (directory !== undefined) {
			ctx.set(PackageRoot, directory, { property: "packageRoot" });
		} else if (!ctx.has(PackageRoot)) {
			ctx.set(PackageRoot, defaultPackageRoot(), { property: "packageRoot" });
		}
		await next();
	};
}
