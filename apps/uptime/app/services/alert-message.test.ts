/**
 * Tests for the chat and webhook message a registration alert sends: the plain-text lines
 * a channel shows, and the snapshot a webhook receiver reads, which keeps the EPP statuses
 * as a list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { AlertEventSnapshot } from "~/database/schema";

import { alertMessage, snapshotLines } from "./alert-message";

/** A registration the registry has put on hold, with every detail published. */
const ON_HOLD: AlertEventSnapshot = {
	type: "registration",
	status: "valid",
	domain: "example.com",
	expiresAt: "2027-03-11T00:00:00.000Z",
	daysUntilExpiry: 154,
	registrar: "Example Registrar, LLC",
	eppStatuses: ["clientTransferProhibited", "serverHold"],
};

describe("snapshotLines for a registration", () => {
	test("names the domain, its expiry, its registrar and the registry's statuses", () => {
		expect(snapshotLines(ON_HOLD)).toEqual([
			"Domain: example.com",
			"Status: valid",
			"Expires at: 2027-03-11T00:00:00.000Z",
			"Registrar: Example Registrar, LLC",
			"Registry statuses: clientTransferProhibited, serverHold",
		]);
	});

	test("writes a dash for every detail the registry did not publish", () => {
		let lines = snapshotLines({
			...ON_HOLD,
			status: "error",
			expiresAt: null,
			registrar: null,
			eppStatuses: [],
		});

		expect(lines).toContain("Expires at: —");
		expect(lines).toContain("Registrar: —");
		expect(lines).toContain("Registry statuses: —");
	});
});

describe("alertMessage for a registration", () => {
	test("carries the registration snapshot and its kind to a webhook receiver", () => {
		let message = alertMessage({
			monitorId: "monitor-1",
			monitorType: "registration",
			monitorName: "Acme",
			eventType: "down",
			snapshot: ON_HOLD,
			dashboardUrl: "https://uptime.sergiodxa.com/app/acme/dns/monitor-1",
			incident: null,
			occurredAt: new Date("2026-10-08T12:00:00.000Z"),
		});

		expect(message.data).toMatchObject({
			monitorType: "registration",
			snapshot: {
				type: "registration",
				eppStatuses: ["clientTransferProhibited", "serverHold"],
			},
		});
		expect(message.text).toContain("Registry statuses: clientTransferProhibited, serverHold");
	});
});
