# Pi API and Lifecycle Findings

Documentation source: `/Users/raneemabuhasan/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` and the installed TypeScript declarations at `/Users/raneemabuhasan/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.

## 1. How an extension registers a command

`pi.registerCommand(name, { description, handler })` registers a slash command.

- The handler receives `(args, ctx)` where `ctx` is the `ExtensionCommandContext`.
- `ctx.ui.notify(message, type)` displays a visible notification.
- Commands are automatically available as `/name` in the interactive terminal.

## 2. How it displays a notification

`ctx.ui.notify(message, type?)` — type is optional and can be `"info" | "warning" | "error"`.

- This is non-blocking: it does not wait for user interaction or block tools.
- It is available when `ctx.hasUI` is true (covers both TUI and some RPC modes).
- For terminal-only behavior, guard with `ctx.mode === "tui"`.

## 3. How it detects interactive UI availability

Two separate checks exist:

| Check | Meaning |
|-------|---------|
| `ctx.hasUI` | Dialog-capable UI is available (TUI and some RPC interactions) |
| `ctx.mode === "tui"` | Specifically the interactive terminal mode |

Docs note: `ctx.hasUI` alone also covers some RPC interactions, so it is not the same as interactive terminal mode. For our automatic reminder timer, we should guard with `ctx.mode === "tui"`.

## 4. Session startup and shutdown events

### session_start
- Fired when a session is started, loaded, or reloaded.
- Has a `reason` field: `"startup" | "reload" | "new" | "resume" | "fork"`.
- **Critical doc note**: "Do not start processes, sockets, watchers, or timers in the factory because some invocations load extensions without starting a session. Start long-lived resources from `session_start`."
- So our periodic timer MUST be created in a `session_start` handler, NOT in the extension factory.

### session_shutdown
- Fired before an extension runtime is torn down due to quit, reload, or session replacement.
- Has a `reason` field: `"quit" | "reload" | "new" | "resume" | "fork"`.
- Doc note: "Close session-scoped resources from an idempotent `session_shutdown` handler."
- So our timer cleanup MUST happen here.

## 5. What actually happens on reload

## How reload relates to the controller

- `session_shutdown` with `reason: "reload"` fires before the old extension runtime is torn down. However, **each extension instance** can only clear **its own** timer handle. A new controller instance created during reload does not have access to the old instance's handle, so it cannot directly clear it.
- The docs do NOT guarantee that `session_shutdown` for the old instance completes before the new instance's `session_start` fires. Therefore, our controller must be defensive: in `start()`, if a timer already exists on **this** instance, clear it before creating a new one. This protects against repeated `start()` calls on the same controller.
- For cross-instance cleanup, Pi's reload mechanism itself replaces the entire extension runtime. The `session_shutdown` on the old runtime is the correct place for the old instance to clear its resources. Our tests exercise the same-instance case (repeated `start()` on one controller).

## Summary of verified API contracts

| Need | API | Where to call |
|------|-----|---------------|
| Register command | `pi.registerCommand(name, { description, handler })` | Extension factory |
| Show notification | `ctx.ui.notify(message, type?)` | Command handler or event handler |
| Check interactive mode | `ctx.mode === "tui"` | Before starting timers |
| Session start event | `pi.on("session_start", handler)` | After factory setup |
| Session shutdown event | `pi.on("session_shutdown", handler)` | After factory setup |
| Clear timer | Standard `clearInterval(timerId)` | `session_shutdown` handler |

## Verified documentation paths

1. Main extensions doc: `/Users/raneemabuhasan/.local/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
2. Type declarations: `/Users/raneemabuhasan/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
3. Re-exported types: `/Users/raneemabuhasan/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/index.d.ts`
