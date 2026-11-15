// Snow on a former window ledge must become falling powder BEFORE the
// associated pile is deleted. The window can disappear from Win32 geometry
// because it was closed, minimised, or hidden by the owning application.
// It must not silently take its snow with it.
export function shouldReleaseWindowSnow(pile, nextRect, settings) {
  return Boolean(pile && pile.rect && !pile.rect.taskbar && !nextRect &&
    settings?.weather === 'snow' && settings.enabled && !settings.paused);
}
