use cli

# The process-execution capability, exercised directly (no child `spec`). These
# tests run `echo` and `sh` — POSIX-stable, present everywhere — so the dogfood
# run must grant them: the wrapper in src/dogfood.test.ts passes
# --allow-run=spec,echo,sh, and --allow-host-fs=spec for the tests that run a
# program inside this suite's own directory. `spec` is granted for the meta
# suites. Everything here observes the result shapes directly, so it is fast and
# CI-safe.

test "run captures stdout and a zero exit code" {
	when {
		let result = run "echo" "hello"
	}
	then {
		# echo writes its argument and a trailing newline, then exits 0.
		expect result.exit_code 0
		expect result.stdout "hello\n"
	}
}

test "a non-zero exit is reported verbatim" {
	when {
		# `spec` against a missing suite directory exits 2 (a load error): a
		# stable way to observe a non-zero exit using only the granted
		# executables, since `echo` always succeeds. The child resolves the
		# missing directory against its fresh, empty workspace.
		let result = run "spec" "run" "no-such-suite-directory"
	}
	then {
		expect result.exit_code 2
	}
}

test "run takes the directory a program runs in with `in`" {
	when {
		# `in` resolves against the directory `spec run` was invoked from, which
		# for the dogfood run is the package, so `spec` is this suite.
		let result = run "sh" "-c" "test -f cli.spec && echo found" in "spec"
	}
	then {
		expect result.exit_code 0
		expect result.stdout "found\n"
	}
}

test "start returns while the program keeps running, and output shows what it printed" {
	when {
		let server = start "sh" "-c" "echo ready; sleep 30"
	}
	then {
		eventually within 5s {
			expect output server contains "ready"
		}
	}
}

# Starts a program that announces itself and waits for the announcement, so what
# follows acts on a process that is already running.
command start_announced {
	let server = start "sh" "-c" "echo started; sleep 30"
	eventually within 5s {
		expect output server contains "started"
	}
	return server
}

test "stop ends a started program and reports everything it printed" {
	given {
		let server = start_announced
	}
	when {
		let stopped = stop server
	}
	then {
		expect stopped.output "started\n"
	}
}
