/**
 * The `audit` handler: fetches a page, grades its headers with `audit` and prints one line per
 * header, or the whole report under `--json`. A missing or weak header exits 1; a URL that is
 * not one, or a page that cannot be reached, exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";

import type { Audit } from "./audit.js";

import { audit } from "./audit.js";
import { SECURITY_HEADERS_COMMANDS } from "./cli-contract.js";

/** Width of the status column, wide enough for `missing` and a gap. */
const STATUS_WIDTH = 9;

/**
 * One header per line, its notes indented beneath it.
 *
 * @param findings - The audit's findings
 */
function lines(findings: Audit.Finding[]): string {
	return findings
		.map((finding) => {
			let head = `${finding.status.padEnd(STATUS_WIDTH)}${finding.header}\n`;
			let notes = finding.notes.map((note) => `${" ".repeat(STATUS_WIDTH)}${note}\n`);
			return head + notes.join("");
		})
		.join("");
}

/**
 * Counts the problems for the closing line, such as `2 missing, 1 weak`.
 *
 * @param findings - The audit's findings
 */
function tally(findings: Audit.Finding[]): string {
	let missing = findings.filter((finding) => finding.status === "missing").length;
	let weak = findings.filter((finding) => finding.status === "weak").length;
	return [missing > 0 ? `${missing} missing` : "", weak > 0 ? `${weak} weak` : ""]
		.filter(Boolean)
		.join(", ");
}

/** Prints the graded headers; `--json` prints `{ url, status, passed, findings }`. */
export default createCommand(SECURITY_HEADERS_COMMANDS.audit, async (ctx) => {
	if (!URL.canParse(ctx.arguments.url)) return exit(2, `Not a URL: ${ctx.arguments.url}`);

	let response: Response;
	try {
		response = await fetch(ctx.arguments.url, { redirect: "follow", signal: ctx.signal });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot fetch ${ctx.arguments.url}: ${reason}`);
	}

	let url = response.url || ctx.arguments.url;
	let findings = audit(response.headers, new URL(url));
	let passed = findings.every((finding) => finding.status === "ok");

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ url, status: response.status, passed, findings }, null, 2)}\n`);
	} else {
		ctx.stdout(`${url} (${response.status})\n${lines(findings)}`);
	}
	return passed ? success() : exit(1, ctx.flags.json ? undefined : tally(findings));
});
