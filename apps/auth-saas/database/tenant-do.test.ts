/**
 * Drives the tenant Durable Object by construction, against a real SQLite database, the
 * way other Durable Objects in this repo are tested: through `@sdxc/cloudflare-mocks`
 * rather than a stubbed namespace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

describe("provision", () => {
	test("applies the schema and records the tenant's id and issuer", async () => {
		let result = await tenant.provision({
			tenantId: "tenant_1",
			issuer: "https://tenant-1.example.com",
		});

		expect(result).toEqual({
			applied: ["0001-init", "0002-subjects", "0003-passwords", "0004-passkeys"],
			issuer: "https://tenant-1.example.com",
		});

		let rows = [...state.storage.sql.exec(`SELECT * FROM settings`)];
		expect(rows).toEqual([
			{
				tenant_id: "tenant_1",
				issuer: "https://tenant-1.example.com",
				created_at: expect.any(Number),
			},
		]);
	});

	test("updates the issuer on a later boot, applying no new migration", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://old.example.com" });

		// A later boot constructs a fresh object over the same storage, the way a real
		// cold start would; its own migration run finds nothing left to apply.
		let rebooted = new Tenant(state, {} as Cloudflare.Env);
		let result = await rebooted.provision({
			tenantId: "tenant_1",
			issuer: "https://new.example.com",
		});

		expect(result).toEqual({ applied: [], issuer: "https://new.example.com" });

		let rows = [...state.storage.sql.exec<{ issuer: string }>(`SELECT issuer FROM settings`)];
		expect(rows).toEqual([{ issuer: "https://new.example.com" }]);
	});
});

describe("erase", () => {
	test("destroys the object's storage", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });

		let deleteAll = vi.spyOn(state.storage, "deleteAll");
		await tenant.erase();

		expect(deleteAll).toHaveBeenCalledTimes(1);
	});
});
