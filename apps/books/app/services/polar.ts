import { Polar } from "@polar-sh/sdk";
import { env } from "cloudflare:workers";

if (!env.POLAR_ACCESS_TOKEN) {
	throw new Error("POLAR_ACCESS_TOKEN is required");
}

export default new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
