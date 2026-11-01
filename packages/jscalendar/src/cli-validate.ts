/**
 * The `sdxc-jscalendar validate` handler: checks a JSCalendar Event, Task or Group against
 * RFC 8984 and lists every problem at its property path. Exits 1 when it finds any, so a CI
 * step or an agent can gate on a document before it ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSCALENDAR_COMMANDS } from "./cli-contract.js";
import { readInput } from "./cli-input.js";

import type { Issue } from "./index.js";

import { parse } from "./index.js";

/** The exit code for a document that was read and found invalid. */
const PROBLEMS_FOUND = 1;

/**
 * Reports the document as valid, naming its `@type` and `uid`, or lists each problem as
 * `path: message` (`(root)` for the document itself); `--json` prints `{ valid, type, uid,
 * issues }` with `type` and `uid` null when invalid. Text that is not JSON is one root issue.
 */
export default createCommand(JSCALENDAR_COMMANDS.validate, async (ctx) => {
	let text = await readInput(ctx, ctx.arguments.file);
	if (isFailure(text)) return text;
	let parsed = parse(text.data);

	if (isFailure(parsed)) {
		let { issues, message } = parsed.error;
		let found: Issue[] = issues.length > 0 ? issues : [{ path: [], message }];
		if (ctx.flags.json) {
			let report = { valid: false, type: null, uid: null, issues: found };
			ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		} else {
			for (let issue of found) {
				let where = issue.path.length > 0 ? issue.path.join(".") : "(root)";
				ctx.stdout(`${where}: ${issue.message}\n`);
			}
		}
		return exit(PROBLEMS_FOUND);
	}

	let { uid } = parsed.data;
	let type = parsed.data["@type"];
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ valid: true, type, uid, issues: [] }, null, 2)}\n`);
	} else {
		ctx.stdout(`Valid ${type} ${uid}\n`);
	}
	return success();
});
