/**
 * Tests for the command-line middleware: `trace()` continues the trace in `TRACEPARENT` or
 * starts one, publishes it as `ctx.trace` and for `currentTrace()`, stamps the run's log, and
 * hands it to child processes started with `ctx.exec`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExecRequest } from "@sdxc/cli";

import { command, commands, createCLI, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import { isFailure, success as ok } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import type { TraceContext } from "./context.js";

import { CurrentTrace, trace } from "./cli.js";
import { startTrace, toTraceParent } from "./context.js";
import { currentTrace, runWithTrace } from "./current.js";

const CONTRACT = commands({ backfill: command({ description: "Backfill posts" }) });

const PARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

describe("trace()", () => {
	test("continues the trace in TRACEPARENT and publishes it as ctx.trace", async () => {
		let seen: TraceContext | undefined;
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [trace()] });
		cli.map(CONTRACT.backfill, (ctx) => {
			seen = ctx.trace;
			expect(currentTrace()).toBe(ctx.trace);
			expect(ctx.get(CurrentTrace)).toBe(ctx.trace);
			return success();
		});

		let run = await invoke(cli, ["backfill"], {
			env: { TRACEPARENT: PARENT, TRACESTATE: "vendor=value" },
		});

		expect(run.code).toBe(0);
		expect(seen).toMatchObject({
			traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
			parentSpanId: "00f067aa0ba902b7",
			sampled: true,
		});
		expect(seen?.spanId).not.toBe("00f067aa0ba902b7");
		expect(seen?.state.get("vendor")).toBe("value");
	});

	test("starts a trace without TRACEPARENT, or with an invalid one", async () => {
		let seen: TraceContext[] = [];
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [trace()] });
		cli.map(CONTRACT.backfill, (ctx) => {
			seen.push(ctx.trace);
			return success();
		});

		await invoke(cli, ["backfill"]);
		await invoke(cli, ["backfill"], { env: { TRACEPARENT: "garbage" } });

		expect(seen).toHaveLength(2);
		for (let started of seen) {
			expect(started.parentSpanId).toBeNull();
			expect(started.traceId).toMatch(/^[0-9a-f]{32}$/);
		}
	});

	test("stamps the run's log with the trace fields", async () => {
		let records: Record<string, unknown>[] = [];
		let logger = createLogger({ service: "app", sink: (record) => void records.push(record) });
		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [log(logger), trace()],
		});
		cli.map(CONTRACT.backfill, () => success());

		await invoke(cli, ["backfill"], { env: { TRACEPARENT: PARENT } });

		expect(records[0]).toMatchObject({
			kind: "command",
			trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
			parent_span_id: "00f067aa0ba902b7",
			trace_flags: "01",
		});
	});

	test("joins the trace a host already bound", async () => {
		let host = startTrace();
		let seen: TraceContext | undefined;
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [trace()] });
		cli.map(CONTRACT.backfill, (ctx) => {
			seen = ctx.trace;
			return success();
		});

		await runWithTrace(host, () => invoke(cli, ["backfill"], { env: { TRACEPARENT: PARENT } }));

		expect(seen).toBe(host);
	});

	test("hands the run's span to child processes as TRACEPARENT", async () => {
		let requests: ExecRequest[] = [];
		let seen: TraceContext | undefined;
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [trace()] });
		cli.map(CONTRACT.backfill, async (ctx) => {
			seen = ctx.trace;
			let first = await ctx.exec(["worker"], { stdio: "collect" });
			if (isFailure(first)) return first;
			let second = await ctx.exec(["worker"], {
				stdio: "collect",
				env: { TRACEPARENT: PARENT },
			});
			if (isFailure(second)) return second;
			return success();
		});

		let run = await invoke(cli, ["backfill"], {
			env: { TRACEPARENT: PARENT, TRACESTATE: "vendor=value" },
			exec: async (_command, request) => {
				requests.push(request);
				return ok({ code: 0, stdout: "", stderr: "", output: "" });
			},
		});

		expect(run.code).toBe(0);
		expect(run.exec).toHaveLength(2);
		expect(requests[0]?.env.TRACEPARENT).toBe(toTraceParent(seen as TraceContext));
		expect(requests[0]?.env.TRACESTATE).toBe("vendor=value");
		expect(requests[1]?.env.TRACEPARENT).toBe(PARENT);
	});
});
