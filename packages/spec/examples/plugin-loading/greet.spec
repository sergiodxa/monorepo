# A suite that uses a project-declared plugin. The `greet` namespace is not a
# built-in; it comes from spec/config.jsonc in this directory, whose `plugins`
# key launches ./greeter.ts. Because launching a declared plugin runs
# project-declared code, this suite runs only when the caller allows it:
#
#   spec run examples/plugin-loading --allow-plugins
#   spec run examples/plugin-loading --allow-plugins=greet
#
# Without the grant, the run is refused before any plugin starts, naming the
# --allow-plugins flag. Note the spec names `greet.hello`, never a path — the
# manifest is where the plugin's location lives, so this file stays portable.

use greet

test "the greet plugin greets by name" {
	when {
		let message = greet.hello "world"
	}
	then {
		expect message "Hello, world!"
	}
}

test "the greet plugin uppercases text" {
	when {
		let loud = greet.shout "hello"
	}
	then {
		expect loud "HELLO"
	}
}
