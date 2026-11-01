/**
 * The `sdxc-well-known security-txt check` handler: reads a security.txt from an origin, a
 * file or stdin, applies the RFC 9116 reader and the expiry rule, and reports every problem
 * with its line. Exits 1 when the file is missing, malformed or expired.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { WellKnownParseError } from "./parse-error.js";
import type { ParsedSecurityTxt } from "./security-txt.js";

import { WELL_KNOWN_COMMANDS } from "./cli-contract.js";
import { fetchDocument, isWebUrl, readLocal, statusIssue } from "./cli-input.js";
import { isExpired, MEDIA_TYPE, NAME, parse } from "./security-txt.js";
import { wellKnownUrl } from "./well-known-url.js";

/**
 * Prints `<source>: valid, expires <date>` or one `<source>:<line>: message` per problem, a
 * line of `0` meaning the file as a whole; `--json` prints `{ source, valid, signed, expires,
 * issues }`, with `signed` and `expires` `null` when the file could not be read.
 */
export default createCommand(WELL_KNOWN_COMMANDS["security-txt"].check, async (ctx) => {
	let target = ctx.arguments.target;
	let retrieved = isWebUrl(target)
		? await fetchDocument(wellKnownUrl(new URL(target).origin, NAME), MEDIA_TYPE, ctx)
		: await readLocal(target, ctx);
	if (isFailure(retrieved)) return retrieved;

	let from = retrieved.data.from;
	let issues: WellKnownParseError.Issue[] = [];
	let document: ParsedSecurityTxt | null = null;
	let unavailable = statusIssue(retrieved.data);
	if (unavailable !== null) {
		issues.push(unavailable);
	} else {
		let parsed = parse(retrieved.data.text);
		if (isFailure(parsed)) {
			issues.push(...parsed.error.issues);
		} else {
			document = parsed.data;
			if (isExpired(document)) {
				issues.push({ at: 0, message: `Expires ${document.expires.toISOString()} has passed.` });
			}
		}
	}

	if (ctx.flags.json) {
		let report = {
			source: from,
			valid: issues.length === 0,
			signed: document?.signed ?? null,
			expires: document?.expires ?? null,
			issues,
		};
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else if (issues.length === 0 && document !== null) {
		let signed = document.signed ? ", signed" : "";
		ctx.stdout(`${from}: valid, expires ${document.expires.toISOString()}${signed}\n`);
	} else {
		for (let issue of issues) {
			ctx.stdout(
				issue.at === 0 ? `${from}: ${issue.message}\n` : `${from}:${issue.at}: ${issue.message}\n`,
			);
		}
	}
	return issues.length === 0 ? success() : exit(1);
});
