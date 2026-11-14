// Differentiate minimization from closing. Only minimized visible windows
// drop snow; the old blanket removal caused snow to vanish instantly.
export function shouldSpillMinimizedPile(id, minimized = []) {
  return minimized.includes(id);
}
