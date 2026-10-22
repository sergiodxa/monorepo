/**
 * The `mutation` check: surviving mutants in a mutation-testing report stay at or under
 * `doctor.mutation.maxSurvived`. Without the report file the check skips — the same honesty
 * rule as `crap` and coverage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import type { Check, CheckResult } from "./check.js";

import { passed, skipped } from "./check.js";

/**
 * Warns when the configured mutation report lists more survivors than allowed. Understands a
 * Stryker-like `{ files: { …: { mutants: [{ status }] } } }` shape and a flat
 * `{ survivors: [...] }` / `{ survived: number }` summary.
 */
export const mutationCheck: Check = {
	name: "mutation",
	async run(context): Promise<CheckResult> {
		let { report: relative, maxSurvived } = context.config.doctor.mutation;
		let absolute = join(context.root, relative);
		let text = await wrap(() => readFile(absolute, "utf8"));
		if (isFailure(text)) {
			return skipped(`No mutation report at ${relative}; run mutation tests then re-run doctor`);
		}
		let parsed = await wrap(() => Promise.resolve(JSON.parse(text.data) as unknown));
		if (isFailure(parsed)) {
			return {
				status: "warn",
				message: `Mutation report at ${relative} is not valid JSON`,
				findings: [parsed.error.message],
				fix: `Regenerate ${relative} from the mutation runner`,
			};
		}
		let survivors = survivingMutants(parsed.data);
		if (survivors.count <= maxSurvived) {
			return passed(
				survivors.count === 0
					? "No surviving mutants in the mutation report"
					: `${survivors.count} surviving mutant(s), within max ${maxSurvived}`,
			);
		}
		return {
			status: "warn",
			message: `${survivors.count} surviving mutant(s), above max ${maxSurvived}`,
			findings: survivors.findings.slice(0, 20),
			fix: `Kill the survivors with stronger tests, or raise doctor.mutation.maxSurvived in .config/sdxc.jsonc`,
		};
	},
};

/** Counts and names survivors from common mutation report shapes. */
export function survivingMutants(report: unknown): { count: number; findings: string[] } {
	if (report === null || typeof report !== "object") {
		return { count: 0, findings: [] };
	}
	let record = report as Record<string, unknown>;
	if (typeof record.survived === "number") {
		return { count: record.survived, findings: [`survived: ${record.survived}`] };
	}
	if (Array.isArray(record.survivors)) {
		let findings = record.survivors.map((item, index) => formatSurvivor(item, index));
		return { count: findings.length, findings };
	}
	if (record.files && typeof record.files === "object") {
		let findings: string[] = [];
		for (let [file, entry] of Object.entries(record.files as Record<string, unknown>)) {
			if (!entry || typeof entry !== "object") continue;
			let mutants = (entry as { mutants?: unknown }).mutants;
			if (!Array.isArray(mutants)) continue;
			for (let mutant of mutants) {
				if (!mutant || typeof mutant !== "object") continue;
				let fields = mutant as { status?: unknown; id?: unknown; mutatorName?: unknown };
				let status = typeof fields.status === "string" ? fields.status : "";
				if (status.toLowerCase() !== "survived") continue;
				let mutator = typeof fields.mutatorName === "string" ? fields.mutatorName : "mutant";
				let id =
					typeof fields.id === "string" || typeof fields.id === "number" ? String(fields.id) : null;
				findings.push(`${file}: ${mutator}${id !== null ? ` #${id}` : ""}`);
			}
		}
		return { count: findings.length, findings };
	}
	return { count: 0, findings: [] };
}

function formatSurvivor(item: unknown, index: number): string {
	if (typeof item === "string") return item;
	if (item && typeof item === "object") {
		let record = item as { file?: unknown; id?: unknown; mutatorName?: unknown };
		let file = typeof record.file === "string" ? record.file : `survivor[${index}]`;
		let mutator = typeof record.mutatorName === "string" ? record.mutatorName : "mutant";
		return `${file}: ${mutator}`;
	}
	return `survivor[${index}]`;
}
