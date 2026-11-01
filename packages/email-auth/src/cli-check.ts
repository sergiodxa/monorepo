/**
 * The `sdxc-email-auth check` handler: audits a domain with `checkEmailAuth` and prints the
 * verdicts, one line per policy with its problems beneath, or the report as JSON for a script.
 * The exit code carries the outcome either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Style } from "@sdxc/cli";

import { createCommand, exit, success } from "@sdxc/cli";

import type { EmailAuthCheck } from "./check.js";

import { checkEmailAuth } from "./check.js";
import { EMAIL_AUTH_COMMANDS } from "./cli-contract.js";

/** How each policy is named in the human report. */
const POLICY_LABELS: { [Policy in EmailAuthCheck.Policy]: string } = {
	dmarc: "DMARC",
	spf: "SPF",
	"mta-sts": "MTA-STS",
	"tls-rpt": "TLS-RPT",
	bimi: "BIMI",
	dkim: "DKIM",
};

/** The mark and colour each verdict prints with, so the report reads without colour too. */
const VERDICT_MARKS: {
	[Verdict in EmailAuthCheck.Verdict]: [string, Exclude<keyof Style, "enabled">];
} = {
	pass: ["✓", "green"],
	warn: ["!", "yellow"],
	fail: ["✗", "red"],
	error: ["?", "magenta"],
};

/**
 * Audits the domain and reports it; DKIM is graded only for the selectors given, and a note on
 * stderr says so when none were.
 */
export default createCommand(EMAIL_AUTH_COMMANDS.check, async (ctx) => {
	let skip = ctx.flags.skip ?? [];
	let report = await checkEmailAuth(ctx.arguments.domain, {
		dkimSelectors: ctx.flags.selector ?? [],
		bimiSelector: ctx.flags.bimiSelector,
		skip,
		signal: ctx.signal,
	});

	if (!skip.includes("dkim") && (ctx.flags.selector ?? []).length === 0) {
		ctx.stderr(
			"DKIM not checked: pass --selector <name> for each selector the domain signs with\n",
		);
	}
	ctx.stdout(
		ctx.flags.json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report, ctx.style),
	);
	return report.ok ? success() : exit(1);
});

/** The report for a person: a heading, one line per result with problems indented, a tally. */
function formatReport(report: EmailAuthCheck.Report, style: Style): string {
	let lines = [style.bold(report.domain), ""];
	let width = Math.max(0, ...report.results.map((result) => labelOf(result).length));
	for (let result of report.results) {
		let [mark, colour] = VERDICT_MARKS[result.verdict];
		let label = labelOf(result).padEnd(width);
		lines.push(`${style[colour](mark)} ${label}  ${result.summary}  ${style.dim(result.name)}`);
		for (let problem of result.problems) lines.push(`    ${problem}`);
	}
	lines.push("", tally(report.results));
	return `${lines.join("\n")}\n`;
}

/** A result's label: the policy, followed by the selector for DKIM. */
function labelOf(result: EmailAuthCheck.Result): string {
	let label = POLICY_LABELS[result.policy];
	return result.policy === "dkim" && result.selector ? `${label} ${result.selector}` : label;
}

/** How many results landed on each verdict, worst first, omitting verdicts nobody got. */
function tally(results: readonly EmailAuthCheck.Result[]): string {
	if (results.length === 0) return "Nothing checked";
	let counts: [EmailAuthCheck.Verdict, string][] = [
		["fail", "failed"],
		["error", "unreadable"],
		["warn", "warned"],
		["pass", "passed"],
	];
	return counts
		.map(
			([verdict, word]) =>
				[results.filter((result) => result.verdict === verdict).length, word] as const,
		)
		.filter(([count]) => count > 0)
		.map(([count, word]) => `${count} ${word}`)
		.join(", ");
}
