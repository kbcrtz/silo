import type { CatalogItem, Length, Silhouette } from "@/data/catalog";
import type { ShopFor } from "@/store/profile";
import type { Measurements } from "./measurements";

/**
 * A front-view mannequin and the garment drawn on it, in centimeters with the
 * origin at the top of the head, x = 0 down the middle and y growing down.
 * Shapes are closed outlines; `sharp` points are corners, everything else is
 * smoothed into a curve by the renderer.
 */
export type Pt = { x: number; y: number; sharp?: boolean };
export type Outline = Pt[];

export type Body = {
  height: number;
  head: { cx: number; cy: number; rx: number; ry: number };
  /** Back to front: arms and legs sit behind the torso. */
  parts: Outline[];
  feet: { cx: number; cy: number; rx: number; ry: number }[];
};

export type Garment = {
  /** Back to front. */
  parts: Outline[];
  /** Seams, plackets, pleats: open polylines drawn over the fill. */
  lines: Pt[][];
  buttons: Pt[];
};

/** Average adult figures, used for whatever the user hasn't measured. */
const DEFAULTS: Record<"womens" | "mens", Required<Measurements>> = {
  womens: {
    height: 165,
    weight: 62,
    chest: 90,
    waist: 72,
    hips: 98,
    inseam: 76,
    armLength: 57,
  },
  mens: {
    height: 178,
    weight: 80,
    chest: 100,
    waist: 84,
    hips: 98,
    inseam: 81,
    armLength: 63,
  },
};

/** Arms hang this far out from vertical, so they read apart from the torso. */
const ARM_ANGLE = (9 * Math.PI) / 180;

export type Landmarks = ReturnType<typeof landmarks>;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Turns measurements into body landmarks. Heights come from standard figure
 * proportions (the inseam sets the crotch), widths from circumferences: a
 * torso cross-section is roughly an ellipse, so its front width is about a
 * third of the way around.
 */
export function landmarks(m: Measurements, shopFor: ShopFor) {
  const base = DEFAULTS[shopFor === "mens" ? "mens" : "womens"];
  const H = clamp(m.height ?? base.height, 140, 210);
  // Unmeasured lengths and girths scale with height, so a tall user without
  // the rest still gets a tall figure rather than an average one.
  const k = H / base.height;
  const get = (key: keyof Measurements) => m[key] ?? base[key] * k;

  const chest = get("chest");
  const waist = get("waist");
  const hips = get("hips");
  const arm = get("armLength");

  const y = {
    chin: 0.13 * H,
    neck: 0.155 * H,
    shoulder: 0.18 * H,
    armpit: 0.245 * H,
    chest: 0.27 * H,
    waist: 0.38 * H,
    crotch: clamp(H - get("inseam"), 0.44 * H, 0.6 * H),
    ankle: 0.955 * H,
  };
  const hipY = y.crotch - 0.06 * H;
  const kneeY = lerp(y.crotch, y.ankle, 0.48);

  const half = {
    neck: 0.03 * H,
    shoulder: chest / 4.8,
    chest: chest / 6.2,
    waist: waist / 6.3,
    hip: hips / 6.0,
  };

  return {
    H,
    y: { ...y, hip: hipY, knee: kneeY },
    half,
    leg: {
      /** Leg centerline x at a given y, converging a little toward the feet. */
      center: (at: number) => {
        const top = half.hip / 2;
        if (at <= y.crotch) return top;
        if (at <= kneeY)
          return lerp(top, top * 0.8, (at - y.crotch) / (kneeY - y.crotch));
        return lerp(top * 0.8, top * 0.72, (at - kneeY) / (y.ankle - kneeY));
      },
      /** Leg half-width at a given y. */
      half: (at: number) => {
        const thigh = half.hip / 2;
        const knee = hips * 0.055;
        const calfY = lerp(kneeY, y.ankle, 0.3);
        if (at <= y.crotch) return thigh;
        if (at <= kneeY)
          return lerp(thigh, knee, (at - y.crotch) / (kneeY - y.crotch));
        if (at <= calfY)
          return lerp(knee, hips * 0.058, (at - kneeY) / (calfY - kneeY));
        return lerp(hips * 0.058, 0.021 * H, (at - calfY) / (y.ankle - calfY));
      },
    },
    arm: {
      start: { x: half.shoulder - 2.8, y: y.shoulder + 2.5 },
      length: arm,
      /** Half-width along the arm, t = 0 at the shoulder, 1 at the wrist. */
      half: (t: number) =>
        t < 0.55
          ? lerp(chest * 0.048, chest * 0.036, t / 0.55)
          : lerp(chest * 0.036, 0.017 * H, (t - 0.55) / 0.45),
    },
  };
}

