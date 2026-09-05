/**
 * The wide event: one record per invocation, built up while the work runs and emitted once
 * when it settles. Fields are flat scalars so every one of them is a filter in the log
 * index; the narrative lives in a capped `notes` array that is read, never queried.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Sample } from "./sample.js";

import { bindLog } from "./current.js";
import { shouldKeep } from "./sample.js";

/**
 * How many breadcrumbs a log keeps. Past it the count of dropped notes is recorded instead,
 * so a log stays under the platform's per-record cap with its fields intact rather than
 * being truncated from the end, where the fields are.
 */
const MAX_NOTES = 200;

export namespace Log {
	/** What kind of invocation produced the log. */
	export type Kind = "request" | "cron" | "queue" | "job" | "alarm";

	/** How the invocation ended: `ok` until `warn` or `fail` says otherwise. */
	export type Outcome = "ok" | "degraded" | "error";

	/** A field value. Structure lives in the key, so a value is always a scalar. */
	export type Value = string | number | boolean | null;

	/** Fields as they are written: one level of nesting is accepted and flattened to dotted keys. */
	export type Fields = Record<string, Value | undefined | Record<string, Value | undefined>>;

	/** A breadcrumb: when it happened, how loud it was, and what it was about. */
	export interface Note {
		/** Milliseconds since the log opened. */
		at: number;
		level: "info" | "warn" | "error";
		name: string;
		[key: string]: Value | undefined;
	}

	/** Where an emitted record goes, and the outcome it was emitted at. */
	export type Sink = (record: Readonly<Record<string, unknown>>, outcome: Outcome) => void;

	export interface Options {
		kind: Kind;
		/** The worker's name, the same on every log it emits. */
		service?: string;
		environment?: string;
		/** The deployed version, from the platform's version metadata when a worker binds it. */
		version?: string;
		sample?: Sample.Options;
		/** Defaults to the console, at the level the outcome names. */
		sink?: Sink;
	}
}

/** Writes at the console level the outcome names, so the dashboard's level filter agrees with `outcome`. */
function writeToConsole(record: Readonly<Record<string, unknown>>, outcome: Log.Outcome): void {
	if (outcome === "error") console.error(record);
	else if (outcome === "degraded") console.warn(record);
	else console.log(record);
}

/** Milliseconds to a tenth, which is as fine as a duration in a log needs to be. */
function round(ms: number): number {
	return Math.round(ms * 10) / 10;
}

/** A value as it is stored: scalars as they are, anything deeper as its JSON. */
function scalar(value: unknown): Log.Value {
	if (value === null) return null;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	try {
		return JSON.stringify(value) ?? Object.prototype.toString.call(value);
	} catch {
		return Object.prototype.toString.call(value);
	}
}

/**
 * One invocation's record.
 *
 * Fields merge, counters add, and `emit()` writes the whole thing once; `run()` does the
 * binding and the emitting around a body so the common case is one call.
 *
 * @example
 * let log = new Log({ kind: "request", service: "uptime" });
 * await log.run(() => handle(request));
 */
export class Log {
	readonly kind: Log.Kind;

	readonly #options: Log.Options;
	readonly #started = performance.now();
	readonly #fields = new Map<string, Log.Value>();
	readonly #notes: Log.Note[] = [];
	#droppedNotes = 0;
	#outcome: Log.Outcome = "ok";
	#error: unknown;
	#parent: Log | undefined;
	#emitted = false;

	/**
	 * @param options The kind of invocation and the configuration every log of a worker shares.
	 * @param fields Fields known before any work runs.
	 */
	constructor(options: Log.Options, fields?: Log.Fields) {
		this.#options = options;
		this.kind = options.kind;
		if (fields !== undefined) this.set(fields);
	}

	/** How the invocation has ended so far. */
	get outcome(): Log.Outcome {
		return this.#outcome;
	}

	/** The log this one was opened under, which it counts into when it emits. */
	get parent(): Log | undefined {
		return this.#parent;
	}

