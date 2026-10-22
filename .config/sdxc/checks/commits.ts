/**
 * Enforces release-note commit bodies and capitalized summaries for this monorepo. The commit-msg
 * hook sets `SDXC_COMMIT_MSG_FILE`; CI sets `SDXC_COMMIT_RANGE`. Without either input the check
 * skips so a plain `sdxc doctor` run stays useful.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineCheck } from "@sdxc/kit/doctor";
import { isFailure } from "@sdxc/result";

import { runCheckCommits } from "../../../scripts/release/check-commits.js";

/** Env the commit-msg hook sets to the path of the message being written. */
const MESSAGE_FILE = "SDXC_COMMIT_MSG_FILE";

/** Env CI sets to a revision range such as `BASE..HEAD`. */
const RANGE = "SDXC_COMMIT_RANGE";

export default defineCheck({
	name: "commits",
	async run() {
		let messageFile = process.env[MESSAGE_FILE];
		let range = process.env[RANGE];
		if (messageFile === undefined && range === undefined) {
			return {
				status: "skip",
				message: `Set ${MESSAGE_FILE} or ${RANGE} to check commit messages`,
			};
		}
		let ran = await runCheckCommits({ messageFile, range });
		if (isFailure(ran)) {
			return {
				status: "fail",
				message: "Commit messages fail the release-note rules",
				findings: ran.error.message.split("\n"),
				fix: `Fix the named commits, or run with ${MESSAGE_FILE} / ${RANGE} set`,
			};
		}
		return {
			status: "pass",
			message: ran.data === "" ? "Commit message carries a release note" : ran.data,
		};
	},
});
