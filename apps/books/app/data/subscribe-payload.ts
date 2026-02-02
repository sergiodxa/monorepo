import { Data } from "@edgefirst-dev/data";
import type { FormParser } from "@edgefirst-dev/data/parser";
import { UTMPayload } from "./utm-payload";

export class SubscribePayload extends Data<FormParser> {
	get email() {
		if (!this.parser.has("email")) return void 0;
		return this.parser.string("email");
	}

	get utm() {
		return new UTMPayload(this.parser);
	}
}
