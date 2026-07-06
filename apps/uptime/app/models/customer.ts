/**
 * The billing model that wraps the Polar client to manage customers and usage-based billing.
 * It creates and looks up customers, links external IDs, checks for active subscriptions,
 * starts checkouts, ingests `ping` usage events, and queries monthly ping usage totals for a
 * customer or an individual monitor. It exists to isolate all Polar billing interactions
 * behind a single typed model keyed by the auth subject's external ID.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";

import type IdToken from "~/entities/id-token";

import polar from "~/clients/polar";

const PRODUCT_ID = "94161883-14eb-42e2-bb26-b4647199cda1";
const METER_ID = "22fabd9b-8b03-4cc2-8981-230717267cd5";

export default class Customer {
	static async create(idToken: IdToken) {
		return await polar.customers.create({
			email: idToken.email,
			name: idToken.name,
			externalId: idToken.subject,
		});
	}

	static async findByExternalId(externalId: string) {
		try {
			return await polar.customers.getExternal({ externalId });
		} catch {
			return null;
		}
	}

	static async findByEmail(email: string) {
		let customers = await polar.customers.list({ email: email });
		let customer = customers.result.items.at(0);
		if (customer) return customer;
		return null;
	}

	static async assignExternalId(id: string, externalId: string) {
		return await polar.customers.update({
			id: id,
			customerUpdate: { externalId },
		});
	}

	static async hasActiveSubscription(externalCustomerId: string) {
		try {
			let subscriptions = await polar.subscriptions.list({
				externalCustomerId,
				active: true,
			});
			return subscriptions.result.items.some(
				(subscription) => subscription.productId === PRODUCT_ID,
			);
		} catch {
			return false;
		}
	}

	static async checkout(externalId: string, returnTo: string) {
		return await polar.checkouts.create({
			externalCustomerId: externalId,
			successUrl: returnTo,
			products: [PRODUCT_ID],
		});
	}

	static async ingest(
		externalId: string,
		metadata: {
			monitorId: string;
			instanceId: string;
			teamId: string;
		},
	) {
		try {
			await polar.events.ingest({
				events: [{ name: "ping", externalCustomerId: externalId, metadata }],
			});
		} catch (error) {
			// Log error, but let it fail silently, I'll accept the loss
			console.error(error);
		}
	}

	static async getUsagePerMonth(
		externalId: string,
		metadata: { monitorId?: string; teamId?: string } = {},
		date = new Date(),
	) {
		try {
			let { total } = await polar.meters.quantities({
				externalCustomerId: externalId,
				startTimestamp: startOfMonth(startOfDay(date)),
				endTimestamp: endOfMonth(endOfDay(date)),
				interval: "month",
				id: METER_ID,
				metadata,
			});

			return total;
		} catch (error) {
			console.error(error);
			return 0;
		}
	}

	static async getMonitorUsagePerMonth(externalId: string, monitorId: string, date: Date) {
		try {
			let response = await polar.events.list({
				externalCustomerId: externalId,
				startTimestamp: startOfMonth(startOfDay(date)),
				endTimestamp: endOfMonth(endOfDay(date)),
				metadata: { monitorId },
				meterId: METER_ID,
				limit: 1,
			});

			return "totalCount" in response.pagination
				? response.pagination.totalCount
				: response.items.length;
		} catch (error) {
			console.error(error);
			return 0;
		}
	}
}
