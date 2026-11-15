<p align="center">
  <img src="./ui/icon.png" width="112" alt="Wintermas — free seasonal desktop effects for Windows">
</p>

<h1 align="center">Wintermas — Interactive Desktop Snow, Rain & Autumn for Windows</h1>

<p align="center">
  <strong>Turn your Windows desktop into a living winter, rainy day, or autumn scene.</strong><br>
  Free, independent, KoiArt-inspired desktop effects with snowmen, Santa, Christmas decorations, leaf piles and an animated snowplow.
</p>

<p align="center">
  <a href="https://github.com/mohammadrezasmz2/Wintermas/releases"><img alt="Download free Windows installer" src="https://img.shields.io/badge/Download-Windows%20x64%20installer-3778C2"></a>
  <img alt="Snow, Rain, Autumn" src="https://img.shields.io/badge/Themes-Snow%20%7C%20Rain%20%7C%20Autumn-C08A40">
  <img alt="Free for noncommercial use" src="https://img.shields.io/badge/License-PolyForm%20Noncommercial-448465">
  <img alt="Built with Electron" src="https://img.shields.io/badge/Built%20with-Electron-47848F">
</p>

**[Download latest Windows preview](https://github.com/mohammadrezasmz2/Wintermas/releases/tag/v0.2.1-preview.22)** · **[Product overview & FAQ](https://designclup.com/wintermas/)** · **[Watch demo](./demo/demo.mp4)** · **[Source for current preview features](https://github.com/mohammadrezasmz2/Wintermas/tree/fix/separate-weather-and-taskbar-art)**

Wintermas is a free-to-download, interactive **Windows desktop snowfall, rain and falling-leaves application**. Weather effects surround your existing windows instead of replacing your wallpaper. Snow settles on window ledges; autumn leaves accumulate in piles; snowballs, snowmen, Santa Claus and seasonal decorations make the desktop interactive.

### NEW: hide bottom-edge effects in selected Windows applications

Open Wintermas settings and expand **Hide bottom effects in selected apps**. Enter executable names, one per line (for example, `SLDWORKS.exe` or `Inventor.exe`). **SolidWorks is preconfigured.** While a matching window is open, snow and leaf accumulations at the bottom of its horizontal area are hidden, and falling particles and decorative objects stay out of application interiors. This affects the lower desktop edge; snow on allowed window tops remains available.

**Mouse behavior:** Ordinary clicks no longer spontaneously create snowballs near the pointer. Use **Make snowball** or the deliberate **Ctrl+click on a snowbank** interaction instead. In Rain mode, long straight wet-edge stripes are no longer drawn; animated raindrop impacts and brief splashes remain.

### NEW: choose whether effects settle on desktop icons

The **Weather on desktop icons** switch follows your selected theme, with **three separately saved preferences**: *Snow on desktop icons*, *Rain on desktop icons*, and *Leaves on desktop icons*. Snow creates tiny caps on icon crests, rain adds splashes and temporary wet highlights, and autumn leaves can gather on the upper edges of app icons and folders. Turn any of these off to keep shortcuts clear while weather elsewhere continues normally. The icon detection/contour placement is restored to the **Preview 18 method** in response to visual feedback, while preserving newer snowbank stability and drag effects.

> **Independent project, not an official KoiArt product.** Wintermas is an unofficial Windows alternative **inspired by** [KoiArt](https://koiart.app/), not made, sponsored, or endorsed by KoiArt. "Free" here means free to download and use **for permitted noncommercial purposes** under the repository's [PolyForm Noncommercial 1.0.0 license](./LICENSE). Commercial use requires separate permission.

## Preview

[![Watch Wintermas winter desktop animation and snow effects](./demo/preview.jpg)](./demo/demo.mp4)

[Watch / download the desktop demo video (MP4)](./demo/demo.mp4). *The existing demo shows the winter experience; autumn, expanded animations and controls are part of newer preview builds.*

## Features: three independent seasonal weather themes

### ❄️ Snow — interactive winter and Christmas effects

- **Snowfall on Windows:** animated particles drift over the desktop and accumulate on open-window edges and above the taskbar. Effects are masked over app contents.
- **Custom controls:** adjust snowfall intensity, snow speed, wind and **snowflake diameter (2–12 px)**.
- **Window movement:** moving or minimizing a window can dislodge its snow into small falling powder particles instead of leaving a rigid white line.
- **Snowballs and snowmen:** roll snowballs with the mouse, throw them, and **stack three balls to build a snowman**.
- **Santa Claus & gifts:** send Santa's sleigh across the lower desktop; completed snowmen can trigger visits and gifts nearby. Without snowmen, Santa can leave a Christmas tree.
- **Automatic snowplow:** the animated plow pushes accumulated snow and can collect snowballs, snowmen, gifts and trees. It can start automatically when enough snow builds up.
- **Christmas decorations:** hang garlands, customize light colors, place Christmas trees and interact with gifts.

### 🌧️ Rain — animated desktop rain

- Switch to a separate Rain theme with falling raindrops and splashes.
- See water interact with window edges, including wet surfaces and dripping effects.
- Adjust rain speed and intensity. Switching modes clears the previous mode's effects.

### 🍁 Autumn — realistic-looking falling leaves

- Yellow, orange, red and brown **maple, oak and oval leaves** rotate and flutter in the wind.
- Leaves gather into layered, irregular piles on window ledges and along the bottom of the desktop.
- **Interact with leaves using the mouse:** swipe through falling leaves or disturb settled piles to throw them back into the air.
- Send the snowplow as a **leaf sweeper** to collect leaf piles, with an animated pile at its blade.
- Adjust leaf speed, intensity and wind independently from Snow and Rain.

## How to use Wintermas

| Action | What to do |
| --- | --- |
| Switch seasons | Open the Wintermas tray icon and select **Snow**, **Rain**, or **Autumn**. |
| Snow, rain, or leaves on icons | Use **Snow / Rain / Leaves on desktop icons** in the panel. Each season's setting is independent and remembered. |
| Tune effects | Use the panel's intensity, wind, speed and (in Snow) snow diameter controls. |
| Make a snowball | Choose **Make snowball**, or Ctrl+click an accumulated snowbank. |
| Build a snowman | Move and stack three snowballs. |
| Send Santa | Select **Send Santa**; Santa can also visit automatically after a snowman is finished. |
| Clear snow or leaves | Select the snowplow / leaf sweeper; accumulation may also trigger automatic cleanup. |
| Decorate | Choose **Place tree** or **Hang garland** and place decorations with the mouse. |
| Play with leaves | In Autumn, move the cursor rapidly near falling or settled leaves. |
| Open settings | Use the Windows system tray icon; the app can stay out of the way when the panel is closed. |

**Snowball shortcut:** `Alt + Shift + B` over a snowbank.

## Download and install

**Windows 64-bit (x64).** Download the **[latest available release](https://github.com/mohammadrezasmz2/Wintermas/releases)**, or get the current development preview:

**[Wintermas v0.2.1 Preview 21 — download Windows setup (.exe)](https://github.com/mohammadrezasmz2/Wintermas/releases/download/v0.2.1-preview.22/Wintermas-Setup.exe)**

The preview release also provides a **[SHA-256 checksum](https://github.com/mohammadrezasmz2/Wintermas/releases/download/v0.2.1-preview.22/Wintermas-Setup.exe.sha256)**.

1. Download the EXE from this repository's official GitHub Releases.
2. Check the SHA-256 digest against the published checksum if you wish to verify download integrity.
3. Install Wintermas and launch it from Windows.
4. Open the tray icon and enable your favorite theme.

**Security:** Preview installers may be **unsigned**. A matching checksum confirms file integrity relative to the release, **not** that the software is safe. If antivirus reports a detection, investigate it rather than disabling security protections. You can uninstall Wintermas from **Windows Settings → Apps → Installed apps**.

**Source code note:** The `main` branch contains the current development source for the three themes, icon weather controls and taskbar fixes. Each downloadable preview is frozen under its own [release tag](https://github.com/mohammadrezasmz2/Wintermas/releases); Preview 22 retains the Preview 18 icon recognition method and the weather-on-icons switches, and adds app-specific bottom-edge exclusions, cursor-snow safeguards and invisible rain wet-edge stripes.

## Frequently asked questions

**Is Wintermas the free version of KoiArt?**  
No. Wintermas is a **free, independent, unofficial KoiArt-inspired alternative for Windows**, not an official KoiArt edition or affiliated product.

**Is Wintermas really free?**  
The downloadable application is offered at no cost for permitted noncommercial use. Source-code use and redistribution are subject to [PolyForm Noncommercial 1.0.0](./LICENSE); commercial use is not automatically permitted.

**Can snow collect on top of app windows?**  
Yes. In Snow mode, snowbanks can settle on the upper edges of open windows, and window movement can shake particles loose. Rendering may vary by application and Windows configuration.

**Can I make snowmen and interact with leaves?**  
Yes. Stack snowballs into snowmen in Snow mode, or move your mouse through loose leaves and leaf piles in Autumn mode.

**Does it run on macOS?**  
Wintermas targets **Windows x64**. KoiArt is a separate product for macOS.

## Build from source

Build on Windows x64 with Node.js 22 or newer, npm and the Windows .NET Framework compiler used by the native helper:

```powershell
npm.cmd ci
npm.cmd exec -- install-electron
npm.cmd start
```

To package the Windows installer:

```powershell
npm.cmd run build
```

The NSIS build writes `dist/setup/Wintermas-Setup.exe`. To reproduce a specific preview installer, check out its release tag (for example, `git checkout v0.2.1-preview.22`) before building.

## Project structure

| Location | Purpose |
| --- | --- |
| `main.js`, `preload.cjs` | Electron app, settings, system tray, native overlay integration |
| `ui/` | Weather renderers, seasonal artwork, interaction and widget interface |
| `native/` | Windows helper tracking window and taskbar geometry |
| `scripts/`, `setup/` | Build and packaging tooling |
| `test/` | Behavior and regression tests in preview development |
| `demo/` | Existing demo and screenshot |

## License, credits and attribution

Wintermas is based on the source-available [amiayweb/Wintermas](https://github.com/amiayweb/Wintermas) project; **credit and the original copyright notice remain with amiayweb**. This fork adds Autumn, additional seasonal interactions, rendering changes and Windows taskbar fixes.

Source code is licensed under [PolyForm Noncommercial 1.0.0](./LICENSE). This repository is not affiliated with, endorsed by or an official version of KoiArt.

---

### معرفی فارسی Wintermas

**وینترمس (Wintermas)** نرم‌افزاری رایگان برای استفاده غیرتجاری در ویندوز است که دسکتاپ را با سه تم **برفی، بارانی و پاییزی** زنده می‌کند. می‌توانی سرعت و قطر برف را تغییر بدهی، روی لبه پنجره‌ها برف جمع کنی، گلوله برفی بسازی، سه گلوله را تبدیل به **آدم‌برفی** کنی و با **بابانوئل، هدیه‌ها، درخت کریسمس، چراغ‌های تزئینی و ماشین برف‌روب** تعامل داشته باشی. در پاییز، برگ‌ها روی هم جمع می‌شوند و به حرکت ماوس واکنش نشان می‌دهند. Wintermas یک جایگزین مستقل، الهام‌گرفته از ایده KoiArt برای ویندوز است و نسخه رسمی KoiArt نیست.

**[دانلود Wintermas برای ویندوز](https://github.com/mohammadrezasmz2/Wintermas/releases)** · **[معرفی کامل نرم‌افزار](https://designclup.com/wintermas/)**
