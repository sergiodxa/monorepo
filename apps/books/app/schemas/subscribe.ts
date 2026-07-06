/**
 * Zod schema and inferred input/output types for the newsletter subscribe form,
 * validating the email address and capturing optional UTM source, campaign, medium,
 * and referral fields so subscribe requests share one validated shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

export const subscribeSchema = z.object({
	email: z.email({ message: "Invalid email address" }),
	source: z.string().optional(),
	campaign: z.string().optional(),
	medium: z.string().optional(),
	referral: z.string().optional(),
});

export type SubscribeInput = z.input<typeof subscribeSchema>;
export type SubscribeOutput = z.output<typeof subscribeSchema>;
