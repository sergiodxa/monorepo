import { z } from "zod";

export const upgradeSchema = z.object({
	email: z.string().email("Invalid email address"),
	source: z.string().optional(),
	campaign: z.string().optional(),
	medium: z.string().optional(),
	referral: z.string().optional(),
});

export type UpgradeInput = z.input<typeof upgradeSchema>;
export type UpgradeOutput = z.output<typeof upgradeSchema>;
