import { APIClient } from "@edgefirst-dev/api-client";
import { z } from "zod/v4";

export class Google extends APIClient {
	static async user(accessToken: string) {
		let response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!response.ok) {
			throw new Error("Failed to fetch user information from Google");
		}

		let data = await response.json();

		return z
			.object({
				sub: z.string(),
				name: z.string(),
				given_name: z.string(),
				family_name: z.string(),
				picture: z.url(),
				email: z.email(),
				email_verified: z.boolean(),
				hd: z.string(),
			})
			.parse(data);
	}
}
