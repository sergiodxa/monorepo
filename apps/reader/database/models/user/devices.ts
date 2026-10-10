/**
 * The browsers a reader asked to be reached on through Web Push, one row per endpoint. A
 * browser that subscribes again hands back the endpoint it already had, so registering is an
 * upsert on it and a device signed in twice still receives one notification.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";

import type { SelectPushSubscription } from "~/database/schema";

import { pushSubscriptions } from "~/database/schema";

/** What the Push API handed a browser, as a device row stores it. */
export interface DeviceKeys {
	p256dh: string;
	auth: string;
	vapid_key: string | null;
	user_agent: string | null;
	locale: string;
}

/** A reader's Web Push devices, one per endpoint. */
export const Devices = createModel(pushSubscriptions, {
	optional: ["id", "locale", "failure_count"],

	methods: {
		/** Every device, newest first, which is the order the notification settings list them. */
		newestFirst() {
			return this.query().orderBy("created_at", "desc").all();
		},

		/**
		 * Records the endpoint with fresh keys, or refreshes the device already holding it, and
		 * clears its failures either way: a browser that just subscribed is reachable.
		 */
		async register(endpoint: string, keys: DeviceKeys): Promise<SelectPushSubscription> {
			let existing = await this.findBy({ endpoint });
			let values = { ...keys, failure_count: 0 };

			if (existing === null) return unwrap(await this.create({ endpoint, ...values }));
			return unwrap(await this.update({ id: existing.id }, values));
		},
	},

	callbacks: {
		/** Mints the id the reader forgets a device by. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? TypeID.fromUUID("push", generateUUID()).toString() };
		},
	},
});

export default Devices;
