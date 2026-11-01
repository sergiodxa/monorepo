/**
 * The `sdxc-robots check` handler: reads the origin's robots.txt, or the one `--robots` names,
 * and reports whether the agent may fetch the URL with the rule that decides it. A disallowed
 * URL is the finding the check exists for, so it exits 1; an unreadable file or bad URL exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { RobotsSource } from "./cli-source.js";

import { ROBOTS_COMMANDS } from "./cli-contract.js";
import { DEFAULT_FETCH_AGENT, describeFallback, isWebUrl, readRobots } from "./cli-source.js";
import { isAllowedBy } from "./fetch.js";

import type { Robots } from "./index.js";

import { isAllowed, matchingRule } from "./index.js";

/** The agent evaluated when `--agent` is absent: the wildcard group's. */
const WILDCARD_AGENT = "*";

/** What `check --json` prints; `httpStatus` is present for a retrieval that found no file. */
interface CheckReport {
	url: string;
	agent: string;
	allowed: boolean;
	rule: Robots.Rule | null;
	robots: string;
	status: "parsed" | "unavailable" | "unreachable";
	httpStatus?: number | null;
}

/**
 * The verdict for a URL under a source: a readable file is evaluated and names its deciding
 * rule, and an origin without one decides as `isAllowedBy` says, with no rule to name.
 */
function evaluate(source: RobotsSource, agent: string, url: string): CheckReport {
	let report = { url, agent, robots: source.from };
	if (source.kind === "file") {
		let allowed = isAllowed(source.document, agent, url);
		return {
			...report,
			allowed,
			rule: matchingRule(source.document, agent, url),
			status: "parsed",
		};
	}

	let { outcome } = source;
	if (outcome.status === "parsed") {
		let allowed = isAllowed(outcome.document, agent, url);
		return {
			...report,
			allowed,
			rule: matchingRule(outcome.document, agent, url),
			status: "parsed",
		};
	}

	let allowed = isAllowedBy(outcome, agent, url);
	return { ...report, allowed, rule: null, status: outcome.status, httpStatus: outcome.httpStatus };
}

/** The human report: the verdict and URL, then why, then which robots.txt said so. */
function describe(report: CheckReport, source: RobotsSource): string {
	let verdict = report.allowed ? "allowed" : "disallowed";
	let reason = "no rule matches";
	if (report.rule !== null) {
		reason = `rule: ${report.rule.allow ? "Allow" : "Disallow"}: ${report.rule.pattern}`;
	} else if (source.kind === "fetched" && source.outcome.status !== "parsed") {
		reason = describeFallback(source.outcome);
	}
	return `${verdict}: ${report.url}\n${reason}\nrobots: ${report.robots}\n`;
}

/**
 * Prints the verdict, or `--json`'s report, on stdout in both cases; exits 1 when the URL is
 * disallowed. A path needs `--robots`, since only an absolute URL names an origin to fetch.
 */
export default createCommand(ROBOTS_COMMANDS.check, async (ctx) => {
	let { url } = ctx.arguments;
	let isPath = url.startsWith("/") && !url.startsWith("//");

	if (!isPath && !isWebUrl(url)) return exit(2, `Not an http(s) URL or a /-rooted path: ${url}`);
	if (isPath && ctx.flags.robots === undefined) {
		return exit(2, `A path needs --robots to name the file; pass an absolute URL to fetch it`);
	}

	let agent = ctx.flags.agent ?? WILDCARD_AGENT;
	let source = await readRobots(
		ctx,
		ctx.flags.robots ?? url,
		ctx.flags.agent ?? DEFAULT_FETCH_AGENT,
	);
	if (isFailure(source)) return source;

	let report = evaluate(source.data, agent, url);
	ctx.stdout(ctx.flags.json ? `${JSON.stringify(report)}\n` : describe(report, source.data));
	return report.allowed ? success() : exit(1);
});
