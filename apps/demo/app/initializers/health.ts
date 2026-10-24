/**
 * The board's health check: one probe per stateful binding a page reads. The board reads one,
 * the D1 database; Turnstile loads in the visitor's browser and stays optional, so the
 * Worker's health never depends on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HealthCheck } from "@sdxc/health";
import { sql } from "remix/data-table";

import type { AppContext } from "~/app/initializers/router";

/** The report `GET /health` answers with, shared by every request. */
export const health = new HealthCheck<AppContext>({ serviceId: "demo" });

health.probe("database", (ctx) => ctx.db.exec(sql`SELECT 1`), { componentType: "datastore" });