/** Front half-width of the body at a given height, legs included. */
export function bodyHalfAt(L: Landmarks, at: number): number {
  const { y, half } = L;
  const stops: [number, number][] = [
    [y.shoulder, half.shoulder],
    [y.armpit, half.chest],
    [y.chest, half.chest],
    [y.waist, half.waist],
    [y.hip, half.hip],
    [y.crotch, half.hip * 0.97],
  ];
  if (at >= y.crotch) return L.leg.center(at) + L.leg.half(at);
  if (at <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [y1, h1] = stops[i];
    const [y0, h0] = stops[i - 1];
    if (at <= y1) return lerp(h0, h1, (at - y0) / (y1 - y0));
  }
  return stops[stops.length - 1][1];
}

/** The x = -x reflection of a right-hand outline, in reverse order. */
function mirrored(right: Pt[]): Pt[] {
  return right.map((p) => ({ ...p, x: -p.x })).reverse();
}

/** A point on the right arm, `offset` cm out from its centerline. */
function armPoint(
  L: Landmarks,
  t: number,
  offset: number,
  sharp?: boolean,
): Pt {
  const { start, length } = L.arm;
  const dx = Math.sin(ARM_ANGLE);
  const dy = Math.cos(ARM_ANGLE);
  // Normal pointing away from the body.
  const nx = dy;
  const ny = -dx;
  return {
    x: start.x + dx * length * t + nx * offset,
    y: start.y + dy * length * t + ny * offset,
    sharp,
  };
}

/** A tube along the right arm from t0 to t1, `ease` cm wider than the arm. */
function armTube(L: Landmarks, t0: number, t1: number, ease: number): Outline {
  const ts = [t0, lerp(t0, t1, 0.33), lerp(t0, t1, 0.66), t1];
  const outer = ts.map((t, i) =>
    armPoint(L, t, L.arm.half(t) + ease, i === ts.length - 1),
  );
  const inner = ts
    .map((t, i) => armPoint(L, t, -(L.arm.half(t) + ease), i === ts.length - 1))
    .reverse();
  return [...outer, ...inner];
}

const flip = (o: Outline): Outline => o.map((p) => ({ ...p, x: -p.x }));

