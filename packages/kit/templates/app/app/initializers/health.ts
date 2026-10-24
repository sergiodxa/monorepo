/**
 * The health check `GET /health` answers: one probe per binding or service the app depends on,
 * each read-only, so a monitor polling every minute changes nothing. Add a probe here with each
 * binding the app starts reading, and `critical: false` for one it can serve without.
 */

import { HealthCheck } from "@sdxc/health";
import { sql } from "remix/data-table";

import type { AppContext } from "~/app/initializers/router";

import manifest from "../../package.json" with { type: "json" };

/** The report every request to `/health` runs, named after the app. */
export const health = new HealthCheck<AppContext>({ serviceId: manifest.name });

health.probe("database", (ctx) => ctx.db.exec(sql`SELECT 1`), { componentType: "datastore" });
