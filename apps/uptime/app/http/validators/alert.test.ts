/**
 * Unit tests for the alert create/update/delete form validators: the shared
 * per-strategy `.refine()` gates (email/webhook/slack/discord each require their own
 * destination field) and the basic field constraints.
 *
 * Exercises the schemas directly via `remix/data-schema`'s `parseSafe()` with real
 * `FormData`, not `@pkg/validate`'s `validate()`: `validate()` normalizes `FormData`
 * into a plain object before handing it to the schema, but these are `f.object(...)`
 * form-data schemas that only accept the raw `FormData`/`URLSearchParams` instance, so
 * every call through `validate()` fails before the field-level rules ever run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import * as s from "remix/data-schema";

import { AlertIdSchema, CreateAlertSchema, UpdateAlertSchema } from "~/app/http/validators/alert";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "My alert");
	formData.set("strategy", "email");
	formData.set("email_to", "ops@example.com");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateAlertSchema", () => {
	test("accepts a valid email-strategy alert", () => {
		let result = s.parseSafe(CreateAlertSchema, baseFormData());
		expect(result.success).toBe(true);
	});

	test("rejects an email strategy without a valid email_to", () => {
		let missing = s.parseSafe(CreateAlertSchema, baseFormData({ email_to: "" }));
		expect(missing.success).toBe(false);

		let invalid = s.parseSafe(CreateAlertSchema, baseFormData({ email_to: "not-an-email" }));
		expect(invalid.success).toBe(false);
	});

	test("accepts a valid webhook-strategy alert", () => {
		let formData = baseFormData({ strategy: "webhook", webhook_url: "https://example.com/hook" });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(true);
	});

	test("rejects a webhook strategy without a valid webhook_url", () => {
		let formData = baseFormData({ strategy: "webhook", webhook_url: "" });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("rejects a webhook strategy with a malformed webhook_url", () => {
		let formData = baseFormData({ strategy: "webhook", webhook_url: "not a url" });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("accepts a valid slack-strategy alert", () => {
		let formData = baseFormData({
			strategy: "slack",
			slack_webhook_url: "https://hooks.slack.com/services/x",
		});
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(true);
	});

	test("rejects a slack strategy without a valid slack_webhook_url", () => {
		let formData = baseFormData({ strategy: "slack", slack_webhook_url: "not a url" });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("accepts a valid discord-strategy alert", () => {
		let formData = baseFormData({
			strategy: "discord",
			discord_webhook_url: "https://discord.com/api/webhooks/x",
		});
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(true);
	});

	test("rejects a discord strategy without a valid discord_webhook_url", () => {
		let formData = baseFormData({ strategy: "discord", discord_webhook_url: "" });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("rejects a missing name", () => {
		let formData = baseFormData({ name: "" });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("rejects a name longer than 255 characters", () => {
		let formData = baseFormData({ name: "a".repeat(256) });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("rejects a missing strategy", () => {
		let formData = baseFormData();
		formData.delete("strategy");
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("rejects an unknown strategy", () => {
		let formData = baseFormData({ strategy: "carrier-pigeon" });
		expect(s.parseSafe(CreateAlertSchema, formData).success).toBe(false);
	});

	test("rejects a cooldown_minutes outside 0-1440", () => {
		let tooHigh = s.parseSafe(CreateAlertSchema, baseFormData({ cooldown_minutes: "1441" }));
		expect(tooHigh.success).toBe(false);

		let tooLow = s.parseSafe(CreateAlertSchema, baseFormData({ cooldown_minutes: "-1" }));
		expect(tooLow.success).toBe(false);
	});

	test("coerces notify_on_recovery and cooldown_minutes from strings", () => {
		let formData = baseFormData({ notify_on_recovery: "true", cooldown_minutes: "15" });
		let result = s.parseSafe(CreateAlertSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.notify_on_recovery).toBe(true);
			expect(result.value.cooldown_minutes).toBe(15);
		}
	});

	/**
	 * `cooldown_minutes` defaults to 15, not 0 (ADR-004). Zero is still a legal value a user
	 * can choose, but it must not be what they get by accident: at 0 a down monitor on a
	 * 1-minute interval emails every minute for as long as it stays down.
	 */
	test("defaults notify_on_recovery and cooldown_minutes when omitted", () => {
		let result = s.parseSafe(CreateAlertSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.notify_on_recovery).toBe(false);
			expect(result.value.cooldown_minutes).toBe(15);
		}
	});

	test("still accepts an explicit cooldown of 0", () => {
		let result = s.parseSafe(CreateAlertSchema, baseFormData({ cooldown_minutes: "0" }));
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.cooldown_minutes).toBe(0);
	});

	test("leaves monitor_id undefined when omitted, since it is optional", () => {
		let result = s.parseSafe(CreateAlertSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.monitor_id).toBeUndefined();
		}
	});
});

describe("UpdateAlertSchema", () => {
	test("accepts a valid update including alert_id", () => {
		let formData = baseFormData({ alert_id: "alert_1" });
		expect(s.parseSafe(UpdateAlertSchema, formData).success).toBe(true);
	});

	test("rejects an update missing alert_id", () => {
		let formData = baseFormData();
		expect(s.parseSafe(UpdateAlertSchema, formData).success).toBe(false);
	});

	test("applies the same per-strategy refinement as create", () => {
		let formData = baseFormData({ alert_id: "alert_1", strategy: "webhook", webhook_url: "" });
		expect(s.parseSafe(UpdateAlertSchema, formData).success).toBe(false);
	});
});

describe("AlertIdSchema", () => {
	test("accepts a valid alert_id", () => {
		let formData = new FormData();
		formData.set("alert_id", "alert_1");
		expect(s.parseSafe(AlertIdSchema, formData).success).toBe(true);
	});

	test("rejects a missing alert_id", () => {
		expect(s.parseSafe(AlertIdSchema, new FormData()).success).toBe(false);
	});
});
