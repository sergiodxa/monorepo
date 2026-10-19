/**
 * The `ui` check: every component `sdxc ui add` copied into the project is current with the
 * installed kit's registry. A copy is the project's own code, so a newer component reaches it
 * only through `sdxc ui update`; an edited copy is listed so the update's diff comes as no surprise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import { readLock, uiEntries } from "../lock.js";
import { listComponents, loadContext } from "../ui/commands.js";

import type { Check, CheckResult } from "./check.js";

import { skipped } from "./check.js";

/**
 * Warns on each copy a later release changed, with the update command for all of them; an
 * edited copy is a finding of its own and leaves the status as it is.
 */
export const uiCheck: Check = {
	name: "ui",
	async run(context): Promise<CheckResult> {
		let lock = await readLock(context.root, context.config);
		if (isFailure(lock)) return skipped(lock.error.message);
		if (uiEntries(lock.data).length === 0) return skipped("No @sdxc/ui component is copied");
		let ui = await loadContext(context, context.packageRoot);
		if (isFailure(ui)) return skipped(ui.error.message);
		let copies = (await listComponents(ui.data)).filter((row) => row.copy !== null);
		let behind = copies.filter((row) => row.copy?.behind === true);
		let edited = copies
			.filter((row) => row.copy?.edited === true)
			.map((row) => `${row.name} is edited; sdxc ui diff ${row.name} shows how`);
		if (behind.length === 0) {
			return {
				status: "pass",
				message: `${copies.length === 1 ? "The copied component is" : `${copies.length} copied components are`} current with release ${ui.data.registry.release}`,
				findings: edited,
				fix: null,
			};
		}
		return {
			status: "warn",
			message: `${behind.length === 1 ? "A copied component is" : `${behind.length} copied components are`} behind release ${ui.data.registry.release}`,
			findings: [
				...behind.map((row) => `${row.name} ${row.copy?.release} -> changed in ${row.changedIn}`),
				...edited,
			],
			fix: `sdxc ui update ${behind.map((row) => row.name).join(" ")}`,
		};
	},
};