export function bodyOutlines(L: Landmarks): Body {
  const { H, y, half, leg } = L;

  const rightArm = armTube(L, 0, 1, 0);
  // The hand continues the arm, narrowing to rounded fingertips.
  const wrist = (o: number) => armPoint(L, 1, o);
  const handLength = (0.105 * H) / L.arm.length;
  const hand: Outline = [
    wrist(L.arm.half(1)),
    armPoint(L, 1 + handLength * 0.5, L.arm.half(1) * 1.25),
    armPoint(L, 1 + handLength, 0),
    armPoint(L, 1 + handLength * 0.5, -L.arm.half(1) * 1.15),
    wrist(-L.arm.half(1)),
  ];

  const legYs = [
    y.crotch,
    lerp(y.crotch, y.knee, 0.45),
    y.knee,
    lerp(y.knee, y.ankle, 0.3),
    y.ankle,
  ];
  const rightLeg: Outline = [
    { x: 0, y: y.hip, sharp: true },
    { x: half.hip, y: y.hip, sharp: true },
    ...legYs.map((at, i) => ({
      x: leg.center(at) + leg.half(at),
      y: at,
      sharp: i === legYs.length - 1,
    })),
    ...legYs
      .slice()
      .reverse()
      .map((at, i) => ({
        x: Math.max(0.3, leg.center(at) - leg.half(at)),
        y: at + (i === legYs.length - 1 ? 0.5 : 0),
        sharp: i === 0 || i === legYs.length - 1,
      })),
  ];

  const torsoRight: Pt[] = [
    { x: half.neck, y: y.neck - 1, sharp: true },
    { x: half.neck * 1.1, y: y.neck + 0.6 },
    { x: half.shoulder * 0.8, y: y.shoulder - 0.4 },
    { x: half.shoulder, y: y.shoulder + 2 },
    { x: half.chest, y: y.armpit },
    { x: half.chest, y: y.chest + 3 },
    { x: half.waist, y: y.waist },
    { x: half.hip, y: y.hip },
    { x: half.hip * 0.97, y: y.crotch, sharp: true },
  ];

  const neck: Outline = [
    { x: -half.neck, y: y.chin - 2, sharp: true },
    { x: half.neck, y: y.chin - 2, sharp: true },
    { x: half.neck, y: y.neck + 1, sharp: true },
    { x: -half.neck, y: y.neck + 1, sharp: true },
  ];

  const footRx = 0.024 * H;
  return {
    height: H,
    head: { cx: 0, cy: y.chin / 2, rx: 0.046 * H, ry: y.chin / 2 },
    parts: [
      rightArm,
      flip(rightArm),
      hand,
      flip(hand),
      rightLeg,
      flip(rightLeg),
      neck,
      [...torsoRight, ...mirrored(torsoRight)],
    ],
    feet: [1, -1].map((side) => ({
      cx: side * leg.center(y.ankle),
      cy: y.ankle + (H - y.ankle) / 2,
      rx: footRx,
      ry: (H - y.ankle) / 2,
    })),
  };
}

/** How a cut sits: ease (cm off the body), how straight it falls, hem flare. */
const CUT: Record<
  Silhouette,
  { ease: number; straight: number; flare: number; sleeveEase: number }
> = {
  fitted: { ease: 0.8, straight: 0.1, flare: 0, sleeveEase: 0.4 },
  relaxed: { ease: 3, straight: 0.6, flare: 1, sleeveEase: 1.6 },
  boxy: { ease: 4.5, straight: 1, flare: 0, sleeveEase: 2.2 },
  wrap: { ease: 1.2, straight: 0.1, flare: 2, sleeveEase: 0.8 },
  tailored: { ease: 2, straight: 0.25, flare: 0.5, sleeveEase: 1 },
  cropped: { ease: 3, straight: 0.8, flare: 0, sleeveEase: 1.6 },
  slip: { ease: 1, straight: 0.3, flare: 2, sleeveEase: 0 },
  "a-line": { ease: 1.2, straight: 0.1, flare: 9, sleeveEase: 0.6 },
  slim: { ease: 0.8, straight: 0, flare: 0, sleeveEase: 0 },
  straight: { ease: 1.5, straight: 0.6, flare: 0, sleeveEase: 0 },
  "wide-leg": { ease: 2, straight: 1, flare: 5, sleeveEase: 0 },
};

export function hemY(L: Landmarks, length: Length): number {
  const { y } = L;
  switch (length) {
    case "waist":
      return y.waist + 2;
    case "hip":
      return lerp(y.hip, y.crotch, 0.6);
    case "thigh":
      return lerp(y.crotch, y.knee, 0.35);
    case "knee":
      return y.knee + 2;
    case "midi":
      return lerp(y.knee, y.ankle, 0.45);
    case "ankle":
      return y.ankle - 1;
  }
}

