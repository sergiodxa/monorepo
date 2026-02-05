import { AuthSDK } from "@pkg/auth-sdk";
import { env } from "cloudflare:workers";

export default new AuthSDK({
	client: { id: env.CLIENT_ID, secret: env.CLIENT_SECRET },
});
