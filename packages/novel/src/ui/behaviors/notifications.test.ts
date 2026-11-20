/**
 * Holds the notifications model to its contract without a DOM: toasts queued in order with ids
 * and kinds, the oldest dropped past the limit, and each dismissed with a `change`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import { NotificationsModel } from "./notifications.js";

describe(NotificationsModel, () => {
	test("queues text and message toasts with their ids and kinds", () => {
		let notifications = new NotificationsModel();
		let changed = vi.fn();
		notifications.addEventListener("change", changed);
		let unlocked = notifications.push({ text: "CG unlocked", kind: "image" });
		let achieved = notifications.push({ key: "achievements.fish", values: { count: 3 } });
		expect(notifications.entries).toEqual([
			{ id: unlocked.id, text: "CG unlocked", kind: "image" },
			{ id: achieved.id, key: "achievements.fish", values: { count: 3 }, kind: "custom" },
		]);
		expect(unlocked.id).not.toBe(achieved.id);
		expect(changed).toHaveBeenCalledTimes(2);
	});

	test("drops the oldest toast past the limit", () => {
		let notifications = new NotificationsModel({ limit: 2 });
		notifications.push({ text: "one" });
		notifications.push({ text: "two" });
		notifications.push({ text: "three" });
		expect(notifications.entries.map((entry) => ("text" in entry ? entry.text : ""))).toEqual([
			"two",
			"three",
		]);
	});

	test("dismisses a toast by id, ignoring one no longer queued", () => {
		let notifications = new NotificationsModel();
		let toast = notifications.push({ text: "Ending 1/2", kind: "ending" });
		let changed = vi.fn();
		notifications.addEventListener("change", changed);
		notifications.dismiss(toast.id);
		notifications.dismiss(toast.id);
		expect(notifications.entries).toEqual([]);
		expect(changed).toHaveBeenCalledOnce();
	});
});
