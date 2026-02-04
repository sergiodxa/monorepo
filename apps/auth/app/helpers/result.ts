interface Success<T> {
	status: "success";
	payload: T;
}

interface Failure {
	status: "failure";
	error: { code: string; description: string };
}

export function success<T>(payload: T): Success<T> {
	return { status: "success", payload };
}

export function failure(code: string, description?: string): Failure {
	return { status: "failure", error: { code, description: description ?? "" } };
}
