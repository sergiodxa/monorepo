/**
 * Refreshes `src/disposable-domains.ts` from the disposable-email-domains blocklist:
 * downloads the list, keeps its lowercase ASCII domains sorted and unique, and writes the
 * data module with the source URL, license, date and upstream commit in its header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

/** The upstream repository, as `owner/name`, on GitHub. */
const REPOSITORY = "disposable-email-domains/disposable-email-domains";

/** The blocklist file on `main`, one domain per line; the header cites this stable URL. */
const LIST_URL = `https://raw.githubusercontent.com/${REPOSITORY}/main/disposable_email_blocklist.conf`;

/** The latest commit on `main`; the list is read at that commit so the header names exactly what was taken. */
const COMMIT_URL = `https://api.github.com/repos/${REPOSITORY}/commits/main`;

/** A domain the lookup can match: lowercase LDH labels, at least two of them. */
const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** The data module this script owns; everything in it is regenerated on each run. */
const OUTPUT = path.join(import.meta.dirname, "../src/disposable-domains.ts");

/**
 * Downloads the list and rewrites the data module. A failed download leaves the module
 * as it was and exits non-zero; a missing commit id only degrades the header to `unknown`.
 */
async function main() {
	let commitResponse = await fetch(COMMIT_URL, {
		headers: { accept: "application/vnd.github+json" },
	});
	let commit = commitResponse.ok
		? (((await commitResponse.json()) as { sha?: string }).sha ?? "unknown")
		: "unknown";

	let url = commit === "unknown" ? LIST_URL : LIST_URL.replace("/main/", `/${commit}/`);
	let listResponse = await fetch(url);
	if (!listResponse.ok) {
		process.stderr.write(`Could not download ${url}: HTTP ${listResponse.status}\n`);
		process.exitCode = 1;
		return;
	}

	let lines = (await listResponse.text()).split("\n").map((line) => line.trim().toLowerCase());
	let domains = [...new Set(lines.filter((line) => DOMAIN_PATTERN.test(line)))].sort();
	let skipped = lines.filter((line) => line !== "" && !DOMAIN_PATTERN.test(line));
	let today = new Date().toISOString().slice(0, 10);

	let source = `/**
 * The disposable-email-domains blocklist (CC0-1.0), taken on ${today} at commit ${commit} from
 * ${LIST_URL}
 * Refresh: run \`bun run update-disposable-domains\` in packages/email-address; it rewrites this file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Newline-separated, lowercase, sorted; decoded into a set on first lookup. */
export const DISPOSABLE_DOMAINS: string = \`
${domains.join("\n")}
\`;
`;

	await writeFile(OUTPUT, source);

	let bytes = Buffer.byteLength(source);
	process.stdout.write(`Wrote ${domains.length} domains (${bytes} bytes) to ${OUTPUT}\n`);
	if (skipped.length > 0) {
		process.stdout.write(
			`Skipped ${skipped.length} lines that are not domains: ${skipped.join(", ")}\n`,
		);
	}
}

await main();
