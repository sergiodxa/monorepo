/**
 * Release bodies and API entries shaped like the ones GitHub lists for the weekly releases
 * post's sources, excerpted from real releases, so the package extraction is tested against
 * the formats the release workflows actually write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * An excerpt of a daily monorepo release: packages with changes of their own, packages
 * republished only for a dependency, and the compare footer after the last section.
 */
export const MONOREPO_MIXED_BODY = [
	"## @sdxc/activitypub",
	"- chore: upgrade all dependencies, including vite-plus 0.3.3 and Vitest 4.1.11",
	"\tVitest 4.1.11 fixes the @vitest/mocker path traversal advisory (Dependabot alert 2).",
	"",
	"## @sdxc/api-client",
	"Republished because `@sdxc/trace-context` changed.",
	"",
	"## @sdxc/attribution",
	"Republished because `@sdxc/logger` changed.",
	"",
	"## @sdxc/cloudflare-mocks",
	"- fix: type the SQL cursor's next() as IteratorResult so it satisfies the latest workers-types",
	"",
	"## @sdxc/web-push",
	"Republished because `@sdxc/jwt` changed.",
	"",
	"## @sdxc/workers-cache",
	"Republished because `@sdxc/logger` changed.",
	"",
	"Compare: https://github.com/sergiodxa/monorepo/compare/v2026.10.11...v2026.10.12",
	"",
].join("\n");

/** A daily monorepo release changing one package, whose only section precedes the footer. */
export const MONOREPO_SINGLE_BODY = [
	"## @sdxc/spec",
	"- fix: find elements inside a display: contents wrapper in the browser",
	"\tA wrapper styled display: contents draws no box of its own.",
	"- feat: start long-lived programs with cli.start and run them in a chosen directory",
	"",
	"Compare: https://github.com/sergiodxa/monorepo/compare/v2026.10.2...v2026.10.3",
	"",
].join("\n");

/** The first monorepo release, whose sections each say only that the package is new. */
export const MONOREPO_FIRST_BODY = [
	"## @sdxc/crypto",
	"First release.",
	"",
	"## @sdxc/result",
	"First release.",
	"",
].join("\n");

/** A single-package release, written by GitHub's generated release notes. */
export const PACKAGE_BODY = [
	"<!-- Release notes generated using configuration in .github/release.yml at v10.0.0 -->",
	"",
	"## What's Changed",
	"### New Features",
	"* Use the configured secret when signing and verifying CSRF tokens by @sergiodxa in https://github.com/sergiodxa/remix-utils/pull/584",
].join("\n");

/** The fields of a release entry the reader validates, as GitHub's REST API names them. */
export interface ApiRelease {
	tag_name: string;
	html_url: string;
	draft: boolean;
	prerelease: boolean;
	published_at: string | null;
	body: string | null;
}

/**
 * A release entry as GitHub lists it, published and stable unless `overrides` says otherwise.
 *
 * @param repository The `owner/name` the release belongs to.
 * @param tag The release's tag.
 * @param publishedAt When it was published, as GitHub writes the timestamp.
 * @param overrides Fields to change, such as `draft` or `body`.
 */
export function apiRelease(
	repository: string,
	tag: string,
	publishedAt: string,
	overrides: Partial<ApiRelease> = {},
): ApiRelease {
	return {
		tag_name: tag,
		html_url: `https://github.com/${repository}/releases/tag/${tag}`,
		draft: false,
		prerelease: false,
		published_at: publishedAt,
		body: "",
		...overrides,
	};
}
