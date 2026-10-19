/**
 * The prompt `sdxc upgrade` hands an AI agent: the release notes of the packages the project
 * imports, for every release it moved across, breaking changes first, with the components to
 * refresh, the commands that verify the edit, and where each package is documented.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";
import { compare } from "@sdxc/semver";

import { loadConfig } from "../config.js";
import { readLock, uiEntries } from "../lock.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { scopedPackageOf } from "../releases.js";

import type { AgentsStatus } from "./agents.js";
import type { ChangelogEntry } from "./changelog.js";

import { AGENTS_FILE, AGENTS_TEMPLATE } from "./agents.js";
import { entriesBetween, fullHistoryStart, readChangelog } from "./changelog.js";
import { projectImports, readManifest } from "./project.js";
import { PACKAGE_FILES, RELEASE_PACKAGE } from "./registry.js";

/** Where each release's GitHub Release lives, `<RELEASES>/tag/v<version>`. */
const RELEASES = "https://github.com/sergiodxa/monorepo/releases";

/** Each package's reference page, as Markdown an agent reads directly. */
const DOCUMENTATION = "https://sdxc.dev/api";

/** Remix's release notes, `<REMIX_RELEASES>/tag/remix@<version>`. */
const REMIX_RELEASES = "https://github.com/remix-run/remix/releases";

/** The `package.json` scripts that verify a project, in the order the prompt lists them. */
const VERIFY_SCRIPTS = ["check", "typecheck", "test"];

/** Commit types whose notes describe a change to what a consumer receives, besides `feat`. */
const FIX_TYPES = new Set(["fix", "perf", "revert"]);

/** A vendored component whose source changed after the release it was copied from. */
export interface ChangedComponent {
	name: string;
	/** The release the lock file records for the copy. */
	release: string;
	/** The latest release whose commits touched the component. */
	changedIn: string;
}

/** Everything the prompt says, already gathered from the project and the installed release. */
export interface PromptInput {
	from: string;
	/**
	 * The release each package lagging behind `from` is pinned to, by name; its notes start
	 * there instead of at `from`.
	 */
	since?: ReadonlyMap<string, string>;
	to: string;
	/** The whole changelog of the target release. */
	entries: readonly ChangelogEntry[];
	/** The npm names of the `@sdxc/*` packages the project imports. */
	packages: readonly string[];
	remix: { from: string; to: string } | null;
	components: readonly ChangedComponent[];
	/** Each verification command, ready to run. */
	verify: readonly string[];
	/** Where the project's `AGENTS.md` stands; a file left as it is gets a note in the prompt. */
	agents?: AgentsStatus;
}

/**
 * The prompt for moving from `input.from` to `input.to`, as Markdown. Only the imported
 * packages' entries appear; notes typed docs, test, refactor, chore, style, ci or build state
 * that a consumer has nothing to do, so they are left to the GitHub Releases.
 */
export function renderPrompt(input: PromptInput): string {
	let imported = new Set(input.packages);
	let since = input.since ?? new Map<string, string>();
	let from = earliestStart(input);
	let relevant = entriesBetween(input.entries, from, input.to)
		.filter(
			(entry) =>
				imported.has(entry.package) &&
				compare(entry.release, since.get(entry.package) ?? input.from) > 0,
		)
		.sort((a, b) => compare(a.release, b.release) || compareText(a.package, b.package));
	let breaking = relevant.filter((entry) => entry.breaking);
	let features = relevant.filter((entry) => !entry.breaking && entry.type === "feat");
	let fixes = relevant.filter((entry) => !entry.breaking && FIX_TYPES.has(entry.type));
	let sections = [
		[
			from === input.to
				? `# Align the project with @sdxc release ${input.to}`
				: `# Upgrade the @sdxc packages from ${from} to ${input.to}`,
			`This project now depends on the @sdxc packages of release ${input.to}, installed. Update its code for the changes below, which are the release notes of the packages it imports for every release after ${from}. Apply each breaking change's migration wherever the code uses what it changed, adopt the features and fixes where they apply, then run the verification commands and fix what they report.`,
			`Packages this project imports: ${[...input.packages].sort(compareText).map(code).join(", ")}.`,
		].join("\n\n"),
	];
	if (input.remix !== null) {
		sections.push(
			[
				"## Remix",
				`\`remix\` moved from ${input.remix.from} to ${input.remix.to}, the version release ${input.to} requires. Read its release notes for changes the code needs: ${REMIX_RELEASES}/tag/remix%40${input.remix.to}`,
			].join("\n\n"),
		);
	}
	if (relevant.length === 0) {
		sections.push("No release in between changed a package this project imports.");
	}
	if (breaking.length > 0) sections.push(entrySection("Breaking changes", breaking));
	if (features.length > 0) sections.push(entrySection("Features", features));
	if (fixes.length > 0) sections.push(entrySection("Fixes", fixes));
	let older = olderReleases(input);
	if (older !== null) sections.push(older);
	if (input.components.length > 0) {
		sections.push(
			[
				"## Vendored components",
				"These copied components changed after the release they were copied from. Review each change with `sdxc ui diff`, and take it with `sdxc ui update` (an edited copy is left alone unless `--force`):",
				input.components
					.map(
						(component) =>
							`- \`${component.name}\`, copied from ${component.release}, changed in ${component.changedIn}: \`sdxc ui diff ${component.name}\`, then \`sdxc ui update ${component.name}\``,
					)
					.join("\n"),
			].join("\n\n"),
		);
	}
	let agents = agentsNote(input);
	if (agents !== null) sections.push(agents);
	if (input.verify.length > 0) {
		sections.push(
			[
				"## Verify",
				"Run these after editing and fix what they report:",
				input.verify.map((command) => `- \`${command}\``).join("\n"),
			].join("\n\n"),
		);
	}
	sections.push(
		[
			"## Documentation",
			[...input.packages]
				.sort(compareText)
				.map((name) => `- ${code(name)}: ${DOCUMENTATION}/${documentationSlug(name)}.md`)
				.join("\n"),
		].join("\n\n"),
	);
	return `${sections.join("\n\n")}\n`;
}