/** Tops, dresses and outerwear: shoulders to hem, sleeves, neckline. */
function upperGarment(L: Landmarks, item: CatalogItem): Garment {
  const { y, half } = L;
  const cut = CUT[item.silhouette];
  const sleeve = item.sleeve ?? "long";
  const hem = hemY(L, item.length);
  const details = new Set(item.details ?? []);
  const open = item.category === "outerwear" && item.silhouette !== "wrap";
  const vNeck = item.silhouette === "wrap" || details.has("lapels") || open;

  // Boxy and relaxed cuts fall from the chest instead of following the waist.
  const straightHalf = half.chest;
  const halfAt = (at: number) => {
    const body = bodyHalfAt(L, at);
    const fall = Math.max(body, lerp(body, straightHalf, cut.straight));
    const below = Math.max(0, (at - y.waist) / Math.max(1, hem - y.waist));
    return Math.max(body + 0.5, fall + cut.ease + cut.flare * below ** 1.3);
  };

  const neckX = sleeve === "none" ? half.neck + 2.5 : half.neck + 1.2;
  const ys = [
    y.armpit + 1.5,
    y.chest + 3,
    y.waist,
    y.hip,
    y.crotch,
    y.knee,
    y.ankle,
  ].filter((at) => at < hem - 2);

  const right: Pt[] = [
    { x: neckX, y: y.neck, sharp: true },
    ...(sleeve === "none"
      ? [
          // Straps, then the armhole scooping in under the arm.
          { x: neckX + 2.5, y: y.shoulder - 0.5, sharp: true },
          { x: half.chest - 1, y: y.armpit + 2, sharp: true },
        ]
      : [
          {
            x: half.shoulder + cut.ease * 0.4,
            y: y.shoulder + 1.5,
            sharp: true,
          },
        ]),
    ...ys.map((at) => ({ x: halfAt(at), y: at })),
    { x: halfAt(hem), y: hem, sharp: true },
  ];

  const dipY = vNeck
    ? y.chest + (open ? 3 : 1)
    : sleeve === "none"
      ? y.chest - 3
      : y.neck + 2.5;
  const dip: Pt = { x: 0, y: dipY, sharp: vNeck };
  const hemCenter: Pt = { x: 0, y: hem + (cut.flare > 4 ? 1.5 : 0.4) };

  const body: Outline = [dip, ...right, hemCenter, ...mirrored(right)];

  const parts: Outline[] = [];
  if (sleeve !== "none") {
    const t1 = sleeve === "short" ? 0.36 : 0.96;
    const tube = armTube(L, 0, t1, cut.sleeveEase + 0.6);
    parts.push(tube, flip(tube));
  }
  parts.push(body);

  const lines: Pt[][] = [];
  const buttons: Pt[] = [];
  const front = (from: number) => [
    { x: 0, y: from },
    { x: 0, y: hem },
  ];
  if (details.has("placket") || open) {
    lines.push(front(dipY));
    if (!open || details.has("placket")) {
      const n = Math.max(3, Math.round((hem - dipY) / 9));
      for (let i = 0; i < n; i++)
        buttons.push({ x: 0.9, y: lerp(dipY + 2, hem - 3, i / (n - 1)) });
    }
  }
  if (details.has("lapels")) {
    for (const side of [1, -1]) {
      lines.push([
        { x: side * neckX, y: y.neck },
        { x: side * half.chest * 0.55, y: y.chest - 1 },
        { x: 0, y: dipY },
      ]);
    }
    lines.push(front(dipY));
    buttons.push({ x: 0.9, y: y.waist - 1 }, { x: 0.9, y: y.waist + 6 });
  }
  if (item.silhouette === "wrap") {
    // The wrap's overlap runs from the left of the V across to the right hip.
    lines.push([
      { x: 0, y: dipY },
      { x: halfAt(y.waist) * 0.6, y: y.waist + 3 },
      { x: halfAt(hem) * 0.75, y: hem },
    ]);
  }
  if (details.has("belt")) {
    const w = halfAt(y.waist);
    lines.push(
      [
        { x: -w, y: y.waist - 1.5 },
        { x: w, y: y.waist - 1.5 },
      ],
      [
        { x: -w, y: y.waist + 1.5 },
        { x: w, y: y.waist + 1.5 },
      ],
    );
  }
  if (details.has("ribbing")) {
    const w = halfAt(hem - 3);
    lines.push([
      { x: -w, y: hem - 3 },
      { x: w, y: hem - 3 },
    ]);
  }
  return { parts, lines, buttons };
}

