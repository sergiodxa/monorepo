/**
 * The `sdxc-openpgp inspect` handler: reads a public or private key and prints its
 * fingerprint, Key ID, algorithm, creation, expiry and status, its User IDs and subkeys,
 * with every self-signature checked. `--json` prints the same facts with ISO dates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { KeyDetails, KeyInspection } from "./inspect.js";

import { OPENPGP_COMMANDS } from "./cli-contract.js";
import { readAnyKey } from "./cli-input.js";
import { inspectKey } from "./inspect.js";

/**
 * A key as `--json` prints it: dates as ISO strings and a key that never expires as `null`,
 * so every member is present in every report.
 *
 * @param key - The key's details.
 */
function keyJSON(key: KeyDetails) {
	return {
		fingerprint: key.fingerprint,
		keyId: key.keyId,
		version: key.version,
		algorithm: key.algorithm,
		created: key.created.toISOString(),
		expires: key.expires?.toISOString() ?? null,
		revoked: key.revoked,
		canSign: key.canSign,
		bound: key.bound,
	};
}

/**
 * One word for whether a key can sign now: `revoked`, `expired`, `unbound`, `no signing`
 * when its flags forbid it, or `valid`.
 *
 * @param key - The key's details.
 */
function status(key: KeyDetails): string {
	if (key.revoked) return "revoked";
	if (key.expires && key.expires.getTime() < Date.now()) return "expired";
	if (!key.bound) return "unbound";
	return key.canSign ? "valid" : "no signing";
}

/**
 * A report for people: the primary key as aligned fields, then User IDs and subkeys.
 *
 * @param report - What `inspectKey` found.
 */
function format(report: KeyInspection): string {
	let { primary } = report;
	let lines = [
		`Fingerprint  ${primary.fingerprint}`,
		`Key ID       ${primary.keyId}`,
		`Version      ${primary.version}`,
		`Algorithm    ${primary.algorithm}`,
		`Created      ${primary.created.toISOString()}`,
		`Expires      ${primary.expires?.toISOString() ?? "never"}`,
		`Status       ${status(primary)}`,
	];
	if (report.secret)
		lines.push(`Secret       ${report.locked ? "yes, passphrase-protected" : "yes"}`);
	if (report.userIds.length > 0) {
		lines.push("", "User IDs");
		for (let user of report.userIds) {
			lines.push(`  ${user.userId}${user.certified ? "" : " (not certified)"}`);
		}
	}
	if (report.subkeys.length > 0) {
		lines.push("", "Subkeys");
		for (let subkey of report.subkeys) {
			lines.push(`  ${subkey.fingerprint}  ${subkey.algorithm}  ${status(subkey)}`);
		}
	}
	return `${lines.join("\n")}\n`;
}

export default createCommand(OPENPGP_COMMANDS.inspect, async (ctx) => {
	let key = await readAnyKey(ctx.arguments.key, ctx);
	if (isFailure(key)) return key;
	let report = await inspectKey(key.data);
	if (ctx.flags.json) {
		let json = {
			...keyJSON(report.primary),
			secret: report.secret,
			locked: report.locked,
			userIds: report.userIds,
			subkeys: report.subkeys.map(keyJSON),
		};
		ctx.stdout(`${JSON.stringify(json, null, 2)}\n`);
	} else {
		ctx.stdout(format(report));
	}
	return success();
});
