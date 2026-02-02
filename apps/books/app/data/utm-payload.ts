import { Data } from "@edgefirst-dev/data";
import type { FormParser } from "@edgefirst-dev/data/parser";

export class UTMPayload extends Data<FormParser> {
	get source() {
		if (this.parser.has("source")) return this.parser.string("source");
		return void 0;
	}

	get campaign() {
		if (this.parser.has("campaign")) return this.parser.string("campaign");
		return void 0;
	}

	get medium() {
		if (this.parser.has("medium")) return this.parser.string("medium");
		return void 0;
	}
}
