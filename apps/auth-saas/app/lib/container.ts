import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { createDatabase, Database } from "remix/data-table";

/**
 * The platform service container (ADR-008). Registered once per isolate; the worker
 * and cron wrap each unit of work in `container.scope(...)`, so controllers and jobs
 * resolve dependencies with `inject([Database, ...])` instead of ad-hoc construction.
 */
export const container = new ServiceContainer();

container.singleton(Database, () => createDatabase(createD1DatabaseAdapter(env.PLATFORM_DB)));
