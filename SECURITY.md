# Security

GitHub: https://github.com/venom1337idle/4horizon · *The same text as plain text: [SECURITY.txt](SECURITY.txt)*

## Reporting a problem

If you find a security problem (something that could expose a password, run code that should not run, or let a web page do more than it should), **please do not open a public issue**.
Use GitHub's private report instead: the **Security** tab of this repository › **Report a vulnerability** ([link](https://github.com/venom1337idle/4horizon/security)). You will get an answer there.

Only the latest version is looked after.

## How the app protects you

**The game panels** (`lockdown.js`)
- Every permission a page can ask for is refused (camera, microphone, location, notifications, MIDI, screen capture, reading the clipboard, USB / HID / serial devices...), except writing to the clipboard and full screen. Every refusal is counted in the Diagnostics.
- Before a panel starts, its settings are forced: no preload script, no Node, context isolation, sandbox, web security on, no insecure content.
- A panel is only created for the game's own address (`https://pokehorizonidle.com`) in one of the four account storages; anything else is refused.
- WebRTC address discovery is off in the panels (policy `disable_non_proxied_udp`).
- Links a game page opens go to the system browser, only `http` and `https`, and not more than a few at once (`external.js`).

**The app's own window**
- Context isolation; the window talks to the main process only through the functions of `preload.js`.
- The main process answers only its own window, never a game panel (each request checks where it comes from).
- Everything that comes from the game and is shown (names, items, messages) is escaped before it is put in the page.

**Saved logins** (`accounts.js`)
- Passwords are encrypted with Electron's `safeStorage` (Windows DPAPI, tied to your Windows user). Without encryption, no password is saved.
- They are never written in plain text, never logged, and never sent to the app's window; they are typed into the game's own login form by the main process.

**Your data** (`datadir.js`)
- History and settings live in the user-data folder (`%APPDATA%\4horizon`), not in the app folder, so that the app folder can be shared or replaced.
- The Diagnostics report holds names of message types and fields, counts and true/false settings: never values from the game, passwords or e-mails. Character names are hidden by default; any file of the app folder that is not the app's own is only counted, not named.

**Reading the game**
- The game's messages are read through Chromium's debugger protocol (`ws-reader.js`): read only. The reading sends nothing to the game and changes nothing.
- Besides the game, the app contacts only PokéAPI (the names of the Pokémon, once) and PokéAPI's sprites on GitHub. No analytics, no telemetry.

## Known limits

- **DPAPI** protects saved passwords from other Windows users and from a copied file, **not** from a program running as you.
- **Scripts in the game pages.** Some features (Log in all, popup tidy, the panel buttons, the Analyzer button) run a short script inside the game page, in the page's own context, so the page's own code could see or disturb it. Only the economy-mode timer runs in an isolated world.
- **Releases are not code-signed** yet: Windows may warn about them. Building from this source with `npm start` avoids that.
- **Electron** is updated with the project; an old copy of the app keeps an old Electron. Update the app.
