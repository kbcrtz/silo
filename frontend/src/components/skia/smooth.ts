import { Skia, type SkPath } from "@shopify/react-native-skia";
import type { Pt } from "@/lib/mannequin";

/**
 * Catmull-Rom through the points, as cubic beziers. A `sharp` point gets a
 * zero-length tangent, which turns it into a corner.
 */
export function smooth(points: Pt[], scale: number, closed: boolean): SkPath {
  const path = Skia.Path.Make();
  const n = points.length;
  const at = (i: number) => points[closed ? (i + n) % n : clampIndex(i, n)];
  path.moveTo(points[0].x * scale, points[0].y * scale);
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = p1.sharp
      ? p1
      : { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = p2.sharp
      ? p2
      : { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path.cubicTo(
      c1.x * scale,
      c1.y * scale,
      c2.x * scale,
      c2.y * scale,
      p2.x * scale,
      p2.y * scale,
    );
  }
  if (closed) path.close();
  return path;
}

const clampIndex = (i: number, n: number) => Math.min(n - 1, Math.max(0, i));
