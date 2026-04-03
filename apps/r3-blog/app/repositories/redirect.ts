import type { KVStore } from "~/app/contracts/kv-store";

/**
 * Helpers for URL redirects stored in the REDIRECTS KV namespace.
 *
 * Keys are request pathnames (e.g. `/old-path`) and values are either:
 * - plain destination strings (e.g. `/new-path`)
 * - JSON objects with `{ to, status }`
 */
export namespace Redirect {
	/**
	 * Redirect status codes supported by this model.
	 */
	export type Status = 301 | 302 | 307 | 308;

	/**
	 * Redirect target payload.
	 */
	export interface Value {
		to: string;
		status: Status;
	}

	/**
	 * Redirect record as returned by list operations.
	 */
	export interface Record {
		from: string;
		to: string;
		status: Status;
	}

	/**
	 * Input used to create or update a redirect entry.
	 */
	export interface UpsertInput {
		from: string;
		to: string;
		status?: Status;
	}
}

/**
 * Redirect model backed by a KV namespace.
 */
export class Redirect {
	/**
	 * Looks up a redirect by request pathname.
	 */
	static async findByPath(kv: KVStore, pathname: string): Promise<Redirect.Value | null> {
		let key = this.normalizePath(pathname);
		let value = await kv.get(key);
		if (!value) return null;

		return this.parseValue(value);
	}

	/**
	 * Lists all redirect entries from KV.
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
	 * Creates or updates a redirect entry.
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
	 * Deletes a redirect entry by source path.
	 */
	static async destroy(kv: KVStore, from: string) {
		let key = this.normalizePath(from);
		await kv.delete(key);
		return true;
	}

	/**
	 * Parses redirect value from KV, handling JSON and plain string values.
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
	 * Normalizes redirect source paths to start with `/`.
	 */
	static normalizePath(pathname: string) {
		if (pathname.startsWith("/")) return pathname;
		return `/${pathname}`;
	}
}
