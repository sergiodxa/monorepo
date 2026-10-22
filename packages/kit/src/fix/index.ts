/**
 * Repairs `sdxc doctor` findings the kit can apply safely: command-shaped fixes, missing
 * `.env.example` secrets, and unambiguous model or email registration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { fixCommands, parseFixCommand } from "./commands.js";
export { fixEmails } from "./emails.js";
export { fixEnv, planEnvFix } from "./env.js";
export { fixModels } from "./models.js";
