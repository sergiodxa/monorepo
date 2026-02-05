import { z } from "zod";

export function isUUID(value: unknown) {
	return z.string().uuid().safeParse(value).success;
}
