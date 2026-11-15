using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

// Query Windows Explorer through UI Automation and normal Shell icon APIs.
// No injection, no Explorer memory writes, and no desktop screenshot capture.
// Only icon rectangles and a few top-edge alpha samples go to Electron;
// file names and paths are NOT transmitted.
static class DesktopIcons {
    const int Columns = 24;
    static DateTime nextScan = DateTime.MinValue;
    static string cached = "[]";
    static readonly Dictionary<string, string> desktopFiles =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    static readonly Dictionary<string, int[]> contourCache =
        new Dictionary<string, int[]>(StringComparer.OrdinalIgnoreCase);
    static DateTime nextFileRefresh = DateTime.MinValue;
    static readonly HashSet<string> shapeQualityCache =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr FindWindow(string className, string title);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string title);
    [DllImport("user32.dll")]
    static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")]
    static extern bool EnumWindows(WindowCallback callback, IntPtr extra);
    delegate bool WindowCallback(IntPtr hwnd, IntPtr extra);
    [DllImport("user32.dll")]
    static extern bool DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")]
    static extern int GetSystemMetrics(int metric);
    [DllImport("user32.dll")]
    static extern uint GetDpiForWindow(IntPtr hwnd);

    // Explorer desktop uses the shell EXTRALARGE image list (normally 48
    // logical pixels), not SHGFI_LARGEICON's ordinary 32px system bitmap.
    // Use actual stock icons for virtual shell entries like Recycle Bin.
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct SHSTOCKICONINFO {
        public uint cbSize;
        public IntPtr hIcon;
        public int iSysImageIndex;
        public int iIcon;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szPath;
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHGetStockIconInfo(int stockId, uint flags, ref SHSTOCKICONINFO info);

    static IntPtr StockIconForName(string name) {
        string lowered = name.ToLowerInvariant();
        // Stock icon IDs: SIID_RECYCLER = 31; SIID_DESKTOPPC = 94.
        int kind = lowered.Contains("recycle bin") || lowered.Contains("سطل بازیافت") ? 31 :
            lowered == "this pc" || lowered.Contains("این رایانه") ? 94 : -1;
        if (kind < 0) return IntPtr.Zero;
        var info = new SHSTOCKICONINFO();
        info.cbSize = (uint)Marshal.SizeOf(typeof(SHSTOCKICONINFO));
        try {
            // SHGSI_ICON (0x100) + SHGSI_SHELLICONSIZE (0x4)
            if (SHGetStockIconInfo(kind, 0x104, ref info) == 0) return info.hIcon;
        } catch { /* unsupported shell or transient Explorer restart */ }
        return IntPtr.Zero;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct SHFILEINFO {
        public IntPtr hIcon;
        public int iIcon;
        public uint dwAttributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szDisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
        public string szTypeName;
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr SHGetFileInfo(string path, uint attributes,
        out SHFILEINFO info, uint size, uint flags);

    static IntPtr UnderDesktop(IntPtr parent) {
        if (parent == IntPtr.Zero) return IntPtr.Zero;
        IntPtr view = FindWindowEx(parent, IntPtr.Zero, "SHELLDLL_DefView", null);
        return view == IntPtr.Zero ? IntPtr.Zero :
            FindWindowEx(view, IntPtr.Zero, "SysListView32", null);
    }

    static IntPtr DesktopView() {
        IntPtr list = UnderDesktop(GetShellWindow());
        if (list != IntPtr.Zero) return list;
        list = UnderDesktop(FindWindow("Progman", null));
        if (list != IntPtr.Zero) return list;
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hwnd, IntPtr unused) {
            found = UnderDesktop(hwnd);
            return found == IntPtr.Zero;
        }, IntPtr.Zero);
        return found;
    }

    static void RefreshFilePaths() {
        if (DateTime.UtcNow < nextFileRefresh) return;
        nextFileRefresh = DateTime.UtcNow.AddSeconds(20);
        desktopFiles.Clear();
        foreach (var folder in new [] {
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory)
        }) {
            if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder)) continue;
            try {
                foreach (string path in Directory.EnumerateFileSystemEntries(folder)) {
                    string name = Path.GetFileName(path);
                    string stem = Path.GetFileNameWithoutExtension(path);
                    if (!desktopFiles.ContainsKey(name)) desktopFiles[name] = path;
                    if (!desktopFiles.ContainsKey(stem)) desktopFiles[stem] = path;
                }
            } catch { /* one inaccessible folder must not stop snowfall */ }
        }
    }

    // Profile samples mark the FIRST opaque pixel in each vertical icon strip,
    // normalized to 0..1000; -1 means fully transparent space.
    static int[] FallbackContour(string name) {
        // When Explorer does not expose an icon and no real Shell artwork
        // can be retrieved, NEVER fake an arch deep into a file or shortcut.
        // Draw only a shallow horizontal crest near the top of its image box;
        // leave transparent margins clear. No guessed internal "surfaces".
        var values = new int[Columns];
        for (int i = 0; i < Columns; i++) {
            double t = (i + .5) / Columns;
            values[i] = t < .11 || t > .89 ? -1 : 55;
        }
        return values;
    }

    static int[] SampleIcon(IntPtr handle, int[] fallback) {
        if (handle == IntPtr.Zero) return fallback;
        using (var icon = Icon.FromHandle(handle))
        using (var image = icon.ToBitmap()) {
            var sampled = new int[Columns];
            int opaqueBands = 0;
            for (int i = 0; i < Columns; i++) {
                int first = -1;
                int from = Math.Max(0, (i * image.Width) / Columns);
                int to = Math.Min(image.Width,
                    ((i + 1) * image.Width + Columns - 1) / Columns);
                for (int y = 0; y < image.Height; y++) {
                    bool visible = false;
                    for (int x = from; x < to; x++) {
                        if (image.GetPixel(x, y).A >= 110) {
                            visible = true; break;
                        }
                    }
                    if (visible) { first = y; break; }
                }
                sampled[i] = first < 0 ? -1 :
                    (int)Math.Round(first * 1000.0 / image.Height);
                if (first >= 0) opaqueBands++;
            }
            return opaqueBands >= 5 ? sampled : fallback;
        }
    }

    static int[] ReadShape(string name, out bool accurate) {
        accurate = false;
        string path;
        bool hasPath = desktopFiles.TryGetValue(name, out path);
        string cacheKey = hasPath ? path : "$shell:" + name;
        int[] known;
        if (contourCache.TryGetValue(cacheKey, out known)) {
            accurate = shapeQualityCache.Contains(cacheKey);
            return known;
        }
        int[] fallback = FallbackContour(name);
        int[] contour = fallback;
        IntPtr handle = IntPtr.Zero;
        try {
            if (hasPath) {
                SHFILEINFO info;
                // SHGFI_ICON (0x100) | SHGFI_SHELLICONSIZE (0x4).
                // Match Explorer's shell icon, not 32px LARGEICON defaults.
                SHGetFileInfo(path, 0, out info,
                    (uint)Marshal.SizeOf(typeof(SHFILEINFO)), 0x104);
                handle = info.hIcon;
            } else {
                handle = StockIconForName(name);
            }
            if (handle != IntPtr.Zero) {
                contour = SampleIcon(handle, fallback);
                accurate = !Object.ReferenceEquals(contour, fallback);
            }
        } catch { /* keep an ultra-shallow fallback instead of drawing on logos */ }
        finally {
            if (handle != IntPtr.Zero) DestroyIcon(handle);
        }
        if (contourCache.Count > 512) {
            contourCache.Clear();
            shapeQualityCache.Clear();
        }
        contourCache[cacheKey] = contour;
        if (accurate) shapeQualityCache.Add(cacheKey);
        return contour;
    }

    static int scanning = 0;
    public static string Snapshot(bool pointerPressed) {
        if (DateTime.UtcNow >= nextScan &&
            Interlocked.CompareExchange(ref scanning, 1, 0) == 0) {
            // Keep slow UI Automation work OUT of the 8ms native pointer
            // sampling loop; otherwise Explorer scanning stalls drag updates.
            nextScan = DateTime.UtcNow.AddMilliseconds(pointerPressed ? 340 : 850);
            new Thread(delegate() {
                try { Refresh(); }
                finally { Interlocked.Exchange(ref scanning, 0); }
            }) { IsBackground = true }.Start();
        }
        return cached;
    }

    static void Refresh() {
        try {
            var listView = DesktopView();
            if (listView == IntPtr.Zero) { cached = "[]"; return; }
            RefreshFilePaths();
            var root = AutomationElement.FromHandle(listView);
            if (root == null) return;
            var items = root.FindAll(TreeScope.Children,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem));
            if (items == null) return;
            var output = new StringBuilder("[");
            int count = 0;
            for (int i = 0; i < items.Count && count < 256; i++) {
                try {
                    var element = items[i];
                    var area = element.Current.BoundingRectangle;
                    if (area.IsEmpty || area.Width < 22 || area.Height < 30) continue;
                    // UIA ListItem bounds include the LABEL and the cell,
                    // not just the visible icon. The old fixed 48px guess
                    // placed snow INSIDE large (96px) desktop icons.
                    // Reserve space for the label and use the actual Image
                    // accessibility child when Explorer makes it available.
                    double labelTop = area.Bottom - 28;
                    try {
                        var label = element.FindFirst(TreeScope.Descendants,
                            new PropertyCondition(AutomationElement.ControlTypeProperty,
                                ControlType.Text));
                        if (label != null) {
                            var bounds = label.Current.BoundingRectangle;
                            if (!bounds.IsEmpty && bounds.Top > area.Top + 35 &&
                                bounds.Top < area.Bottom)
                                labelTop = bounds.Top;
                        }
                    } catch { /* UIA may not provide an accessible label */ }
                    // Desktop artwork is from SHIL_EXTRALARGE (48 logical
                    // pixels, DPI-scaled), not a variable height derived
                    // from the number of text lines below each shortcut.
                    uint dpi = 96;
                    try {
                        dpi = GetDpiForWindow(listView);
                        if (dpi < 96 || dpi > 384) dpi = 96;
                    } catch { dpi = 96; }
                    int maxSide = Math.Max(32, Math.Min(144, (int)area.Width - 6));
                    int shellSide = (int)Math.Round(48.0 * dpi / 96.0);
                    int side = Math.Max(32, Math.Min(maxSide, shellSide));
                    // Reserve label clearance for two-line filenames as
                    // well as single-line folder names: same artwork size.
                    side = Math.Min(side, Math.Max(32,
                        (int)Math.Round(labelTop - area.Top - 13)));
                    double left = area.Left + (area.Width - side) / 2;
                    double top = Math.Max(area.Top + 2, labelTop - side - 15);
                    bool imageBoundsConfirmed = false;
                    try {
                        var image = element.FindFirst(TreeScope.Descendants,
                            new PropertyCondition(AutomationElement.ControlTypeProperty,
                                ControlType.Image));
                        if (image != null) {
                            var actual = image.Current.BoundingRectangle;
                            if (!actual.IsEmpty && actual.Width >= 20 &&
                                actual.Height >= 20 && actual.Width <= area.Width + 2 &&
                                actual.Height <= area.Height + 2 &&
                                actual.Top < labelTop &&
                                actual.Left >= area.Left - 4 &&
                                actual.Right <= area.Right + 4) {
                                left = actual.Left;
                                top = actual.Top;
                                side = (int)Math.Round(Math.Min(actual.Width, actual.Height));
                                imageBoundsConfirmed = true;
                            }
                        }
                    } catch { /* Explorer versions expose different UIA trees */ }
                    // If the precise image rectangle is absent, deliberately
                    // keep the estimated rim near the TOP of the icon cell.
                    // Never infer a deep pixel contour from this uncertain box.
                    if (!imageBoundsConfirmed) {
                        // Keep fallback bounds relative to the LABEL, not to
                        // the outer ListItem which can be padded variably.
                        top = Math.Max(area.Top + 2, labelTop - side - 15);
                    }
                    // Stable UI Automation runtime ID, not the child index.
                    // Explorer can reorder ListItems during icon refreshes:
                    // index IDs would attach old snow to an unrelated icon.
                    string stableId = i.ToString(CultureInfo.InvariantCulture);
                    try {
                        int[] runtime = element.GetRuntimeId();
                        if (runtime != null && runtime.Length > 0) {
                            var token = new StringBuilder();
                            foreach (int part in runtime)
                                token.Append(part.ToString("X8", CultureInfo.InvariantCulture)).Append('-');
                            stableId = token.ToString();
                        }
                    } catch { /* use index fallback on older Explorer */ }
                    if (count++ > 0) output.Append(',');
                    output.Append("{\"id\":\"").Append(stableId).Append("\"");
                    output.Append(",\"left\":").Append((int)Math.Round(left));
                    output.Append(",\"top\":").Append((int)Math.Round(top));
                    output.Append(",\"right\":").Append((int)Math.Round(left + side));
                    output.Append(",\"bottom\":").Append((int)Math.Round(top + side));
                    output.Append(",\"contour\":[");
                    bool reliableShape;
                    int[] shape = ReadShape(element.Current.Name ?? "", out reliableShape);
                    for (int c = 0; c < Columns; c++) {
                        if (c > 0) output.Append(',');
                        output.Append(shape[c].ToString(CultureInfo.InvariantCulture));
                    }
                    output.Append("],\"trusted\":").Append(reliableShape ? "true" : "false").Append('}');
                } catch { /* a deleted or virtualized icon can disappear mid-scan */ }
            }
            output.Append(']');
            cached = output.ToString();
        } catch {
            // Explorer may restart or accessibility queries may be unavailable.
            // Preserve the previous snapshot until the next successful scan.
        }
    }
}
