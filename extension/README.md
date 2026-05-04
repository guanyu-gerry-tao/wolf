# wolf companion extension

Phase 1 is a buildless Chrome MV3 prototype. Load the `extension/` directory as
an unpacked extension in Chrome to inspect the side panel UI.

The side panel is window-scoped: switching tabs in the same Chrome window keeps
the panel open. It talks to a future `wolf serve` daemon over
`http://127.0.0.1:<port>`.

The MVP intentionally does not open `file://` preview URLs. Resume and cover
letter preview buttons open daemon-hosted HTTP preview URLs instead.
