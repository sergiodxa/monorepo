/**
 * The control plane's record of every billing delivery it has received, keyed by the
 * platform's own delivery id. It is what makes a redelivery cheap to recognize and
 * leaves the exact bytes a signature covered readable after a handler got it wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WebhookDelivery, WebhookStore } from "@sdxc/billing";

import { env } from "cloudflare:workers";

/** One row as D1 holds it, where the two verdicts are integers rather than booleans. */
interface DeliveryRow {
	id: string;
	type: string;
	payload: string;
	valid: number;
	processed: number;
}

/**
 * Deliveries kept in the platform database. A row is written before anything trusts
 * the delivery and marked processed only once a handler ran to completion, so a
 * replay of an unfinished delivery is dispatched again instead of being skipped.
 *
 * @example
 * new BillingWebhook(polar, handlers, { store: deliveries });
 */
export let deliveries: WebhookStore = {
	/**
	 * Reads a recorded delivery.
	 *
	 * @param id - The platform's delivery id.
	 * @returns The row, or `null` when this delivery has never arrived.
	 */
	async find(id: string): Promise<WebhookDelivery | null> {
		let row = await env.PLATFORM_DB.prepare(
			"SELECT id, type, payload, valid, processed FROM billing_webhook_deliveries WHERE id = ?1",
		)
			.bind(id)
			.first<DeliveryRow>();

		if (!row) return null;

		return {
			id: row.id,
			type: row.type,
			payload: row.payload,
			valid: row.valid === 1,
			processed: row.processed === 1,
		};
	},

	/**
	 * Writes a delivery, replacing any row sharing its id so a redelivery of an
	 * unfinished one is measured against the bytes that arrived last.
	 *
	 * @param delivery - The delivery and the signature verdict on it.
	 */
	async record(delivery: WebhookDelivery): Promise<void> {
		await env.PLATFORM_DB.prepare(
			`INSERT INTO billing_webhook_deliveries (id, type, payload, valid, processed, received_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
			 ON CONFLICT(id) DO UPDATE SET
			   type = excluded.type,
			   payload = excluded.payload,
			   valid = excluded.valid,
			   processed = excluded.processed`,
		)
			.bind(
				delivery.id,
				delivery.type,
				delivery.payload,
				delivery.valid ? 1 : 0,
				delivery.processed ? 1 : 0,
				new Date().toISOString(),
			)
			.run();
	},

	/**
	 * Marks a delivery handled, which is what a later replay is measured against.
	 *
	 * @param id - The platform's delivery id.
	 */
	async markProcessed(id: string): Promise<void> {
		await env.PLATFORM_DB.prepare(
			"UPDATE billing_webhook_deliveries SET processed = 1 WHERE id = ?1",
		)
			.bind(id)
			.run();
	},
};
