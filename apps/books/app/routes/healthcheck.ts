/**
 * Health check route whose loader returns a plain-text "OK" with a 200 status,
 * giving uptime monitors and load balancers a lightweight endpoint to confirm the
 * worker is running without exercising any application logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@pkg/http/response";
import { Ok } from "@pkg/http/status-code";

export function loader() {
	return text("OK", Ok);
}
