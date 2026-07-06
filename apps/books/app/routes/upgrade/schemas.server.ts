/**
 * Server-only Zod schema and inferred types for the upgrade flow form, validating the
 * customer's email and optional UTM source, campaign, medium, and referral fields so
 * the upgrade action can trust its parsed input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

export const upgradeSchema = z.object({
	email: z.email({ message: "Invalid email address" }),
	source: z.string().optional(),
	campaign: z.string().optional(),
	medium: z.string().optional(),
	referral: z.string().optional(),
});

export type UpgradeInput = z.input<typeof upgradeSchema>;
export type UpgradeOutput = z.output<typeof upgradeSchema>;
