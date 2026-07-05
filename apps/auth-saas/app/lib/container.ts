/**
 * Wires up the platform-wide dependency-injection container (ADR-008) and registers
 * the shared {@link Database} singleton backed by the D1 platform database. Controllers
 * and jobs resolve their dependencies from this container rather than constructing them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { createDatabase, Database } from "remix/data-table";

/**
 * The platform service container (ADR-008). Registered once per isolate; the worker
 * and cron wrap each unit of work in `container.scope(...)`, so controllers and jobs
 * resolve dependencies with `inject([Database, ...])` instead of ad-hoc construction.
 *
 * @example
 * await container.scope(() => handler());
 */
export const container = new ServiceContainer();

container.singleton(Database, () => createDatabase(createD1DatabaseAdapter(env.PLATFORM_DB)));
