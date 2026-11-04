/**
 * The `sdxc-bench` command line as a contract: `weigh` for entry gzipped budgets
 * and `http` for latency against a running URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Print the machine-readable report. */
const JSON_OUTPUT = flag.boolean("json", { description: "Print the result as JSON" });

/** Every command `sdxc-bench` takes. */
export const BENCH_COMMANDS = commands({
	description: "@sdxc/bench — bundle weight and HTTP latency budgets",
	weigh: command({
		description:
			"Bundle an entry for the browser (minified, dependencies inlined) and check its gzipped size against a budget.",
		arguments: {
			entry: argument(s.string(), { description: "Path to the entry module to weigh" }),
		},
		flags: {
			root: flag.string("root", {
				description: "Directory the build runs from (default: cwd)",
			}),
			maxGzipped: flag.string("max-gzipped", {
				description: "Maximum gzipped bytes (required to fail on budget; omit to only print)",
			}),
			maxMinified: flag.string("max-minified", {
				description: "Optional maximum minified bytes",
			}),
			json: JSON_OUTPUT,
		},
		examples: [
			"weigh packages/markdown/src/index.ts --max-gzipped 25600",
			"weigh ./src/index.ts --root . --json",
		],
	}),
	http: command({
		description:
			"Sample latency against a running URL with bounded concurrency; optional percentile budgets accept duration strings or milliseconds.",
		arguments: {
			url: argument(s.string(), { description: "Absolute URL to request" }),
		},
		flags: {
			requests: flag.number("requests", {
				short: "n",
				default: 50,
				description: "How many requests to issue",
			}),
			concurrency: flag.number("concurrency", {
				short: "c",
				default: 5,
				description: "How many requests may be in flight",
			}),
			timeout: flag.string("timeout", {
				default: "5s",
				description: "Per-request timeout (duration string or milliseconds)",
			}),
			method: flag.string("method", {
				default: "GET",
				description: "HTTP method",
			}),
			p50: flag.string("p50", { description: "Fail when p50 exceeds this duration or ms" }),
			p95: flag.string("p95", { description: "Fail when p95 exceeds this duration or ms" }),
			p99: flag.string("p99", { description: "Fail when p99 exceeds this duration or ms" }),
			mean: flag.string("mean", { description: "Fail when mean exceeds this duration or ms" }),
			json: JSON_OUTPUT,
		},
		examples: [
			"http https://example.com/ --requests 20 --p95 200ms",
			"http http://127.0.0.1:8787/ --concurrency 10 --timeout 2s --json",
		],
	}),
});
