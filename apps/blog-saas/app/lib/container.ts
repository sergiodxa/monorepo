/**
 * Wires the platform's dependency-injection container (ADR-008), registering the
 * shared control-plane services — the D1-backed `Database`, `HostnameClient`, and the
 * scoped `BlogProvisioner` — for the worker and cron jobs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { HostnameClient } from "@sdxc/hostname";
import { ServiceContainer } from "@sdxc/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { BlogProvisioner } from "~/app/services/blog-provisioner";

/**
 * The platform service container (ADR-008). Registered once per isolate; the worker
 * and cron wrap each unit of work in `container.scope(...)`, so controllers and jobs
 * resolve dependencies with `inject([Database, ...])`.
 */
export const container = new ServiceContainer();

container.singleton(Database, () => new Database(createD1DatabaseAdapter(env.PLATFORM_DB)));
container.singleton(
	HostnameClient,
	() =>
		new HostnameClient({
			apiToken: env.CF_API_TOKEN,
			zoneId: env.CF_ZONE_ID,
			platformDomain: env.PLATFORM_DOMAIN,
			metadataKey: "blog_id",
		}),
);
container.scoped(
	BlogProvisioner,
	(c) => new BlogProvisioner(c.get(Database), c.get(HostnameClient)),
);
