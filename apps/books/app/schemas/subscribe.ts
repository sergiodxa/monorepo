import { z } from "zod";

export const subscribeSchema = z.object({
	email: z.string().email("Invalid email address"),
	source: z.string().optional(),
	campaign: z.string().optional(),
	medium: z.string().optional(),
	referral: z.string().optional(),
});

export type SubscribeInput = z.input<typeof subscribeSchema>;
export type SubscribeOutput = z.output<typeof subscribeSchema>;
