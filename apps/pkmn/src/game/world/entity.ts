/**
 * Stable entity identifier contract for the runtime, giving every system a
 * single predictable strategy for addressing entities across world state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Stable identifier used by ECS-style runtime records. */
export type EntityId = string;

/** Names the high-level domain bucket used to mint stable entity ids. */
export type EntityKind =
	| "player"
	| "creature"
	| "battle"
	| "battle-side"
	| "battle-member"
	| "encounter"
	| "world";

/** Parsed entity identifier that preserves the original opaque string. */
export interface EntityReference {
	kind: EntityKind;
	/** Opaque key within that bucket. */
	key: string;
	/** Original serialized entity identifier. */
	id: EntityId;
}

/** Creates one stable entity id using the shared `kind:key` strategy. */
export function createEntityId(kind: EntityKind, key: string): EntityId {
	return `${kind}:${key}`;
}

/** Parses one stable entity id back into its kind and opaque key. */
export function parseEntityId(entityId: EntityId): EntityReference {
	let separatorIndex = entityId.indexOf(":");
	if (separatorIndex <= 0 || separatorIndex === entityId.length - 1) {
		throw new RangeError(`Invalid entity id ${entityId}.`);
	}

	let kind = entityId.slice(0, separatorIndex) as EntityKind;
	let key = entityId.slice(separatorIndex + 1);

	return { kind, key, id: entityId };
}

/** Registers one entity id exactly once inside the world entity list. */
export function ensureEntityRegistered(entities: EntityId[], entityId: EntityId) {
	if (entities.includes(entityId)) return;
	entities.push(entityId);
}