/** Trousers and skirts, waistband down. */
function lowerGarment(L: Landmarks, item: CatalogItem): Garment {
  const { y, half, leg } = L;
  const cut = CUT[item.silhouette];
  const hem = hemY(L, item.length);
  const details = new Set(item.details ?? []);
  const top = y.waist + 1;

  if (item.silhouette === "a-line") {
    const right: Pt[] = [
      { x: half.waist + 0.6, y: top, sharp: true },
      { x: half.hip + cut.ease, y: y.hip },
      { x: bodyHalfAt(L, hem) + cut.flare, y: hem, sharp: true },
    ];
    const lines: Pt[][] = [];
    if (details.has("pleats")) {
      for (const f of [-0.66, -0.33, 0, 0.33, 0.66]) {
        lines.push([
          { x: f * half.waist, y: top + 2 },
          { x: f * (bodyHalfAt(L, hem) + cut.flare), y: hem },
        ]);
      }
    }
    return {
      parts: [[...right, { x: 0, y: hem + 1.2 }, ...mirrored(right)]],
      lines,
      buttons: [],
    };
  }

  const thigh = leg.half(y.crotch) + cut.ease;
  const legHalfAt = (at: number) => {
    const fitted = leg.half(at) + cut.ease;
    return lerp(fitted, Math.max(fitted, thigh * 0.85), cut.straight);
  };
  // Flare goes on the outside seam only, so wide legs still read as two legs.
  const flareAt = (at: number) =>
    cut.flare * Math.max(0, (at - y.crotch) / (hem - y.crotch)) ** 1.5;
  const legYs = [y.crotch, lerp(y.crotch, y.knee, 0.5), y.knee, hem];
  const outer = legYs.map((at, i) => ({
    x: leg.center(at) + legHalfAt(at) + flareAt(at),
    y: at,
    sharp: i === legYs.length - 1,
  }));
  const inner = legYs
    .map((at, i) => ({
      x: Math.max(0.8, leg.center(at) - legHalfAt(at) + flareAt(at) * 0.3),
      y: at + 1.2,
      sharp: i === legYs.length - 1,
    }))
    .reverse();
  const right: Pt[] = [
    { x: half.waist + 0.6, y: top, sharp: true },
    { x: half.hip + cut.ease * 0.6, y: y.hip },
    ...outer,
    ...inner.slice(0, -1),
  ];
  const crotch: Pt = { x: 0, y: y.crotch + 2, sharp: true };

  const lines: Pt[][] = [];
  if (details.has("crease")) {
    for (const side of [1, -1]) {
      lines.push([
        { x: side * leg.center(y.hip), y: y.hip + 3 },
        { x: side * leg.center(hem), y: hem },
      ]);
    }
  }
  // Fly seam.
  lines.push([
    { x: 0, y: top + 1 },
    { x: 0, y: y.crotch - 1 },
  ]);
  return {
    parts: [[...right, crotch, ...mirrored(right)]],
    lines,
    buttons: [{ x: 0, y: top + 2 }],
  };
}

export function garmentOutlines(L: Landmarks, item: CatalogItem): Garment {
  return item.category === "bottom"
    ? lowerGarment(L, item)
    : upperGarment(L, item);
}
