/**
 * Tasks: async work the user waits on, shown as a spinner or a progress bar that ends in one
 * ✓ or ✗ line. A task answers a `Result`, so a thrown error is a failure instead of an
 * exception, and tasks started inside a task's callback draw as its indented steps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Screen } from "./screen.js";
import type { Style } from "./style.js";

import { CancelledError } from "./errors.js";

/** The spinner's frames, one every {@link FRAME_MS}. */
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** How long each spinner frame shows. */
const FRAME_MS = 80;

/** How many cells the progress bar takes. */
const BAR_WIDTH = 20;

/** What a task's callback shapes it through. */
export interface Task {
	/**
	 * Aborts when the user presses Ctrl+C. Pass it to `fetch`, `ctx.exec` or anything else that
	 * takes a signal, so the work stops with the task; nested tasks share it.
	 */
	readonly signal: AbortSignal;
	/** Changes what the spinner says; the last label is the one the final line prints. */
	update(label: string): void;
	/** Turns the spinner into a bar out of `count`. Call again as the work grows. */
	total(count: number): void;
	/** Counts finished work; the count never passes the total. */
	advance(by?: number): void;
}

/** What `ctx.task` answers: a returned `Result` as it is, any other value as its success. */
export type TaskResult<T> = [T] extends [Result<infer Data, infer Failed extends Error>]
	? Result<Data, Failed | Error>
	: Result<T, Error>;

/** Runs a task; the label is optional. */
export interface RunTask {
	<T>(fn: (task: Task) => T | Promise<T>): Promise<TaskResult<Awaited<T>>>;
	<T>(label: string, fn: (task: Task) => T | Promise<T>): Promise<TaskResult<Awaited<T>>>;
}

/** One task in the tree of running and finished ones. */
interface TaskNode {
	label: string | undefined;
	count: number;
	total: number | undefined;
	depth: number;
	children: TaskNode[];
	status: "running" | "success" | "failure";
	started: number;
	ended: number;
}

/** Whether a callback returned a `Result` rather than a plain value. */
function isResult(value: unknown): value is Result<unknown, Error> {
	if (typeof value !== "object" || value === null || !("status" in value)) return false;
	return (
		(value.status === "success" && "data" in value) ||
		(value.status === "failure" && "error" in value)
	);
}

