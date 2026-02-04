import { WELL_KNOWN } from "~/config";

export function loader() {
	return Response.json(WELL_KNOWN);
}
