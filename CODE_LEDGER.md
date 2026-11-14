# دفتر پروژه: Wintermas

## هسته برنامه (Core)
Electron برای ویندوز: یک ویجت (`ui/index.html`) و برای هر مانیتور یک overlay شفاف و click-through (`ui/overlay.html`).
`native/desktop.exe` (از `Desktop.cs`) موقعیت پنجره‌ها و تسک‌بار را خط‌به‌خط JSON می‌فرستد؛ `main.js` آن را به مختصات هر مانیتور تبدیل و به overlay می‌دهد.
overlay: برف (WebGL یا Canvas2D)، توده‌های برف روی لبهٔ پنجره‌ها، گلوله/آدم‌برفی، بابانوئل، تزئینات و از v0.2 باران.

## فایل‌ها
| فایل | نقش |
|---|---|
| main.js | پنجره‌ها، تنظیمات، tray، IPC، helper |
| diagnostics.js | فایل لاگ تشخیصی (v0.2) |
| preload.cjs | پل امن `window.wintermas` |
| ui/overlay.js | حلقهٔ انیمیشن و فیزیک برف/تزئینات |
| ui/frame-pacing.js | زمان‌بندی فریم هم‌گام با vsync (v0.2) |
| ui/perf-monitor.js | آمار فریم برای لاگ (v0.2) |
| ui/rain.js, ui/rain-renderer.js | تم بارونی (v0.2) |
| ui/snow-renderer.js, snow-art.js, christmas-decor.js, garland-physics.js, geometry.js, snow-motion.js, snow-profile.js | رندر و فیزیک |
| ui/index.html, panel.js, panel.css | ویجت |
| native/Desktop.cs | helper ویندوزی |

## بخش‌های تأییدشده و قفل (Locked)
| # | ویژگی | فایل :: نمادها | تاریخ تأیید |
|---|---|---|---|
| L1 | همهٔ کد v0.1.0 (پایهٔ دریافتی از GitHub) | همهٔ فایل‌ها، به‌جز محدوده‌های اعلام‌شده در v0.2 | 2026-11-14 |

## رفتارهای تأییدشده (Approved behaviors)
| # | رفتار | کد مرتبط |
|---|---|---|
| B1 | برف روی لبهٔ بالای پنجره‌ها و تسک‌بار می‌نشیند و با جابه‌جایی یا تغییر اندازهٔ پنجره می‌ریزد | overlay.js :: desktop, addPile, spill |
| B2 | ۷ دکمهٔ action در ویجت (تست smoke به آن وابسته است) | index.html `[data-action]` |
| B5 | هیچ ویجتی روی دسکتاپ نمی‌ماند؛ پنل فقط با کلیک روی آیکون کنار ساعت باز و با کلیک بیرون بسته می‌شود (خواستهٔ کاربر، v0.2.0) | main.js :: placeFlyout, togglePanel |
| B3 | حالت برف با رنگ‌های سبز کریسمسی ویجت؛ پیش‌فرض هوا = برف | panel.css, main.js `defaults` |
| B4 | تنظیمات قبلی کاربر بعد از به‌روزرسانی حفظ می‌شود | main.js :: start |

## تاریخچه تغییرات
| نسخه | پایه | درخواست | نمادهای تغییرکرده | نمادهای جدید | چکر | وضعیت |
|---|---|---|---|---|---|---|
| v0.2 | v0.1.0 (2420dc2) | روان‌تر شدن، تم بارونی، فایل لاگ | main.js: top-level, trayMenu, refreshOverlays, update, broadcastGeometry, startTracking, start · overlay.js: imports, resize, desktop, configure, updateParticles, frame, drawScene · Desktop.cs: Main · preload, package.js, index.html, overlay.html | diagnostics.js, frame-pacing.js, perf-monitor.js, rain.js, rain-renderer.js, snowStepInPlace, geometryChanged, staticSceneInterval, applyWeather, meltSnow, updateWeather, `.weather`, `body.theme-rain` | PASS | منتظر تأیید کاربر |
| v0.2.0 | v0.2 | حذف ویجت بالای دسکتاپ، پنل کنار ساعت، نسخه 0.2.0 برای ساخت exe | main.js: showPanel, hidePanel, sizeWidget, smokeTest, start · panel.js: toggle/close/Esc/garland · index.html: Close · README, version | placeFlyout, togglePanel, pinWidget, `body.flyout` | PASS | منتظر تأیید کاربر |

## پیشنهادهای معلق (اجرا نشده)
- مانیتورهای 120/144Hz فعلاً روی ~۶۰–۷۲fps قفل‌اند تا CPU کم مصرف شود؛ اگر خواستی، یک گزینه برای رندر با رفرش کامل.
- شتک‌های باران در Canvas 2D کشیده می‌شوند؛ اگر لاگ روی سیستم ضعیف فریم کند نشان داد، می‌شود آن‌ها را هم به WebGL برد.
- برای انتشار نسخهٔ جدید، `version` در `package.json` و `.github/version.svg` باید دستی بالا برود.
- آب‌شدن گلوله‌ها و آدم‌برفی‌ها زیر باران (عمداً اضافه نشد).