/** How long a task took, as its final line prints it. */
function duration(ms: number): string {
	return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Every task of one run, and how they draw. */
export class Tasks {
	#screen: Screen;
	#style: Style;
	/** Spinner frames and bars redraw in place; otherwise each task prints two plain lines. */
	#animate: boolean;
	#signal: AbortSignal;
	#roots: TaskNode[] = [];
	#current = new AsyncLocalStorage<TaskNode>();
	#frame = 0;
	#timer: ReturnType<typeof setInterval> | undefined;

	/**
	 * @param screen - The terminal owner the frame is drawn through
	 * @param style - Styling for stderr
	 * @param animate - Whether stderr is a terminal that redraws
	 * @param signal - Aborts on Ctrl+C
	 */
	constructor(screen: Screen, style: Style, animate: boolean, signal: AbortSignal) {
		this.#screen = screen;
		this.#style = style;
		this.#animate = animate;
		this.#signal = signal;
		screen.onRefresh(() => this.#draw());
	}

	/** The `ctx.task` function bound to this run. */
	readonly task: RunTask = (async (
		labelOrFn: string | ((task: Task) => unknown),
		maybeFn?: (task: Task) => unknown,
	): Promise<Result<unknown, Error>> => {
		let label = typeof labelOrFn === "string" ? labelOrFn : undefined;
		let fn = (typeof labelOrFn === "string" ? maybeFn : labelOrFn) as (task: Task) => unknown;
		return this.#run(label, fn);
	}) as RunTask;

	/** Stops the spinner and clears the frame, leaving finished lines where they are. */
	close(): void {
		this.#stopTimer();
		this.#roots = [];
		if (this.#animate && !this.#screen.held) this.#screen.paint([]);
	}

	async #run(label: string | undefined, fn: (task: Task) => unknown) {
		let parent = this.#current.getStore();
		let node: TaskNode = {
			label,
			count: 0,
			total: undefined,
			depth: parent === undefined ? 0 : parent.depth + 1,
			children: [],
			status: "running",
			started: performance.now(),
			ended: 0,
		};
		if (parent === undefined) this.#roots.push(node);
		else parent.children.push(node);
		if (this.#animate) {
			this.#startTimer();
			this.#draw();
		} else if (label !== undefined) {
			this.#screen.write(this.#screen.stderr, `${this.#indent(node)}${label}\n`);
		}
		let task: Task = {
			signal: this.#signal,
			update: (next) => {
				node.label = next;
				if (this.#animate) this.#draw();
			},
			total: (count) => {
				node.total = Math.max(0, count);
				node.count = Math.min(node.count, node.total);
				if (this.#animate) this.#draw();
			},
			advance: (by = 1) => {
				node.count += by;
				if (node.total !== undefined) node.count = Math.min(node.count, node.total);
				if (this.#animate) this.#draw();
			},
		};
		let outcome: Result<unknown, Error>;
		try {
			let value = await this.#current.run(node, () => fn(task));
			outcome = isResult(value) ? value : success(value);
		} catch (error) {
			outcome = failure(error instanceof Error ? error : new Error(String(error)));
		}
		if (isFailure(outcome) && this.#signal.aborted && !(outcome.error instanceof CancelledError)) {
			outcome = failure(new CancelledError());
		}
		node.status = isFailure(outcome) ? "failure" : "success";
		node.ended = performance.now();
		this.#finish(node);
		return outcome;
	}

	/** Prints a finished task: a root leaves the frame for good, a step stays drawn in it. */
	#finish(node: TaskNode): void {
		if (!this.#animate) {
			if (node.label !== undefined) {
				this.#screen.write(this.#screen.stderr, `${this.#finalLine(node)}\n`);
			}
			return;
		}
		if (node.depth > 0) {
			this.#draw();
			return;
		}
		this.#roots = this.#roots.filter((root) => root !== node);
		let lines = this.#finalLines(node);
		if (this.#roots.length === 0) this.#stopTimer();
		if (!this.#screen.held) this.#screen.paint([]);
		if (lines.length > 0) this.#screen.write(this.#screen.stderr, `${lines.join("\n")}\n`);
		this.#draw();
	}

	/** Redraws the frame: every running root and its steps. */
	#draw(): void {
		if (!this.#animate || this.#screen.held) return;
		let lines: string[] = [];
		for (let root of this.#roots) this.#collect(root, lines);
		this.#screen.paint(lines);
	}

	/** Adds `node` and its steps to the frame. */
	#collect(node: TaskNode, lines: string[]): void {
		if (node.status !== "running") {
			if (node.label !== undefined) lines.push(this.#finalLine(node));
		} else {
			let spinner = this.#style.cyan(SPINNER[this.#frame % SPINNER.length] as string);
			let text = node.label === undefined ? "" : ` ${node.label}`;
			lines.push(`${this.#indent(node)}${spinner}${text}${this.#bar(node)}`);
		}
		for (let child of node.children) this.#collect(child, lines);
	}

	/** A finished root and its steps, as they stay on screen. */
	#finalLines(node: TaskNode): string[] {
		let lines: string[] = [];
		if (node.label !== undefined) lines.push(this.#finalLine(node));
		for (let child of node.children) lines.push(...this.#finalLines(child));
		return lines;
	}

	/** `✓ label 3/3 (240 ms)`; the time only when animating, so plain output stays stable. */
	#finalLine(node: TaskNode): string {
		let style = this.#style;
		let mark = node.status === "success" ? style.green("✓") : style.red("✗");
		let count = node.total === undefined ? "" : ` ${node.count}/${node.total}`;
		let time = this.#animate ? ` ${style.dim(`(${duration(node.ended - node.started)})`)}` : "";
		return `${this.#indent(node)}${mark} ${node.label ?? ""}${count}${time}`;
	}

	/** The progress bar of a counted task, empty for one without a total. */
	#bar(node: TaskNode): string {
		if (node.total === undefined) return "";
		let filled = node.total === 0 ? BAR_WIDTH : Math.round((node.count / node.total) * BAR_WIDTH);
		let bar = `${"█".repeat(filled)}${this.#style.dim("░".repeat(BAR_WIDTH - filled))}`;
		return ` ${bar} ${node.count}/${node.total}`;
	}

	#indent(node: TaskNode): string {
		return "  ".repeat(node.depth);
	}

	#startTimer(): void {
		if (this.#timer !== undefined) return;
		this.#timer = setInterval(() => {
			this.#frame += 1;
			this.#draw();
		}, FRAME_MS);
		this.#timer.unref?.();
	}

	#stopTimer(): void {
		if (this.#timer !== undefined) clearInterval(this.#timer);
		this.#timer = undefined;
	}
}