/**
 * Gathers the prompt for the project at `root` from the `@sdxc/kit` at `packageRoot`, which is
 * the target release: its version, its changelog, its component registry and its
 * `remix` peer, compared with `remixFrom` when the bump changed `remix`.
 */
export async function buildPrompt(options: {
	root: string;
	packageRoot: string;
	from: string;
	/** The release each lagging package is pinned to, by name. */
	since?: ReadonlyMap<string, string>;
	remixFrom: string | null;
	agents?: AgentsStatus;
}): Promise<Result<string, Error>> {
	let own = await readOwnManifest(options.packageRoot);
	if (isFailure(own)) return own;
	let to = own.data.version;
	if (compare(options.from, to) > 0) {
		return failure(new Error(`--from ${options.from} is newer than this @sdxc/kit, ${to}`));
	}
	let entries = await readChangelog(options.packageRoot);
	if (isFailure(entries)) return entries;
	let project = await readManifest(options.root);
	if (isFailure(project)) return project;
	let manager = await packageManager({
		declared: project.data.manifest.packageManager,
		findLockFile: lockFileAtOrAbove(options.root),
	});
	let scripts = project.data.manifest.scripts ?? {};
	let imports = await projectImports(options.root);
	let packages = new Set<string>();
	for (let specifier of imports.keys()) {
		let name = scopedPackageOf(specifier);
		if (name !== null) packages.add(name);
	}
	let components = await changedComponents(options.root, options.packageRoot);
	if (isFailure(components)) return components;
	let remixTo = own.data.remix;
	let remix =
		options.remixFrom !== null && remixTo !== null && options.remixFrom !== remixTo
			? { from: options.remixFrom, to: remixTo }
			: null;
	return success(
		renderPrompt({
			from: options.from,
			...(options.since === undefined ? {} : { since: options.since }),
			to,
			entries: entries.data,
			packages: [...packages],
			remix,
			components: components.data,
			...(options.agents === undefined ? {} : { agents: options.agents }),
			verify: VERIFY_SCRIPTS.filter((name) => scripts[name] !== undefined).map((name) =>
				[...manager.run, name].join(" "),
			),
		}),
	);
}

/** The version and `remix` peer of the running kit, which are its release's. */
async function readOwnManifest(
	packageRoot: string,
): Promise<Result<{ version: string; remix: string | null }, Error>> {
	let text = await wrap(() => readFile(join(packageRoot, "package.json"), "utf8"));
	if (isFailure(text)) return text;
	let parsed = wrap(
		() =>
			JSON.parse(text.data) as { version?: unknown; peerDependencies?: Record<string, unknown> },
	);
	if (isFailure(parsed) || typeof parsed.data.version !== "string") {
		return failure(new Error(`${packageRoot}/package.json has no version`));
	}
	let remix = parsed.data.peerDependencies?.remix;
	return success({ version: parsed.data.version, remix: typeof remix === "string" ? remix : null });
}

/**
 * The components the project's lock file records whose registry entry in the installed
 * release names a later `changedIn` than the release the copy came from. Without a lock file
 * there are none; a component the registry no longer has is left out, and an invalid lock fails.
 */
