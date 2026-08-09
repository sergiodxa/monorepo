use fs

# The filesystem capability, exercised directly against each test's own fresh
# workspace. fs tools need no grant and spawn no child, so these are the fastest
# meta specs: every case reads and writes real files inside the isolated
# workspace and asserts through the fs observables.

test "a write is read back verbatim" {
	given {
		write "notes.txt" "remember the milk"
	}
	when {
		let content = read "notes.txt"
	}
	then {
		expect content "remember the milk"
	}
}

test "an object is serialized to JSON on write" {
	given {
		# A non-string value is serialized as JSON; a string would be written
		# verbatim.
		write "package.json" { name: "spec", version: "1.0.0" }
	}
	then {
		expect file "package.json" exists
		# The quoted key/value pairs prove it is JSON, not some object rendering.
		expect file "package.json" contains "\"name\": \"spec\""
		expect file "package.json" contains "\"version\": \"1.0.0\""
	}
}

test "mkdir, copy, and remove move files around the workspace" {
	given {
		mkdir "src"
		write "src/index.ts" "export const answer = 42"
	}
	when {
		copy "src/index.ts" "dist/index.ts"
		remove "src/index.ts"
		# `exists` yields a boolean; bind it so a value-form expect can compare
		# it against false (the observable form only asserts a path is present).
		let originalGone = exists "src/index.ts"
	}
	then {
		# The directory and the copy survive; the original is gone.
		expect directory "src" exists
		expect file "dist/index.ts" exists
		expect file "dist/index.ts" contains "answer = 42"
		expect originalGone false
	}
}

test "the existence observables report presence and absence" {
	given {
		write "present.txt" "here"
		mkdir "assets"
	}
	when {
		# `exists` returns a boolean value; bind both to compare directly.
		let present = exists "present.txt"
		let missing = exists "missing.txt"
	}
	then {
		expect present true
		expect missing false
		# `file`/`directory ... exists` are self-asserting observables.
		expect file "present.txt" exists
		expect file "present.txt" contains "here"
		expect directory "assets" exists
	}
}
