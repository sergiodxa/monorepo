import { data } from "react-router";

export function ok<T>(value: T, init?: ResponseInit) {
	return data({ ...value, ok: true as const }, { ...init, status: 200 });
}

export function badRequest<T>(value: T, init?: ResponseInit) {
	return data({ ...value, ok: false as const }, { ...init, status: 400 });
}
