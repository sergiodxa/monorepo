/**
 * `sdxc setup billing`: `@sdxc/billing` provider initializer, webhook route stub, checkout
 * secrets and an empty product catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { CONFIG_FILE, ENV_EXAMPLE_FILE, declaredBindings, exampleKeys } from "../doctor/env.js";

import type { SetupPlan } from "./plan.js";

import { creditSetupFiles } from "./credit.js";
import { readProjectFile } from "./plan.js";

/** Builds the billing setup plan for `provider` (currently only `polar`). */
export async function planBilling(
	root: string,
	provider: string,
): Promise<Result<SetupPlan, Error>> {
	if (provider !== "polar") {
		return failure(
			new Error(`Unknown billing provider "${provider}"; this release ships polar only`),
		);
	}
	let config = await readProjectFile(root, CONFIG_FILE);
	if (isFailure(config)) return config;
	let example = await readProjectFile(root, ENV_EXAMPLE_FILE);
	let exampleText = isFailure(example) ? "" : example.data;
	let bindings = declaredBindings(config.data);
	let listed = exampleKeys(exampleText);
	let secrets = ["POLAR_ACCESS_TOKEN", "POLAR_WEBHOOK_SECRET"] as const;
	let configAfter = config.data;
	let exampleAfter = exampleText;
	let edits: SetupPlan["edits"] = [];
	for (let key of secrets) {
		if (!bindings.has(key)) {
			let env = /env\s*:\s*\{/.exec(configAfter);
			if (env === null || env.index === undefined) {
				return failure(new Error(`${CONFIG_FILE} has no env: { … } block to edit`));
			}
			let start = env.index + env[0].length;
			configAfter = `${configAfter.slice(0, start)}\n\t\t\t${key}: bindings.secret(),${configAfter.slice(start)}`;
		}
		if (!listed.has(key)) {
			exampleAfter =
				exampleAfter === ""
					? `${key}=\n`
					: exampleAfter.endsWith("\n")
						? `${exampleAfter}${key}=\n`
						: `${exampleAfter}\n${key}=\n`;
		}
	}
	if (configAfter !== config.data) {
		edits.push({ path: CONFIG_FILE, before: config.data, after: configAfter });
	}
	if (exampleAfter !== exampleText) {
		edits.push({ path: ENV_EXAMPLE_FILE, before: exampleText, after: exampleAfter });
	}
	let files = await creditSetupFiles(root, [
		{ path: "app/initializers/billing.ts", content: BILLING_INITIALIZER },
		{ path: "config/products.ts", content: PRODUCTS },
		{ path: "app/http/controllers/billing-webhook.ts", content: WEBHOOK },
	]);
	return success({
		feature: "billing",
		provider,
		files,
		edits,
		dependencies: ["@sdxc/billing"],
		notes: [
			"Map the webhook route and pass polar into the handlers that need it.",
			"Replace the placeholder product ids in config/products.ts with Polar's.",
			"Run sdxc run typegen after the secrets land.",
		],
	});
}

const BILLING_INITIALIZER = `/**
 * The billing platform this app sells through, configured once. Call sites name a product by
 * our own slug; vendor ids live only here and in config/products.ts.
 */

import { PolarBilling } from "@sdxc/billing/providers/polar";
import { env } from "cloudflare:workers";

import { PRODUCTS } from "~/config/products";

/** The billing platform, reached through the vendor-neutral contract. */
export const polar = new PolarBilling({
	accessToken: () => env.POLAR_ACCESS_TOKEN,
	webhookSecret: () => env.POLAR_WEBHOOK_SECRET,
	products: PRODUCTS,
	meters: {},
});
`;

const PRODUCTS = `/**
 * Product slugs this app sells, mapped to the vendor's product ids. Fill the ids before the
 * first checkout; call sites import the slug constants, never the vendor ids.
 */

/** Our own name for the subscription sold, and the only product until more are added. */
export const DEFAULT_PRODUCT = "default";

/** Slug → Polar product id. Replace the placeholder before going live. */
export const PRODUCTS: Record<string, string> = {
	[DEFAULT_PRODUCT]: "00000000-0000-4000-8000-000000000000",
};
`;

const WEBHOOK = `/**
 * Polar webhook endpoint: verify the signature and hand the event to @sdxc/billing.
 */

import { createController } from "remix/router";

import { polar } from "~/app/initializers/billing";

/** Accepts Polar webhook deliveries. */
export default createController({
	async post(ctx) {
		await polar.webhooks.handle(ctx.request);
		return new Response(null, { status: 204 });
	},
});
`;
