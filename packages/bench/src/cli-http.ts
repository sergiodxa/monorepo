/**
 * The `sdxc-bench http` handler: samples a URL and checks optional latency budgets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { HttpReport } from "./http.js";

import { parseBudgetFlag } from "./budget.js";
import { BENCH_COMMANDS } from "./cli-contract.js";
import { assertHttpBudgets, sampleHttp } from "./http.js";

/**
 * Prints a latency summary, or under `--json` the full report. Exits 1 when a
 * budget fails or every request errors; exits 2 when a duration flag is invalid.
 */
export default createCommand(BENCH_COMMANDS.http, async (ctx) => {
	let timeout = parseBudgetFlag(ctx.flags.timeout);
	if (isFailure(timeout)) return exit(2, timeout.error.message);

	let budgets: { p50?: number; p95?: number; p99?: number; mean?: number } = {};
	for (let field of ["p50", "p95", "p99", "mean"] as const) {
		let raw = ctx.flags[field];
		if (raw === undefined) continue;
		let parsed = parseBudgetFlag(raw);
		if (isFailure(parsed)) return exit(2, parsed.error.message);
		budgets[field] = parsed.data;
	}

	let requests = ctx.flags.requests;
	let concurrency = ctx.flags.concurrency;
	if (requests < 1) return exit(2, "--requests must be at least 1");
	if (concurrency < 1) return exit(2, "--concurrency must be at least 1");

	let report = await sampleHttp({
		url: ctx.arguments.url,
		method: ctx.flags.method,
		requests,
		concurrency,
		timeoutMs: timeout.data,
	});

	if (report.ok === 0) {
		if (ctx.flags.json) {
			ctx.stdout(`${JSON.stringify({ ok: false, report, error: "every request failed" })}\n`);
			return exit(1);
		}
		return exit(1, `every request to ${report.url} failed (${report.failures} failures)`);
	}

	let checked = assertHttpBudgets(report, budgets);
	if (isFailure(checked)) {
		if (ctx.flags.json) {
			ctx.stdout(`${JSON.stringify({ ok: false, report, error: checked.error.message })}\n`);
			return exit(1);
		}
		ctx.stdout(formatText(report));
		return exit(1, checked.error.message);
	}

	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify({ ok: true, report })}\n`);
	} else {
		ctx.stdout(formatText(report));
	}
	return success();
});

/** One human-readable summary for a report. */
function formatText(report: HttpReport): string {
	let lines = [
		`${report.method} ${report.url}`,
		`requests ${report.requests} concurrency ${report.concurrency} ok ${report.ok} failures ${report.failures}`,
		`min ${fmt(report.min)} mean ${fmt(report.mean)} p50 ${fmt(report.p50)} p95 ${fmt(report.p95)} p99 ${fmt(report.p99)} max ${fmt(report.max)}`,
	];
	return `${lines.join("\n")}\n`;
}

function fmt(ms: number | null): string {
	return ms === null ? "-" : `${ms.toFixed(1)}ms`;
}
