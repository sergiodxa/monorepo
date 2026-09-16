/**
 * The canonical feed schema's migrations. SQL bodies are inlined at build time because a
 * Durable Object has no filesystem, and the journal is this object's own, so the two
 * object types migrate on their own schedules without ever reading each other's ids.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Migration } from "~/database/migrations";

import m0001 from "./feed-migrations/0001-init.sql?raw";
import m0002 from "./feed-migrations/0002-websub.sql?raw";

/** The journal table these are recorded in, which is this object's alone. */
export const FEED_JOURNAL = "feed_migrations";

/** Every migration, in the order they must be applied. */
export const FEED_MIGRATIONS: Migration[] = [
	{ id: "0001-init", sql: m0001 },
	{ id: "0002-websub", sql: m0002 },
];
