using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class Desktop {
    const int GwlStyle = -16;
    const int GwlExStyle = -20;
    const int WsCaption = 0x00c00000;
    const int WsThickFrame = 0x00040000;
    const int WsExAppWindow = 0x00040000;
    const int WsExTransparent = 0x00000020;
    const int WsExToolWindow = 0x00000080;
    const int WsExNoActivate = 0x08000000;
    const int WsExLayered = 0x00080000;
    const int WsChild = 0x40000000;
    [StructLayout(LayoutKind.Sequential)]
    struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    struct Point { public int X, Y; }
    // Win32 reports the window in a native move/resize loop independently
    // of the (possibly stale) DWM bounding rectangle.
    [StructLayout(LayoutKind.Sequential)]
    struct GuiThreadInfo {
        public int cbSize;
        public int flags;
        public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner;
        public IntPtr hwndMoveSize, hwndCaret;
        public Rect rcCaret;
    }
    [DllImport("user32", SetLastError = true)]
    static extern bool GetGUIThreadInfo(uint thread, ref GuiThreadInfo info);
    delegate bool WindowCallback(IntPtr hwnd, IntPtr data);
    [DllImport("user32")] static extern bool EnumWindows(WindowCallback callback, IntPtr data);
    [DllImport("user32")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32")] static extern bool GetCursorPos(out Point point);
    [DllImport("user32", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder name, int length);
    [DllImport("user32")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
    [DllImport("user32")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("dwmapi")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int key, out Rect rect, int size);
    [DllImport("dwmapi")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int key, out int value, int size);
    [DllImport("winmm")] static extern uint timeBeginPeriod(uint period);
    [DllImport("winmm")] static extern uint timeEndPeriod(uint period);

    static bool IsApplicationSurface(IntPtr hwnd, Rect bounds) {
        int extended = GetWindowLong(hwnd, GwlExStyle);
        int style = GetWindowLong(hwnd, GwlStyle);
        // Ignore tooltips, drag-preview windows and non-activating transparent surfaces.
        if ((extended & (WsExTransparent | WsExToolWindow | WsExNoActivate)) != 0 ||
            (style & WsChild) != 0) return false;
        if ((style & WsCaption) == WsCaption || (style & WsThickFrame) != 0 ||
            (extended & WsExAppWindow) != 0) return true;
        // Borderless CAD applications (including SolidWorks host frames) need to
        // occlude weather too. Only include substantial *unowned* opaque windows.
        int w = bounds.Right - bounds.Left, h = bounds.Bottom - bounds.Top;
        return GetWindow(hwnd, 4) == IntPtr.Zero && w >= 180 && h >= 110 &&
            (extended & WsExLayered) == 0;
    }

    static int Main(string[] args) {
        uint parent;
        if (args.Length != 1 || !uint.TryParse(args[0], out parent)) return 2;
        SetProcessDpiAwarenessContext(new IntPtr(-4));
        // A closed parent pipe signals shutdown, including if Electron crashes.
        new Thread(delegate() { Console.ReadLine(); Environment.Exit(0); }) { IsBackground = true }.Start();

        string last = null;
        Point lastCursor = new Point();
        int lastSent = 0;
        bool fineTimer = false;
        while (true) {
            var windows = new List<string>();
            var minimized = new List<string>();
            EnumWindows(delegate(IntPtr hwnd, IntPtr ignored) {
                uint owner;
                GetWindowThreadProcessId(hwnd, out owner);
                if (owner == parent) return true;
                // Minimized HWNDs need separate notification to release snow.
                if (IsIconic(hwnd)) {
                    minimized.Add(string.Format(CultureInfo.InvariantCulture, "\"{0:X}\"", hwnd.ToInt64()));
                    return true;
                }
                if (!IsWindowVisible(hwnd)) return true;
                int cloaked;
                if (DwmGetWindowAttribute(hwnd, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
                var buffer = new StringBuilder(128);
                GetClassName(hwnd, buffer, buffer.Capacity);
                string name = buffer.ToString();
                bool taskbar = name == "Shell_TrayWnd" || name == "Shell_SecondaryTrayWnd";
                if (name == "Progman" || name == "WorkerW" || name == "DV2ControlHost") return true;
                Rect bounds;
                if (DwmGetWindowAttribute(hwnd, 9, out bounds, 16) != 0 && !GetWindowRect(hwnd, out bounds)) return true;
                if (bounds.Right - bounds.Left < 32 || bounds.Bottom - bounds.Top < 16) return true;
                if (!taskbar && !IsApplicationSurface(hwnd, bounds)) return true;
                windows.Add(string.Format(CultureInfo.InvariantCulture,
                    "{{\"id\":\"{0:X}\",\"left\":{1},\"top\":{2},\"right\":{3},\"bottom\":{4},\"taskbar\":{5}}}",
                    hwnd.ToInt64(), bounds.Left, bounds.Top, bounds.Right, bounds.Bottom, taskbar ? "true" : "false"));
                return true;
            }, IntPtr.Zero);
            bool pressed = GetAsyncKeyState(1) < 0;
            bool control = GetAsyncKeyState(0x11) < 0;
            string movingWindow = "null";
            if (pressed) {
                var gui = new GuiThreadInfo();
                gui.cbSize = Marshal.SizeOf(typeof(GuiThreadInfo));
                if (GetGUIThreadInfo(0, ref gui) && gui.hwndMoveSize != IntPtr.Zero) {
                    movingWindow = string.Format(CultureInfo.InvariantCulture,
                        "\"{0:X}\"", gui.hwndMoveSize.ToInt64());
                }
            }
            string snapshot = "{\"pressed\":" + (pressed ? "true" : "false") +
                ",\"control\":" + (control ? "true" : "false") +
                ",\"moving\":" + movingWindow +
                ",\"minimized\":[" + string.Join(",", minimized) + "]" +
                ",\"windows\":[" + string.Join(",", windows) + "]}";
            Point cursor;
            GetCursorPos(out cursor);
            int now = Environment.TickCount;
            bool moved = cursor.X != lastCursor.X || cursor.Y != lastCursor.Y;
            if (snapshot != last || moved ||
                unchecked(now - lastSent) >= 96) {
                Console.WriteLine(snapshot);
                last = snapshot;
                lastCursor = cursor;
                lastSent = now;
            }
            // While a window is dragged, sample at ~120 Hz with a 1 ms timer so snow follows it smoothly;
            // the default 15.6 ms Windows timer would turn 8 ms sleeps into uneven 15-16 ms steps.
            if (pressed != fineTimer) {
                if (pressed) timeBeginPeriod(1); else timeEndPeriod(1);
                fineTimer = pressed;
            }
            Thread.Sleep(pressed ? 8 : moved ? 14 : 30);
        }
    }
}

