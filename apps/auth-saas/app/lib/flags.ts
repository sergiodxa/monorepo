/**
 * The platform's flag client: an `EntitlementProvider` wrapping an engine
 * over a Cloudflare KV-backed store, built once at module scope the same way
 * `billing.ts` and `session-cookie.ts` build their own singletons. Every
 * entitlement key resolves the way it already did; every other key —
 * `release.*` and `kill.*` handles a future capability declares — now has a
 * real definition set to read from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EventDetails, MaybePromise } from "@sdxc/flags";
import type { Condition } from "@sdxc/flags-engine";
import type { FlagStore, FlagStoreError, StoredFlagSet } from "@sdxc/flags-engine/store";
import type { Result } from "@sdxc/result";

import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";
import { createFlags, wideEventHook } from "@sdxc/flags/client";
import { currentLog } from "@sdxc/logger";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { EntitlementProvider } from "~/app/lib/entitlement-provider";

/**
 * Reads the `INTERNAL_TENANT_IDS` secret — a JSON array of tenant ids — into
 * a plain list, answering an empty list for anything that is not that shape
 * rather than throwing at module load, the same defensive parse `billing.ts`
 * gives its own JSON secrets.
 *
 * @param raw - The secret's raw value, or `undefined` when unset.
 * @returns The tenant ids the "internal" segment matches.
 */
export function parseInternalTenantIds(raw: string | undefined): readonly string[] {
	if (!raw) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}

	if (!Array.isArray(parsed)) return [];

	return parsed.filter((id): id is string => typeof id === "string");
}

/**
 * The condition the "internal" segment stands for: every tenant in the given
 * list, matched on the field a rollout's own targeting key already carries —
 * so a flag written to target tenants and a flag written to target this
 * segment read the same subject.
 *
 * @param tenantIds - The tenant ids the segment matches.
 */
export function internalSegmentCondition(tenantIds: readonly string[]): Condition {
	return { op: "in", field: "targetingKey", values: [...tenantIds] };
}

/**
 * Wraps a store, adding the "internal" segment to whatever it reads, so a
 * targeting rule references it by name without that name ever having to be
 * written into the definition set the store persists. The wrapped store's own
 * `segments` still travel through underneath it.
 */
export class InternalSegmentFlagStore implements FlagStore {
	#wrapped: FlagStore;
	#condition: Condition;

	/**
	 * @param wrapped The store every read is otherwise served from.
	 * @param condition What the "internal" segment resolves to.
	 */
	constructor(wrapped: FlagStore, condition: Condition) {
		this.#wrapped = wrapped;
		this.#condition = condition;
	}

	read(): MaybePromise<Result<StoredFlagSet, FlagStoreError>> {
		let read = this.#wrapped.read();

		if (read instanceof Promise) return read.then((result) => this.#withInternalSegment(result));

		return this.#withInternalSegment(read);
	}

	#withInternalSegment(
		result: Result<StoredFlagSet, FlagStoreError>,
	): Result<StoredFlagSet, FlagStoreError> {
		if (isFailure(result)) return result;

		return success({
			...result.data,
			segments: { ...result.data.segments, internal: this.#condition },
		});
	}
}

/**
 * Notes a stale flag snapshot on the invocation's log, degrading its outcome:
 * the client still answers every evaluation from the snapshot already held.
 *
 * @param details - What the provider reported about the stale reload.
 */
export function logFlagsStale(details: EventDetails): void {
	currentLog()?.warn("flags.stale", { message: details.message });
}

/**
 * Notes a flag provider failure on the invocation's log, degrading its
 * outcome: the client still answers every evaluation with the caller's own
 * default.
 *
 * @param details - What the provider reported about the failure.
 */
export function logFlagsError(details: EventDetails): void {
	currentLog()?.warn("flags.provider_error", {
		errorCode: details.errorCode,
		message: details.message,
	});
}

/**
 * The raw store the write path and the expiry report read and write through
 * directly, holding exactly what an operator wrote — the "internal" segment
 * lives beside it in {@link InternalSegmentFlagStore} rather than in here, so
 * neither of them has to know that segment exists.
 */
export const flagStore = new WorkerKVFlagStore(env.FLAGS);

/**
 * The instance every entitlement gate and every future release flag or kill
 * switch evaluates through. Definitions come from `flagStore`; the "internal"
 * segment comes from `INTERNAL_TENANT_IDS` and is merged in on every read.
 */
export const flags = createFlags({
	provider: () =>
		new EntitlementProvider(
			new EngineProvider(
				createEngine({
					store: new InternalSegmentFlagStore(
						flagStore,
						internalSegmentCondition(parseInternalTenantIds(env.INTERNAL_TENANT_IDS)),
					),
					maxAge: "30 seconds",
				}),
			),
		),
	hooks: [wideEventHook()],
	handlers: {
		PROVIDER_STALE: logFlagsStale,
		PROVIDER_ERROR: logFlagsError,
	},
});
