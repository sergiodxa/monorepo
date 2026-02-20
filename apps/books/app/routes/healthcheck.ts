import { text } from "@pkg/http/response";
import { Ok } from "@pkg/http/status-code";

export function loader() {
	return text("OK", Ok);
}
