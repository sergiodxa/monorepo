import { Polar } from "@polar-sh/sdk";
import { env } from "cloudflare:workers";
export default new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
