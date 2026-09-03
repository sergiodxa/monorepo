/**
 * The delivery store the billing webhook endpoint records through, backed by the
 * control-plane database. It is built at module scope beside the endpoint, so the
 * database is resolved per call, once a request has a scope to resolve it from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { WebhookDelivery as Delivery, WebhookStore } from "@pkg/billing";

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import WebhookDelivery from "~/app/models/webhook-delivery";

/** Records billing deliveries in the control plane, giving idempotency a durable key. */
class ControlPlaneWebhookStore implements WebhookStore {
	/**
	 * Reads a recorded delivery.
	 *
	 * @param id The platform's delivery id.
	 * @returns The delivery, or `null` when this one has never arrived.
	 */
	async find(id: string): Promise<Delivery | null> {
		return WebhookDelivery.find(this.#database, id);
	}

	/**
	 * Writes a delivery with its signature verdict, before anything trusts it.
	 *
	 * @param delivery The delivery as it arrived.
	 * @returns A promise resolving once the row is written.
	 */
	async record(delivery: Delivery): Promise<void> {
		await WebhookDelivery.record(this.#database, delivery);
	}

	/**
	 * Marks a delivery handled, so a replay of it is acknowledged without running
	 * the handler a second time.
	 *
	 * @param id The platform's delivery id.
	 * @returns A promise resolving once the row is marked.
	 */
	async markProcessed(id: string): Promise<void> {
		await WebhookDelivery.markProcessed(this.#database, id);
	}

	get #database(): Database {
		return getServiceContainer().get(Database);
	}
}

/** The store the billing webhook endpoint is configured with. */
export const deliveries = new ControlPlaneWebhookStore();
