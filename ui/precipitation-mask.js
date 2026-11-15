// Keep weather particles behind desktop windows without obscuring snow on their top edges.
// A separate clip for each rectangle handles overlapping windows (one even-odd path would not).
export function clipPrecipitation(ctx, rectangles, width, height) {
  for (const rect of rectangles) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) continue;
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.rect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
    ctx.clip('evenodd');
  }
}

// WebGL scissor coordinates start at the lower-left corner, canvas coordinates at the upper-left.
export function scissorFor(rect, pixelWidth, pixelHeight, scale) {
  const left = Math.max(0, Math.min(pixelWidth, Math.floor(rect.left * scale)));
  const right = Math.max(0, Math.min(pixelWidth, Math.ceil(rect.right * scale)));
  const top = Math.max(0, Math.min(pixelHeight, Math.floor(rect.top * scale)));
  const bottom = Math.max(0, Math.min(pixelHeight, Math.ceil(rect.bottom * scale)));
  if (right <= left || bottom <= top) return null;
  return { x: left, y: pixelHeight - bottom, width: right - left, height: bottom - top };
}

export function maskPrecipitationGl(gl, rectangles, canvas, scale) {
  if (!rectangles.length) return;
  gl.enable(gl.SCISSOR_TEST);
  for (const rect of rectangles) {
    const region = scissorFor(rect, canvas.width, canvas.height, scale);
    if (!region) continue;
    gl.scissor(region.x, region.y, region.width, region.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.disable(gl.SCISSOR_TEST);
}
