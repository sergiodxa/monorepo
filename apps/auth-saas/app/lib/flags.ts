/**
 * The platform's flag client: an `EntitlementProvider` wrapping an engine
 * that today holds no release-flag definitions, built once at module scope
 * the same way `billing.ts` and `session-cookie.ts` build their own
 * singletons. Every key it answers right now comes from the entitlement
 * namespace; whoever adds this platform's first release flag or kill switch
 * swaps the empty store below for a real one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { createFlags } from "@sdxc/flags/client";

import { EntitlementProvider } from "~/app/lib/entitlement-provider";

/**
 * The instance every entitlement gate evaluates through. `InMemoryFlagStore`
 * with no definitions, since nothing on this platform ships a release flag
 * yet — a Cloudflare KV-backed store replaces it the day one does.
 */
export const flags = createFlags({
	provider: () =>
		new EntitlementProvider(
			new EngineProvider(createEngine({ store: new InMemoryFlagStore({ flags: {} }) })),
		),
});
