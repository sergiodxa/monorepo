/**
 * Bundles an entry the way an app would and weighs the minified and gzipped
 * output, so a package can hold a size budget in CI rather than remembering one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { WeightError } from "./weight-error.js";

/** Bundling runs in a Bun child process, since the test runner itself is Node. */
const run = promisify(execFile);

/** What one built entry point weighs, in bytes. */
export interface Weight {
	minified: number;
	gzipped: number;
}

/** A gzipped (and optional minified) ceiling for {@link assertWeight}. */
export interface WeightBudget {
	/** Maximum gzipped UTF-8 bytes after `bun build --minify`. */
	maxGzipped: number;
	/** Optional minified ceiling; gzipped remains the first-class budget. */
	maxMinified?: number;
}

/**
 * Bundles and minifies `entry` and weighs the result. The build targets the
 * browser, the harshest reader: nothing stays external, so the number covers
 * every dependency the entry actually pulls in.
 *
 * @param entry - Path to the entry module.
 * @param root - Directory the build runs from; defaults to the process cwd.
 * @returns The output's minified and gzipped size, or a {@link WeightError}.
 */
export async function weigh(
	entry: string,
	root: string = process.cwd(),
): Promise<Result<Weight, WeightError>> {
	try {
		let built = await run("bun", ["build", entry, "--minify", "--target=browser", "--format=esm"], {
			cwd: root,
			maxBuffer: 32 * 1024 * 1024,
		});
		let code = built.stdout;
		return success({
			minified: Buffer.byteLength(code, "utf8"),
			gzipped: gzipSync(code).byteLength,
		});
	} catch (cause) {
		let detail = buildDetail(cause);
		return failure(WeightError.build(entry, detail));
	}
}

/**
 * Holds `weight` to a gzipped (and optional minified) budget.
 *
 * @param weight - Measured weight from {@link weigh}.
 * @param budget - Ceilings in bytes.
 * @param entry - Entry path for the failure message, when known.
 */
export function assertWeight(
	weight: Weight,
	budget: WeightBudget,
	entry: string | null = null,
): Result<Weight, WeightError> {
	if (weight.gzipped > budget.maxGzipped) {
		return failure(WeightError.budget(weight, budget.maxGzipped, entry));
	}
	if (budget.maxMinified !== undefined && weight.minified > budget.maxMinified) {
		let where = entry === null ? "entry" : entry;
		return failure(
			new WeightError(
				"budget",
				`${where} weighs ${weight.minified} bytes minified (gzipped ${weight.gzipped}), over the ${budget.maxMinified} byte minified budget`,
				{ entry, weight, maxGzipped: budget.maxGzipped },
			),
		);
	}
	return success(weight);
}

/** stderr from an `execFile` failure, falling back to the error message. */
function buildDetail(cause: unknown): string {
	if (cause !== null && typeof cause === "object" && "stderr" in cause) {
		let stderr = (cause as { stderr: unknown }).stderr;
		if (typeof stderr === "string" && stderr.trim() !== "") return stderr.trim();
		if (Buffer.isBuffer(stderr) && stderr.byteLength > 0) return stderr.toString("utf8").trim();
	}
	if (cause instanceof Error) return cause.message;
	return String(cause);
}
