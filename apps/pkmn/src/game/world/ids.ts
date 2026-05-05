/**
 * Shared world identifier primitives for entity-backed records in this module.
 *
 * This module defines the specialized identifier aliases used by the world layer
 * and exposes the small set of factory functions that create them through the
 * common entity id strategy. Its purpose is to keep identifier creation
 * consistent while giving each world concept a distinct type at the module API.
 *
 * By centralizing these aliases and constructors here, the rest of the world
 * code can depend on stable, semantic ids without coupling to the underlying
 * string-building details. This keeps call sites explicit about intent while
 * preserving one shared source of truth for how these ids are derived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { EntityId } from "./entity";

import { createEntityId } from "./entity";

/** Stable identifier for one player record in the world. */
export type PlayerId = EntityId;

/** Stable identifier for one captured or wild creature record in the world. */
export type CreatureId = EntityId;

/** Stable identifier for one transient battle session. */
export type BattleId = EntityId;

/** Creates one stable player id using the shared entity strategy. */
export function createPlayerId(key: string): PlayerId {
	return createEntityId("player", key);
}

/** Creates one stable creature id using the shared entity strategy. */
export function createCreatureId(key: string): CreatureId {
	return createEntityId("creature", key);
}

/** Creates one stable battle id using the shared entity strategy. */
export function createBattleId(key: string): BattleId {
	return createEntityId("battle", key);
}
