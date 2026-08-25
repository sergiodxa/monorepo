/**
 * Shared world identifier primitives for entity-backed records.
 *
 * Provides typed id aliases and factories built on the shared entity id
 * strategy, keeping identifier creation consistent across the world layer.
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