async function changedComponents(
	root: string,
	packageRoot: string,
): Promise<Result<ChangedComponent[], Error>> {
	let config = await loadConfig(root);
	if (isFailure(config)) return config;
	let lock = await readLock(root, config.data.config);
	if (isFailure(lock)) return lock;
	let changed: ChangedComponent[] = [];
	for (let entry of uiEntries(lock.data)) {
		let changedIn = await registryChangedIn(packageRoot, entry.name);
		if (changedIn !== null && compare(changedIn, entry.release) > 0) {
			changed.push({ name: entry.name, release: entry.release, changedIn });
		}
	}
	return success(changed);
}

/** The `changedIn` of a component's registry entry, or `null` when the entry is missing or unreadable. */
async function registryChangedIn(packageRoot: string, name: string): Promise<string | null> {
	let text = await wrap(() =>
		readFile(join(packageRoot, "registry", "ui", `${name}.json`), "utf8"),
	);
	if (!isSuccess(text)) return null;
	let parsed = wrap(() => JSON.parse(text.data) as { changedIn?: unknown });
	if (!isSuccess(parsed)) return null;
	return typeof parsed.data.changedIn === "string" ? parsed.data.changedIn : null;
}

/**
 * The note on releases older than the changelog's full window, which kept only their breaking
 * entries, with a link to each one's GitHub Release; `null` when the move starts inside it.
 */
function olderReleases(input: PromptInput): string | null {
	let start = fullHistoryStart(input.to);
	let from = earliestStart(input);
	if (compare(from, start) >= 0) return null;
	let releases = [
		...new Set(
			entriesBetween(input.entries, from, input.to)
				.map((entry) => entry.release)
				.filter((release) => compare(release, start) < 0),
		),
	].sort(compare);
	return [
		"## Older releases",
		`Releases after ${from} and before ${start} are summarized by their breaking changes only. Their full notes are on GitHub: ${RELEASES}`,
		...(releases.length > 0
			? [releases.map((release) => `- ${release}: ${RELEASES}/tag/v${release}`).join("\n")]
			: []),
	].join("\n\n");
}

/**
 * The note on an `AGENTS.md` the upgrade left as it is, pointing at the release's sdxc section;
 * `null` when the file holds the section or the status is unknown. The agent decides whether
 * the project follows the app layout the section describes.
 */
function agentsNote(input: PromptInput): string | null {
	if (input.agents === undefined || input.agents === "refreshed" || input.agents === "current") {
		return null;
	}
	let url = `${PACKAGE_FILES}/${RELEASE_PACKAGE}@${input.to}/${AGENTS_TEMPLATE}`;
	let markers = "`<!-- sdxc:start …-->` and `<!-- sdxc:end -->`";
	let state =
		input.agents === "missing"
			? `This project has no \`${AGENTS_FILE}\`.`
			: input.agents === "unmarked"
				? `\`${AGENTS_FILE}\` has no sdxc section, so the upgrade left it as it is.`
				: `\`${AGENTS_FILE}\` needs exactly one ${markers} line pair, so the upgrade left it as it is.`;
	let action =
		input.agents === "unbalanced"
			? `Restore one pair around the sdxc section, which for release ${input.to} is in ${url}.`
			: `When this project is an app in the sdxc layout (it has \`bootstrap/worker.ts\`), add the section from ${url}, ${markers} lines included, to \`${AGENTS_FILE}\`, creating the file if needed; \`sdxc upgrade\` then keeps it current.`;
	return ["## Agent instructions", `${state} ${action}`].join("\n\n");
}

/** The oldest release the prompt covers: `from`, or an older pin of a lagging package. */
function earliestStart(input: PromptInput): string {
	let earliest = input.from;
	for (let pinned of input.since?.values() ?? []) {
		if (compare(pinned, earliest) < 0) earliest = pinned;
	}
	return earliest;
}

/** A heading and each entry under its own sub-heading with its full body. */
function entrySection(heading: string, entries: ChangelogEntry[]): string {
	let blocks = entries.map((entry) => {
		let lines = [`### ${entry.package}: ${entry.title}`, `Released in ${entry.release}.`];
		if (entry.body.trim() !== "") lines.push(entry.body.trim());
		return lines.join("\n\n");
	});
	return [`## ${heading}`, ...blocks].join("\n\n");
}

/** The reference page slug: a scoped package by its bare name. */
function documentationSlug(name: string): string {
	return name.startsWith("@sdxc/") ? name.slice("@sdxc/".length) : name;
}

function code(text: string): string {
	return `\`${text}\``;
}

function compareText(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}
