import type { KVStore } from "~/app/contracts/kv-store";

/**
 * Redirect domain types persisted in the REDIRECTS KV namespace.
 *
 * KV values can be legacy plain strings or structured JSON payloads, so callers
 * should rely on `Redirect.parseValue` output instead of assuming one storage format.
 */
export namespace Redirect {
	/**
	 * HTTP redirect status codes accepted and emitted by this repository.
	 */
	export type Status = 301 | 302 | 307 | 308;

	/**
	 * Parsed redirect payload used by runtime lookups.
	 *
	 * `to` is returned as stored and may be absolute, relative, or external.
	 */
	export interface Value {
		to: string;
		status: Status;
	}

	/**
	 * Normalized redirect entry returned by read and write operations.
	 *
	 * `from` is always normalized to start with `/`.
	 */
	export interface Record {
		from: string;
		to: string;
		status: Status;
	}

	/**
	 * Input payload for creating or updating one redirect entry.
	 *
	 * When `status` is omitted, the repository defaults it to `302`.
	 */
	export interface UpsertInput {
		from: string;
		to: string;
		status?: Status;
	}
}

/**
 * Redirect repository backed by a KV namespace.
 *
 * It centralizes key normalization and payload parsing so controllers can consume
 * a single contract regardless of how redirects were historically stored.
 */
export class Redirect {
	/**
	 * Resolves one redirect for a request pathname.
	 * @param kv KV namespace containing redirect definitions.
	 * @param pathname Incoming request pathname to resolve.
	 * @returns Parsed redirect payload, or `null` when no valid redirect exists.
	 */
	static async findByPath(kv: KVStore, pathname: string): Promise<Redirect.Value | null> {
		let key = this.normalizePath(pathname);
		let value = await kv.get(key);
		if (!value) return null;

		return this.parseValue(value);
	}

	/**
	 * Lists every valid redirect currently stored in KV.
	 * @param kv KV namespace containing redirect definitions.
	 * @returns Redirect records with normalized `from` paths.
	 *
	 * Entries that cannot be read or parsed are skipped to keep admin listings resilient
	 * to stale keys and malformed legacy values.
	 */
	static async findAll(kv: KVStore): Promise<Array<Redirect.Record>> {
		let list = await kv.list();
		if (list.keys.length === 0) return [];

		let records = await Promise.all(
			list.keys.map(async (entry) => {
				let from = this.normalizePath(entry.name);
				let raw = await kv.get(entry.name);
				if (!raw) return null;
				let parsed = this.parseValue(raw);
				if (!parsed) return null;

				return {
					from,
					to: parsed.to,
					status: parsed.status,
				};
			}),
		);

		return records.filter((record): record is Redirect.Record => Boolean(record));
	}

	/**
	 * Creates or updates a redirect entry in KV.
	 * @param kv KV namespace containing redirect definitions.
	 * @param input Redirect source, target, and optional status.
	 * @returns Persisted redirect record with normalized `from` and resolved status.
	 */
	static async upsert(kv: KVStore, input: Redirect.UpsertInput) {
		let from = this.normalizePath(input.from);
		let value = JSON.stringify({ to: input.to, status: input.status ?? 302 });
		await kv.put(from, value);

		return {
			from,
			to: input.to,
			status: input.status ?? 302,
		} satisfies Redirect.Record;
	}

	/**
	 * Deletes one redirect by source path.
	 * @param kv KV namespace containing redirect definitions.
	 * @param from Source path to remove.
	 * @returns `true` once KV deletion has completed.
	 */
	static async destroy(kv: KVStore, from: string) {
		let key = this.normalizePath(from);
		await kv.delete(key);
		return true;
	}

	/**
	 * Parses a raw KV value into a redirect payload.
	 * @param value Raw value read from KV.
	 * @returns Parsed redirect payload, or `null` for empty/invalid values.
	 *
	 * Plain strings are treated as legacy shorthand and default to `302`. JSON payloads
	 * with unsupported statuses are accepted but coerced to `302`.
	 */
	static parseValue(value: string): Redirect.Value | null {
		let trimmed = value.trim();
		if (!trimmed) return null;

		if (!trimmed.startsWith("{")) {
			return { to: trimmed, status: 302 };
		}

		try {
			let parsed = JSON.parse(trimmed) as Partial<Redirect.Value>;
			if (typeof parsed.to !== "string" || !parsed.to) return null;
			if (
				parsed.status === 301 ||
				parsed.status === 302 ||
				parsed.status === 307 ||
				parsed.status === 308
			) {
				return { to: parsed.to, status: parsed.status };
			}

			return { to: parsed.to, status: 302 };
		} catch {
			return null;
		}
	}

	/**
	 * Normalizes redirect keys to path-like values.
	 * @param pathname Source pathname provided by callers or KV key names.
	 * @returns The same pathname when it already starts with `/`, otherwise prefixed.
	 */
	static normalizePath(pathname: string) {
		if (pathname.startsWith("/")) return pathname;
		return `/${pathname}`;
	}
}
