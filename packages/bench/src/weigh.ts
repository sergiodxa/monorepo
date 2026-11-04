/**
 * Bundles an entry the way a browser app would and weighs the minified and
 * gzipped output, so a package can hold a size budget in CI rather than
 * remembering one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { gzipSync } from "node:zlib";

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import * as esbuild from "esbuild";

import { WeightError } from "./weight-error.js";

/** What one built entry point weighs, in bytes. */
export interface Weight {
	minified: number;
	gzipped: number;
}

/** A gzipped (and optional minified) ceiling for {@link assertWeight}. */
export interface WeightBudget {
	/** Maximum gzipped UTF-8 bytes after a minified browser bundle. */
	maxGzipped: number;
	/** Optional minified ceiling; gzipped remains the first-class budget. */
	maxMinified?: number;
}

/**
 * Bundles and minifies `entry` and weighs the result. The build targets the
 * browser with every dependency inlined, so the number covers what a consumer
 * actually pulls in.
 *
 * @param entry - Path to the entry module.
 * @param root - Directory module resolution starts from; defaults to the process cwd.
 * @returns The output's minified and gzipped size, or a {@link WeightError}.
 */
export async function weigh(
	entry: string,
	root: string = process.cwd(),
): Promise<Result<Weight, WeightError>> {
	try {
		let built = await esbuild.build({
			absWorkingDir: root,
			entryPoints: [entry],
			bundle: true,
			minify: true,
			write: false,
			format: "esm",
			platform: "browser",
			logLevel: "silent",
		});
		let file = built.outputFiles[0];
		if (file === undefined) {
			return failure(WeightError.build(entry, "esbuild produced no output"));
		}
		let code = file.text;
		return success({
			minified: Buffer.byteLength(code, "utf8"),
			gzipped: gzipSync(code).byteLength,
		});
	} catch (cause) {
		return failure(WeightError.build(entry, buildDetail(cause)));
	}
}

/**
 * Holds `weight` to a gzipped (and optional minified) budget for callers that
 * answer a `Result` (the CLI's `--max-gzipped` path).
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

/** Message from an esbuild failure, falling back to a generic string. */
function buildDetail(cause: unknown): string {
	if (cause !== null && typeof cause === "object" && "errors" in cause) {
		let errors = (cause as { errors: unknown }).errors;
		if (Array.isArray(errors) && errors.length > 0) {
			return errors
				.map((error) =>
					typeof error === "object" && error !== null && "text" in error
						? String((error as { text: unknown }).text)
						: String(error),
				)
				.join("\n");
		}
	}
	if (cause instanceof Error) return cause.message;
	return String(cause);
}
