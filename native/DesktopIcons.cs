using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
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
        var values = new int[Columns];
        string lower = name.ToLowerInvariant();
        bool folder = lower.Contains("folder") || lower.Contains("پوشه");
        bool recycle = lower.Contains("recycle") || lower.Contains("bin");
        for (int i = 0; i < Columns; i++) {
            double t = (i + .5) / Columns;
            double arc = Math.Sqrt(Math.Max(0, 1 - Math.Pow(2*t-1, 2)));
            // Folders are largely flat with a short raised tab; file icons
            // vary in their top shape, round icons have arched shoulders.
            double y = folder ? (t < .34 ? .10 : .24) :
                recycle ? (.12 + .19 * (1 - arc)) :
                (.07 + .34 * (1 - arc));
            values[i] = (int)Math.Round(y * 1000);
        }
        return values;
    }

    static int[] ReadShape(string name) {
        string path;
        if (!desktopFiles.TryGetValue(name, out path)) return FallbackContour(name);
        int[] known;
        if (contourCache.TryGetValue(path, out known)) return known;
        int[] contour = FallbackContour(name);
        SHFILEINFO info;
        IntPtr handle = IntPtr.Zero;
        try {
            uint flags = 0x100 /* SHGFI_ICON */ | 0x0 /* SHGFI_LARGEICON */;
            SHGetFileInfo(path, 0, out info,
                (uint)Marshal.SizeOf(typeof(SHFILEINFO)), flags);
            handle = info.hIcon;
            if (handle != IntPtr.Zero) {
                using (var icon = Icon.FromHandle(handle))
                using (var image = icon.ToBitmap()) {
                    var sampled = new int[Columns];
                    int opaqueBands = 0;
                    for (int i = 0; i < Columns; i++) {
                        int first = -1;
                        int from = Math.Max(0, (i * image.Width) / Columns);
                        int to = Math.Min(image.Width, ((i + 1) * image.Width + Columns - 1) / Columns);
                        for (int y = 0; y < image.Height; y++) {
                            bool visible = false;
                            for (int x = from; x < to; x++) {
                                if (image.GetPixel(x, y).A >= 85) { visible = true; break; }
                            }
                            if (visible) { first = y; break; }
                        }
                        sampled[i] = first < 0 ? -1 : (int)Math.Round(first * 1000.0 / image.Height);
                        if (first >= 0) opaqueBands++;
                    }
                    if (opaqueBands >= 5) contour = sampled;
                }
            }
        } catch { /* Shell image extraction is optional: keep a shaped fallback */ }
        finally {
            if (handle != IntPtr.Zero) DestroyIcon(handle);
        }
        if (contourCache.Count > 512) contourCache.Clear();
        contourCache[path] = contour;
        return contour;
    }

    public static string Snapshot() {
        if (DateTime.UtcNow < nextScan) return cached;
        nextScan = DateTime.UtcNow.AddMilliseconds(1400);
        try {
            var listView = DesktopView();
            if (listView == IntPtr.Zero) { cached = "[]"; return cached; }
            RefreshFilePaths();
            var root = AutomationElement.FromHandle(listView);
            if (root == null) return cached;
            var items = root.FindAll(TreeScope.Children,
                new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem));
            if (items == null) return cached;
            var output = new StringBuilder("[");
            int count = 0;
            for (int i = 0; i < items.Count && count < 256; i++) {
                try {
                    var element = items[i];
                    var area = element.Current.BoundingRectangle;
                    if (area.IsEmpty || area.Width < 22 || area.Height < 30) continue;
                    // UIA bounds include the LABEL. The snow contact shape
                    // covers only the centered upper icon, not the label.
                    int side = Math.Max(24, Math.Min(70,
                        Math.Min((int)area.Width - 6, (int)Math.Round(area.Height * .52))));
                    double left = area.Left + (area.Width - side) / 2;
                    double top = area.Top + 2;
                    if (count++ > 0) output.Append(',');
                    output.Append("{\"id\":").Append(i.ToString(CultureInfo.InvariantCulture));
                    output.Append(",\"left\":").Append((int)Math.Round(left));
                    output.Append(",\"top\":").Append((int)Math.Round(top));
                    output.Append(",\"right\":").Append((int)Math.Round(left + side));
                    output.Append(",\"bottom\":").Append((int)Math.Round(top + side));
                    output.Append(",\"contour\":[");
                    int[] shape = ReadShape(element.Current.Name ?? "");
                    for (int c = 0; c < Columns; c++) {
                        if (c > 0) output.Append(',');
                        output.Append(shape[c].ToString(CultureInfo.InvariantCulture));
                    }
                    output.Append("]}");
                } catch { /* a deleted or virtualized icon can disappear mid-scan */ }
            }
            output.Append(']');
            cached = output.ToString();
        } catch {
            // Explorer may restart or accessibility queries may be unavailable.
            // Preserve the previous snapshot until the next successful scan.
        }
        return cached;
    }
}
