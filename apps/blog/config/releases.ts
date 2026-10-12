/**
 * The repositories whose GitHub releases the weekly releases post summarizes, and how each
 * one names the packages it ships. A repository missing here never reaches the post, so
 * adding a library to the summary is one entry in `RELEASE_SOURCES`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A repository publishing many packages per release, each under its own `## <scope>/<name>`
 * heading of the release body; a heading outside `scope` is ignored.
 */
export interface MonorepoReleaseSource {
	kind: "monorepo";
	/** The `owner/name` GitHub knows the repository by. */
	repository: string;
	/** The npm scope every package of the repository is published under, with its `@`. */
	scope: string;
}

/** A repository whose every release is a release of one package. */
export interface PackageReleaseSource {
	kind: "package";
	/** The `owner/name` GitHub knows the repository by. */
	repository: string;
	/** The package's name on npm, which the post shows and links to. */
	name: string;
	/** Where the post links the package: its npm page, or the repository for one npm lacks. */
	registry: "npm" | "github";
}

/** One repository the weekly releases post reads. */
export type ReleaseSource = MonorepoReleaseSource | PackageReleaseSource;

/** Every repository the weekly releases post reads, in the order they are asked for. */
export const RELEASE_SOURCES: ReleaseSource[] = [
	{ kind: "monorepo", repository: "sergiodxa/monorepo", scope: "@sdxc" },
	{ kind: "package", repository: "sergiodxa/remix-utils", name: "remix-utils", registry: "npm" },
	{
		kind: "package",
		repository: "sergiodxa/remix-i18next",
		name: "remix-i18next",
		registry: "npm",
	},
	{ kind: "package", repository: "sergiodxa/remix-auth", name: "remix-auth", registry: "npm" },
];
