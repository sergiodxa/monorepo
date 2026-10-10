/**
 * Agent client bindings: which tenant a machine credential registered against the platform
 * tenant may reach, keyed on the client id itself. A client with no binding is a person's
 * own client rather than a machine's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { agentClientBindings } from "~/database/schema";

/**
 * Agent client bindings, read by `find(clientId)` and stamped with their creation time.
 *
 * @example let binding = await models.agentClientBindings.find(clientId);
 */
export const AgentClientBindings = createModel(agentClientBindings, {
	scopes: {
		ofTenant: (query, tenantId: string) => query.where({ tenant_id: tenantId }),
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, created_at: values.created_at ?? Date.now() };
		},
	},
});

/** One agent client binding row as the control plane stores it. */
export type AgentClientBindingRow = ModelRow<typeof AgentClientBindings>;

export default AgentClientBindings;
