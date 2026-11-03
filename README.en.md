# 4horizon

**Play up to four [Poke Horizon Idle](https://pokehorizonidle.com) accounts side by side**, with a live Summary of each account, Windows notifications for what matters, and an Overview of your day.

*Em português: [README.md](README.md) (ou, em texto simples para o Bloco de Notas, [ComoUsar.txt](ComoUsar.txt))*

GitHub: https://github.com/venom1337idle/4horizon

> 4horizon is a fan-made tool. It is **not** made by, endorsed by or affiliated with the developers of Poke Horizon Idle, nor with Nintendo, Game Freak or The Pokémon Company.
> Check the game's rules before you use it: you use it at your own risk.

## What it does

- **Up to four game panels** in one window (Settings › Game panels: 1 to 4). Each panel keeps its own login.
- **Summary** of each account, or of all of them: gold, XP and kills per hour, the team, the session, supplies, drops, the best catch, and a comparison with your best hunts.
- **Overview**: a table of all accounts, the incubators (eggs as countdown rings), the latest captures (with filters and sorting), and **Today**: shinies, great catches, valuable drops, hatched eggs, evolutions and new hunts from 00:00 to 23:59.
- **History** of your daily totals.
- **Windows notifications**: a shiny, a great catch, a valuable drop, supplies running low, an account that stops hunting, a new hunt, a battle pass mission, a daily mission goal, an egg ready to hatch. With quiet hours, and a **silent mode** button.
- **Buttons for each panel**: Centro, Market, Mochila, Hunts, *Back to last hunt*, zoom.
- **Log in all** with saved logins (the passwords are encrypted, see below).
- **Popup tidy**: after a login it closes the announcement, closes the Hunt Analyzer and collapses the chat.
- **Economy mode**: hides the game screens while you are away (the games keep hunting), and saves most of the CPU.
- Minimize to tray, start with Windows, English and Portuguese.
- **Diagnostics** (Settings › Diagnostics): a self-check and a report to send when something is wrong.

## Install

You need **Windows 10 or 11** (64-bit). Other systems are not tested.

### The easy way: the installer

1. Download **`4horizon-Setup-x.y.z.exe`** from the [Releases page](https://github.com/venom1337idle/4horizon/releases/latest).
2. Run it. Windows may say *"Windows protected your PC"*: the installer is not code-signed (signing costs money every year). Click **More info › Run anyway**.
3. Choose where to install it (or keep the default). It puts **4horizon** in the Start menu and on the desktop. No administrator rights are needed.

**To update**: when a new version is out, an **Update** button shows at the top of the window, next to the version number; it opens the new version's page. Download the new installer and run it: your settings, history and saved logins are kept.
**To uninstall**: Windows Settings › Apps › 4horizon. Your settings, history and saved logins stay in `%APPDATA%\4horizon`; delete that folder too if you want them gone.

### From the source code

You also need **[Node.js](https://nodejs.org) (the LTS version)**.

1. Download this project: the green **Code** button › **Download ZIP**, then unzip it (or `git clone https://github.com/venom1337idle/4horizon.git`).
2. Open PowerShell in the project folder (the one with `package.json`) and run:
   ```
   npm install
   npm start
   ```
3. Optional: a desktop icon that starts it without a console window. In the same PowerShell window:
   ```powershell
   $app = (Get-Location).Path
   $s = (New-Object -ComObject WScript.Shell).CreateShortcut("$HOME\Desktop\4horizon.lnk")
   $s.TargetPath = "$app\node_modules\electron\dist\electron.exe"; $s.Arguments = '.'; $s.WorkingDirectory = $app; $s.IconLocation = "$app\icon.ico"; $s.Save()
   ```

To update: quit the app from the tray, replace the files of the folder with the new ones (or `git pull`), then `npm install` and start it again.

## Your data, and what the app reads

**What it reads from the game.** The app reads the messages the game page receives from the game's server (the same data the game shows you), through Chromium's own developer tools (the "debugger"). This reading never sends anything to the game and never changes its messages.
From those messages it keeps **only what it shows you**: rates, counts, the team, captures, drops. Nothing is sent anywhere.

**What it does in the game.** Only what you ask for, by pressing the game's own buttons in the page, as you would: the panel buttons (Centro, Market, Mochila, Hunts, *Back to last hunt*), the Analyzer button, *Log in all* (it fills the game's login form), and popup tidy (it closes the announcement and the Hunt Analyzer and collapses the chat after a login; to switch it off, set `"enabled": false` in `tidy-settings.json` in the user-data folder).
In the diamond shop, the donation buttons cannot be pressed inside the app: a link takes you to the game's official page instead.

**Where your data lives.** History, notification and tidy settings and your saved logins are kept in the app's user-data folder in your Windows profile (`%APPDATA%\4horizon`), never in the app folder.

**Saved logins.** Passwords are encrypted with Windows' own protection (DPAPI, through Electron's `safeStorage`): they can only be read by your Windows user on your computer. If encryption is not available, passwords are not saved at all. They are never written in plain text, never logged, and never sent to the app's window.
*Be aware*: this protects them from other users of the computer and from someone who copies the file, **not** from a program running as you (malware).

**The game panels are locked down.** They get no permission (camera, microphone, location, notifications, devices...) except writing to the clipboard and full screen; they can only open the game's own address; WebRTC cannot discover your network address. Links the game opens go to your normal browser.

**What else the app contacts.** Besides the game: [PokéAPI](https://pokeapi.co), once, for the names of the Pokémon (saved after that), PokéAPI's sprites on GitHub for the pictures of the Pokémon, and 4horizon's list of releases on GitHub (shortly after the start and every 6 hours, to know whether a new version is out). Like any web request, these see your IP address; they get nothing about you or your accounts. There is no analytics or telemetry of any kind.

**The Diagnostics report** contains names of message types and fields, counts and true/false settings, never values from the game, passwords or e-mails. Character names are hidden by default.

More in [SECURITY.md](SECURITY.md) (also as plain text: [SECURITY.txt](SECURITY.txt)).

## Something does not work?

Open **Settings › Diagnostics**, look at the self-check, then copy the **report** and paste it in a [new issue](https://github.com/venom1337idle/4horizon/issues) with a few words about what you did and what happened.

## For developers

- `npm test` runs every test (about 50 suites): see [test/README.md](test/README.md).
- `npm run dist` builds the Windows installer into `dist/` (on Windows). Pushing a version tag (`git tag v1.0.0`, `git push --tags`) makes GitHub build it and put it in a draft release.
- The texts: English in the code, Portuguese in `test/window/pt/`: see [test/README.md](test/README.md).
- The game data files (`hunt-data.js`, `game-data.json`) and how they are built: see [tools/README.md](tools/README.md).

## License

[MIT](LICENSE) © venom1337idle
