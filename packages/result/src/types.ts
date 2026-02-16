export interface Success<T> {
	status: "success";
	data: T;
}

export interface Failure<E extends Error> {
	status: "failure";
	error: E;
}

export type Result<T, E extends Error> = Success<T> | Failure<E>;