	/**
	 * Merges fields into the record. A nested object flattens one level to dotted keys, so
	 * `{ user: { id } }` is stored as `user.id`; an `undefined` value is skipped.
	 *
	 * @param fields What was learned.
	 * @example log.set({ user: { id: user.id, plan: subscription.plan } });
	 */
	set(fields: Log.Fields): this {
		for (let [key, value] of Object.entries(fields)) {
			if (value === undefined) continue;
			if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				for (let [nested, inner] of Object.entries(value)) {
					if (inner !== undefined) this.#fields.set(`${key}.${nested}`, scalar(inner));
				}
				continue;
			}
			this.#fields.set(key, scalar(value));
		}
		return this;
	}

	/**
	 * Adds to a counter, creating it at zero.
	 *
	 * @param field The counter's key.
	 * @param by How much to add.
	 * @example log.inc("cache.miss");
	 */
	inc(field: string, by = 1): this {
		let current = this.#fields.get(field);
		this.#fields.set(field, (typeof current === "number" ? current : 0) + by);
		return this;
	}

	/**
	 * Runs `fn`, adding to `${name}.count` and `${name}.duration_ms` however it returns, so
	 * the performance section of the record is a by-product of doing the work.
	 *
	 * @param name The operation's namespace, shared by every call that should accumulate.
	 * @param fn The work.
	 * @returns What `fn` returned.
	 * @example let rows = await log.time("db", () => db.query(sql));
	 */
	async time<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
		let started = performance.now();
		try {
			return await fn();
		} finally {
			this.inc(`${name}.count`);
			this.inc(`${name}.duration_ms`, round(performance.now() - started));
		}
	}

	/**
	 * Records a breadcrumb. Notes are the record's narrative, read once a query has found
	 * it; anything worth filtering on belongs in a field.
	 *
	 * @param name What happened, dotted lowercase.
	 * @param fields Detail worth reading alongside it.
	 * @example log.note("session.read", { via: "cookie" });
	 */
	note(name: string, fields?: Record<string, Log.Value | undefined>): this {
		this.#note("info", name, fields);
		return this;
	}

	/**
	 * Records a breadcrumb and degrades the outcome: recorded and kept, without being an
	 * alarm.
	 *
	 * @param name What went wrong, dotted lowercase.
	 * @param fields Detail worth reading alongside it.
	 * @example log.warn("cache.unavailable", { key });
	 */
	warn(name: string, fields?: Record<string, Log.Value | undefined>): this {
		this.#note("warn", name, fields);
		this.#degrade();
		return this;
	}

	/**
	 * Records the failure in a fixed shape and sets the outcome to `error`. `error.code` and
	 * `error.retriable` are read off the error when it carries them, so a provider's own
	 * codes survive; the stack is attached when the record is written.
	 *
	 * @param error What was thrown.
	 * @param fields Detail about the failure worth filtering on.
	 * @example log.fail(error, { provider: "polar" });
	 */
	fail(error: unknown, fields?: Log.Fields): this {
		this.#error = error;
		this.#outcome = "error";
		this.set({
			error: {
				type: error instanceof Error ? error.name : "UnknownError",
				message: error instanceof Error ? error.message : String(error),
				code: readScalar(error, "code"),
				retriable: readBoolean(error, "retriable"),
			},
		});
		if (fields !== undefined) this.set(fields);
		return this;
	}

	/**
	 * Opens a log of another kind under this one. It shares this log's configuration, and
	 * when it emits it adds to this log's `${kind}.count` and degrades this log if it did
	 * not end `ok`, so the parent answers "how many, and did any go wrong" on its own.
	 *
	 * @param kind What kind of invocation the child records.
	 * @param fields Fields known before its work runs.
	 * @example let job = batch.child("job", { job: { name: "clean" } });
	 */
	child(kind: Log.Kind, fields?: Log.Fields): Log {
		let child = new Log({ ...this.#options, kind }, fields);
		child.#parent = this;
		return child;
	}

	/**
	 * Binds this log as the current one for `fn`, fails it if `fn` throws, and emits it once
	 * `fn` settles either way. The throw is rethrown, so a caller's error handling is unchanged.
	 *
	 * @param fn The invocation's work, handed this log.
	 * @returns What `fn` returned.
	 * @example return log.run(() => router.fetch(request));
	 */
	run<T>(fn: (log: this) => T | Promise<T>): Promise<T> {
		return bindLog(this, async () => {
			try {
				return await fn(this);
			} catch (error) {
				this.fail(error);
				throw error;
			} finally {
				this.emit();
			}
		});
	}

	/**
	 * Writes the record once, or drops it when the sampler says so. A second call does
	 * nothing, so emitting in a `finally` is always safe.
	 */
	emit(): void {
		if (this.#emitted) return;
		this.#emitted = true;

		let duration = round(performance.now() - this.#started);
		let fields = Object.fromEntries(this.#fields) as Record<string, Log.Value>;
		fields.kind = this.kind;

		this.#parent?.inc(`${this.kind}.count`);
		if (this.#outcome !== "ok" && this.#parent !== undefined) this.#parent.#degrade();

		if (!shouldKeep(this.#options.sample, this.#outcome, fields, duration)) return;

		let record: Record<string, unknown> = {};
		if (this.#options.service !== undefined) record.service = this.#options.service;
		if (this.#options.environment !== undefined) record.environment = this.#options.environment;
		if (this.#options.version !== undefined) record.version = this.#options.version;
		record.kind = this.kind;
		for (let [key, value] of this.#fields) record[key] = value;
		record.outcome = this.#outcome;
		record.duration_ms = duration;
		if (this.#error instanceof Error && this.#error.stack !== undefined) {
			record["error.stack"] = this.#error.stack;
		}
		if (this.#notes.length > 0) record.notes = this.#notes;
		if (this.#droppedNotes > 0) record["notes.dropped"] = this.#droppedNotes;

		(this.#options.sink ?? writeToConsole)(record, this.#outcome);
	}

	#note(level: Log.Note["level"], name: string, fields?: Record<string, Log.Value | undefined>) {
		if (this.#notes.length >= MAX_NOTES) {
			this.#droppedNotes++;
			return;
		}
		this.#notes.push({ ...fields, at: round(performance.now() - this.#started), level, name });
	}

	#degrade(): void {
		if (this.#outcome === "ok") this.#outcome = "degraded";
	}
}

/** A scalar property of a thrown value, for the codes providers put on their errors. */
function readScalar(error: unknown, key: string): Log.Value | undefined {
	if (typeof error !== "object" || error === null || !(key in error)) return undefined;
	let value = (error as Record<string, unknown>)[key];
	if (typeof value === "string" || typeof value === "number") return value;
	return undefined;
}

/** A boolean property of a thrown value, for a `retriable` flag. */
function readBoolean(error: unknown, key: string): boolean | undefined {
	if (typeof error !== "object" || error === null || !(key in error)) return undefined;
	let value = (error as Record<string, unknown>)[key];
	return typeof value === "boolean" ? value : undefined;
}
