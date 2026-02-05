import { env } from "cloudflare:workers";
import { Resend } from "resend";
export default new Resend(env.RESEND_API_TOKEN);
