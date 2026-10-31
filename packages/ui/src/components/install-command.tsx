/**
 * The install line a docs page prints for its packages, spelled by each package manager
 * in a synced set of code tabs: a reader who picks Bun once sees Bun in every install
 * line, on this page and the next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import type { CodeTabsPersistence } from "../mixins/code-tabs-sync.js";

import { CodeBlock } from "./code-block.js";
import { CodeTabs } from "./code-tabs.js";

/** The managers on offer, in the order the strip reads; the first is the default choice. */
const PACKAGE_MANAGERS: readonly InstallCommand.Manager[] = ["npm", "pnpm", "yarn", "bun"];

/**
 * Prop types for {@link InstallCommand}.
 */
export namespace InstallCommand {
	/** A package manager the strip offers, which is also the value its sync key stores. */
	export type Manager = "npm" | "pnpm" | "yarn" | "bun";

	/** Props accepted by {@link InstallCommand}. */
	export interface Props extends Omit<TagProps<"form">, "children" | "aria-label" | "title"> {
		/** Package specifiers to install, such as `["@sdxc/ui", "remix@3.1.0"]`. */
		packages: readonly string[];
		/** Installs them as development dependencies. */
		dev?: boolean;
		/** Defaults to `package-manager`, so every install line on the site follows one choice. */
		syncKey?: string;
		/** Where the choice is remembered; see `CodeTabs`. Defaults to `local`. */
		persist?: CodeTabsPersistence;
		/** The manager to render selected, such as the one a cookie remembered. */
		selected?: string;
		/** The managers to offer, in order. Defaults to npm, pnpm, yarn and bun. */
		managers?: readonly Manager[];
		/** The header each block reads as, such as "Terminal". */
		title?: string;
		labels: CodeBlock.Labels;
		/** Names the strip for assistive technology, such as "Package manager". */
		"aria-label": string;
	}
}

/**
 * Renders one terminal block per manager inside a synced {@link CodeTabs}.
 *
 * @param handle Runtime handle carrying the command's props.
 * @returns The render function producing the tabs.
 * @example
 * <InstallCommand packages={["@sdxc/ui"]} title={t("terminal")} aria-label={t("packageManager")} labels={{ copy: t("copy"), copied: t("copied") }} />
 */
export function InstallCommand(handle: Handle<InstallCommand.Props>) {
	return () => {
		let {
			dev = false,
			labels,
			managers = PACKAGE_MANAGERS,
			packages,
			syncKey = "package-manager",
			title,
			...rest
		} = handle.props;

		return (
			<CodeTabs
				{...rest}
				syncKey={syncKey}
				tabs={managers.map((manager) => ({
					label: manager,
					value: manager,
					children: (
						<CodeBlock
							title={title}
							language="sh"
							code={installLine(manager, packages, dev)}
							labels={labels}
						/>
					),
				}))}
			/>
		);
	};
}

/**
 * The install line `manager` spells: npm installs, every other manager adds, and all
 * four take `-D` for a development dependency.
 *
 * @example installLine("bun", ["@sdxc/ui"], true) // "bun add -D @sdxc/ui"
 */
export function installLine(
	manager: InstallCommand.Manager,
	packages: readonly string[],
	dev: boolean,
): string {
	let verb = manager === "npm" ? "install" : "add";
	return [manager, verb, ...(dev ? ["-D"] : []), ...packages].join(" ");
}
