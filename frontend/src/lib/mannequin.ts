import type { CatalogItem, Length, Silhouette } from "@/data/catalog";
import type { ShopFor } from "@/store/profile";
import type { Measurements } from "./measurements";

/**
 * A front-view mannequin and the clothes drawn on it, in centimeters with the
 * origin at the top of the head, x = 0 down the middle and y growing down.
 * Shapes are closed outlines; `sharp` points are corners, everything else is
 * smoothed into a curve by the renderer.
 */
export type Pt = { x: number; y: number; sharp?: boolean };
export type Outline = Pt[];

export type Body = {
  height: number;
  head: Outline;
  /** Everything below the head as one outline, so it shades without seams. */
  silhouette: Outline;
  /** Faint anatomy hints drawn over the fill: collarbones, kneecaps. */
  contours: Pt[][];
};

export type Garment = {
  /** Back to front. */
  parts: Outline[];
  /** Seams, plackets, pleats: crisp open polylines drawn over the fill. */
  lines: Pt[][];
  /** Where the fabric creases: drawn soft, as shading rather than seams. */
  folds: Pt[][];
  buttons: Pt[];
};

/** A garment in the outfit: the item itself, or a plain piece to go with it. */
export type Layer = {
  role: "item" | "baseTop" | "baseBottom";
  garment: Garment;
  /** For an item layer, which of the pieces it is. */
  piece?: number;
};

/** What the garment builders need to know about a piece of clothing. */
export type Cut = Pick<
  CatalogItem,
  "category" | "silhouette" | "sleeve" | "length" | "details"
>;

/** Average adult figures, used for whatever the user hasn't measured. */
const DEFAULTS: Record<
  "womens" | "mens",
  Required<Omit<Measurements, "bust">>
> = {
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

const DEG = Math.PI / 180;
/** The elbow, as a fraction of the way from shoulder to wrist. */
const ELBOW = 0.46;
/** The forearm hangs this much closer to vertical than the upper arm. */
const FOREARM_TUCK = 3 * DEG;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const smoothstep = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/** Piecewise-linear lookup through [at, value] stops sorted by `at`. */
function along(stops: [number, number][], at: number): number {
  if (at <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [a1, v1] = stops[i];
    const [a0, v0] = stops[i - 1];
    if (at <= a1) return lerp(v0, v1, (at - a0) / (a1 - a0));
  }
  return stops[stops.length - 1][1];
}

export type Landmarks = ReturnType<typeof landmarks>;

/**
 * Turns measurements into body landmarks. Heights come from standard figure
 * proportions (the inseam sets the crotch), widths from circumferences: a
 * torso cross-section is roughly an ellipse, so its front width is about a
 * third of the way around.
 */
export function landmarks(m: Measurements, shopFor: ShopFor) {
  const mens = shopFor === "mens";
  const base = DEFAULTS[mens ? "mens" : "womens"];
  // No height but a leg length: legs are a steady share of height, so estimate it from them.
  const fromLegs =
    m.height === undefined && m.inseam !== undefined
      ? m.inseam * (base.height / base.inseam)
      : undefined;
  const H = clamp(m.height ?? fromLegs ?? base.height, 140, 210);
  // Unmeasured lengths and girths scale with height, so a tall user without
  // the rest still gets a tall figure rather than an average one.
  const k = H / base.height;
  const get = (key: keyof typeof base) => m[key] ?? base[key] * k;
  // Unmeasured girths also follow weight against the average for this height (weight grows with height squared).
  const build = m.weight
    ? clamp(Math.sqrt(m.weight / (base.weight * k * k)), 0.8, 1.35)
    : 1;
  const girth = (key: "chest" | "waist" | "hips") =>
    m[key] ?? base[key] * k * build;

  // Chest (around the upper torso) sets the shoulders and under the arms; bust (fullest point) the bust line.
  const chest = m.chest ?? m.bust ?? girth("chest");
  const bust = m.bust ?? chest;
  const waist = girth("waist");
  const hips = girth("hips");

  const waistY = (mens ? 0.39 : 0.38) * H;
  // The hip line (crotch - 0.06 H) has to stay clear of the waist, or the two merge into one ridge.
  const crotch = clamp(H - get("inseam"), waistY + 0.1 * H, 0.6 * H);
  const ankle = 0.955 * H;
  const knee = lerp(crotch, ankle, 0.47);
  const y = {
    chin: 0.13 * H,
    neck: 0.158 * H,
    shoulder: 0.185 * H,
    armpit: 0.245 * H,
    chest: 0.272 * H,
    underbust: 0.31 * H,
    waist: waistY,
    hip: crotch - 0.06 * H,
    crotch,
    knee,
    calf: lerp(knee, ankle, 0.25),
    ankle,
  };

  const half = {
    neck: (mens ? 0.036 : 0.031) * H,
    shoulder: chest / 4.8,
    underarm: chest / 6.2,
    chest: bust / 6.2,
    waist: waist / 6.3,
    hip: hips / 6.0,
  };

  const torsoStops: [number, number][] = [
    [y.shoulder, half.shoulder],
    [y.armpit, half.underarm * 0.98],
    [y.chest, half.chest],
    [y.underbust, lerp(half.chest, half.waist, mens ? 0.3 : 0.45)],
    [y.waist, half.waist],
    [lerp(y.waist, y.hip, 0.5), lerp(half.waist, half.hip, 0.72)],
    [y.hip, half.hip],
    [y.crotch, half.hip],
  ];

  // Each leg is a centerline with separate outer and inner offsets, since the
  // outer calf bulges higher than the inner one.
  const top = half.hip / 2;
  const kneeHalf = hips * 0.052;
  const calfHalf = hips * 0.06;
  const ankleHalf = 0.019 * H;
  const midThigh = lerp(y.crotch, y.knee, 0.45);
  const leg = {
    center: (at: number) =>
      along(
        [
          [y.crotch, top],
          [y.knee, top * 0.8],
          [y.ankle, top * 0.7],
        ],
        at,
      ),
    outer: (at: number) =>
      along(
        [
          [y.crotch, top],
          [midThigh, top * 0.9],
          [y.knee, kneeHalf],
          [y.calf, calfHalf],
          [y.ankle, ankleHalf],
        ],
        at,
      ),
    inner: (at: number) =>
      along(
        [
          [y.crotch, top],
          [midThigh, top * 0.82],
          [y.knee, kneeHalf * 1.05],
          [lerp(y.knee, y.ankle, 0.32), calfHalf * 1.04],
          [y.ankle, ankleHalf * 0.95],
        ],
        at,
      ),
  };

  const halfAt = (at: number) =>
    at >= y.crotch ? leg.center(at) + leg.outer(at) : along(torsoStops, at);

  const armLength = get("armLength");
  const armHalf = (t: number) =>
    along(
      [
        [0, chest * 0.05],
        [0.15, chest * 0.049],
        [0.36, chest * 0.042],
        [ELBOW, chest * 0.033],
        [0.6, chest * 0.037],
        [0.86, chest * 0.028],
        [1, 0.0155 * H],
      ],
      t,
    );
  const start = { x: half.shoulder - chest * 0.03, y: y.shoulder + 2.6 };
  const handLength = 0.105 * H;

  // Direction of the arm at t, blending upper arm into forearm at the elbow.
  const angleAt = (spread: number, t: number) =>
    spread - FOREARM_TUCK * smoothstep((t - (ELBOW - 0.08)) / 0.16);
  const centerAt = (spread: number, t: number) => {
    const e = Math.min(t, ELBOW) * armLength;
    const f = Math.max(0, t - ELBOW) * armLength;
    const b = spread - FOREARM_TUCK;
    return {
      x: start.x + Math.sin(spread) * e + Math.sin(b) * f,
      y: start.y + Math.cos(spread) * e + Math.cos(b) * f,
    };
  };
  // Hands past t = 1 measured in arm lengths.
  const handT = handLength / armLength;

  // Open the arms just enough to clear the hips, so wide hips never swallow
  // the hands.
  let spread = 8 * DEG;
  const clears = (s: number) =>
    [0.5, 0.75, 1, 1 + handT * 0.5, 1 + handT].every((t) => {
      const c = centerAt(s, t);
      const w = t > 1 ? armHalf(1) * 1.15 : armHalf(t);
      return c.x - w > halfAt(c.y) + 1.2;
    });
  while (spread < 22 * DEG && !clears(spread)) spread += 0.5 * DEG;

  return {
    H,
    y,
    half,
    leg,
    /** Front half-width of the body at a given height, legs included. */
    halfAt,
    arm: {
      length: armLength,
      spread,
      handT,
      half: armHalf,
      /** A point on the right arm at t, `offset` cm out from its centerline. */
      point: (t: number, offset: number, sharp?: boolean): Pt => {
        const c = centerAt(spread, t);
        const a = angleAt(spread, t);
        // Normal pointing away from the body.
        return {
          x: c.x + Math.cos(a) * offset,
          y: c.y - Math.sin(a) * offset,
          sharp,
        };
      },
    },
  };
}

/** Front half-width of the body at a given height, legs included. */
export function bodyHalfAt(L: Landmarks, at: number): number {
  return L.halfAt(at);
}

/** The x = -x reflection of a right-hand outline, in reverse order. */
function mirrored(right: Pt[]): Pt[] {
  return right.map((p) => ({ ...p, x: -p.x })).reverse();
}

const flip = <T extends Pt[]>(o: T): T =>
  o.map((p) => ({ ...p, x: -p.x })) as T;
const both = (right: Pt[]): Pt[][] => [right, flip(right)];

function head(L: Landmarks): Outline {
  const h = L.y.chin;
  const r = 0.046 * L.H;
  const right: Pt[] = [
    { x: r * 0.7, y: h * 0.07 },
    { x: r, y: h * 0.36 },
    { x: r * 0.94, y: h * 0.6 },
    { x: r * 0.74, y: h * 0.83 },
    { x: r * 0.36, y: h * 0.98 },
  ];
  return [{ x: 0, y: 0 }, ...right, { x: 0, y: h }, ...mirrored(right)];
}

export function bodyOutlines(L: Landmarks): Body {
  const { H, y, half, leg, arm } = L;

  const outerArm = [0.08, 0.3, ELBOW, 0.62, 0.86, 1].map((t) =>
    arm.point(t, arm.half(t)),
  );
  const innerArm = [1, 0.86, 0.62, ELBOW, 0.3, 0.16].map((t) =>
    arm.point(t, -arm.half(t)),
  );
  // The hand carries on along the forearm and tapers to the fingertips.
  const w = arm.half(1);
  const at = (f: number) => 1 + arm.handT * f;
  const hand: Pt[] = [
    arm.point(at(0.3), w * 1.16),
    arm.point(at(0.66), w * 1.0),
    arm.point(at(0.9), w * 0.6),
    arm.point(at(1), 0),
    arm.point(at(0.9), -w * 0.6),
    arm.point(at(0.6), -w * 1.06),
    // The thumb, resting forward of the palm.
    arm.point(at(0.28), -w * 1.18),
  ];

  const legOut = (yy: number): Pt => ({
    x: leg.center(yy) + leg.outer(yy),
    y: yy,
  });
  const legIn = (yy: number): Pt => ({
    x: Math.max(0.15, leg.center(yy) - leg.inner(yy)),
    y: yy,
  });
  const midThigh = lerp(y.crotch, y.knee, 0.45);
  const lowerCalf = lerp(y.calf, y.ankle, 0.55);

  // A front-on foot reads as a short rounded wedge below the ankle.
  const c = leg.center(y.ankle);
  const a = leg.outer(y.ankle);
  const fh = H - y.ankle;
  const foot: Pt[] = [
    { x: c + a * 1.15, y: y.ankle + fh * 0.35 },
    { x: c + a * 1.05, y: y.ankle + fh * 0.82 },
    { x: c + a * 0.3, y: H },
    { x: c - a * 0.7, y: H - fh * 0.1 },
    { x: c - a * 1.02, y: y.ankle + fh * 0.5 },
  ];

  const right: Pt[] = [
    { x: half.neck * 0.92, y: y.chin - 3, sharp: true },
    { x: half.neck, y: y.chin + 2 },
    { x: half.neck * 1.12, y: y.neck - 0.8 },
    { x: lerp(half.neck, half.shoulder, 0.5), y: y.neck + 1.5 },
    { x: half.shoulder * 0.92, y: y.shoulder - 0.2 },
    ...outerArm,
    ...hand,
    ...innerArm,
    { x: half.chest * 0.97, y: y.armpit, sharp: true },
    { x: half.chest, y: y.chest },
    { x: L.halfAt(y.underbust), y: y.underbust },
    { x: half.waist, y: y.waist },
    { x: L.halfAt(lerp(y.waist, y.hip, 0.5)), y: lerp(y.waist, y.hip, 0.5) },
    { x: half.hip, y: y.hip },
    legOut(y.crotch + 2),
    legOut(midThigh),
    legOut(y.knee - 2),
    legOut(y.knee + 1.5),
    legOut(y.calf),
    legOut(lowerCalf),
    legOut(y.ankle),
    ...foot,
    legIn(y.ankle),
    legIn(lowerCalf),
    legIn(lerp(y.knee, y.ankle, 0.32)),
    legIn(y.knee + 1),
    legIn(midThigh),
    legIn(y.crotch + 4),
    { x: 0, y: y.crotch, sharp: true },
  ];

  const clavicle: Pt[] = [
    { x: half.neck * 0.85, y: y.neck + 1.6 },
    { x: half.shoulder * 0.45, y: y.neck + 2.4 },
    { x: half.shoulder * 0.78, y: y.shoulder - 0.4 },
  ];
  const kneecap: Pt[] = [
    { x: leg.center(y.knee) - leg.inner(y.knee) * 0.45, y: y.knee + 0.6 },
    { x: leg.center(y.knee), y: y.knee + 2 },
    { x: leg.center(y.knee) + leg.outer(y.knee) * 0.4, y: y.knee + 0.4 },
  ];

  return {
    height: H,
    head: head(L),
    silhouette: [...right, ...mirrored(right).slice(1)],
    contours: [...both(clavicle), ...both(kneecap)],
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

/**
 * The right half of a hem from the side seam in toward the middle. Flared
 * hems ripple where the fabric falls into folds.
 */
function hemline(
  sideX: number,
  sideY: number,
  centerY: number,
  ripple: number,
): Pt[] {
  const side: Pt = { x: sideX, y: sideY, sharp: true };
  if (ripple <= 0) return [side];
  return [
    side,
    { x: sideX * 0.78, y: lerp(sideY, centerY, 0.3) + ripple },
    { x: sideX * 0.52, y: lerp(sideY, centerY, 0.6) - ripple * 0.3 },
    { x: sideX * 0.26, y: lerp(sideY, centerY, 0.85) + ripple * 0.8 },
  ];
}

/** Soft folds falling from `fromY` to the hem, fanning out with the flare. */
function drapeFolds(
  fromY: number,
  fromHalf: number,
  hem: number,
  hemHalf: number,
): Pt[][] {
  return [0.78, 0.52, 0.26].flatMap((f) =>
    both([
      { x: fromHalf * f * 0.8, y: fromY },
      {
        x: lerp(fromHalf * f * 0.8, hemHalf * f, 0.6),
        y: lerp(fromY, hem, 0.6),
      },
      { x: hemHalf * f, y: hem - 0.5 },
    ]),
  );
}

/** Tops, dresses and outerwear: shoulders to hem, sleeves, neckline. */
function upperGarment(L: Landmarks, item: Cut): Garment {
  const { y, half, arm } = L;
  const cut = CUT[item.silhouette];
  const sleeve = item.sleeve ?? "long";
  const hem = hemY(L, item.length);
  const details = new Set(item.details ?? []);
  const open = item.category === "outerwear" && item.silhouette !== "wrap";
  const vNeck = item.silhouette === "wrap" || details.has("lapels") || open;
  const shirt = details.has("placket") && !open;

  // Boxy and relaxed cuts fall from the chest instead of following the waist.
  const halfAt = (at: number) => {
    const body = L.halfAt(at);
    const fall = Math.max(body, lerp(body, half.chest, cut.straight));
    const below = Math.max(0, (at - y.waist) / Math.max(1, hem - y.waist));
    return Math.max(body + 0.5, fall + cut.ease + cut.flare * below ** 1.3);
  };

  const neckX = sleeve === "none" ? half.neck + 2.5 : half.neck + 1.2;
  const shoulderPt: Pt = {
    x: half.shoulder + 0.4 + cut.ease * 0.4,
    y: y.shoulder - 0.4,
    sharp: true,
  };
  const ys = [
    y.armpit + 1.5,
    y.chest,
    y.underbust,
    y.waist,
    lerp(y.waist, y.hip, 0.5),
    y.hip,
    y.crotch,
    lerp(y.crotch, y.knee, 0.5),
    y.knee,
    lerp(y.knee, y.ankle, 0.5),
  ].filter((at) => at < hem - 2);

  const flared = cut.flare >= 2 && hem > y.hip;
  // Shirts have a curved shirttail: higher at the sides than the middle.
  const sideHem = shirt ? hem - 2.5 : hem;
  const hemCenter: Pt = {
    x: 0,
    y: shirt ? hem + 1.5 : hem + (cut.flare > 4 ? 1.5 : 0.4),
  };

  const right: Pt[] = [
    { x: neckX, y: y.neck - 0.6, sharp: true },
    ...(sleeve === "none"
      ? [
          // Straps, then the armhole scooping in under the arm.
          { x: neckX + 2.5, y: y.shoulder - 0.6, sharp: true },
          { x: half.chest - 1, y: y.armpit + 2, sharp: true },
        ]
      : [
          {
            x: lerp(neckX, shoulderPt.x, 0.5),
            y: y.neck + 1.1,
          },
          shoulderPt,
          { x: halfAt(y.armpit), y: y.armpit + 0.5, sharp: true },
        ]),
    ...ys.map((at) => ({ x: halfAt(at), y: at })),
    ...hemline(halfAt(sideHem), sideHem, hemCenter.y, flared ? 0.7 : 0),
  ];

  const dipY = vNeck
    ? y.chest + (open ? 3 : 1)
    : sleeve === "none"
      ? y.chest - 3
      : y.neck + 2.5;
  const dip: Pt = { x: 0, y: dipY, sharp: vNeck };

  const parts: Outline[] = [];
  const lines: Pt[][] = [];
  const folds: Pt[][] = [];
  const buttons: Pt[] = [];

  if (sleeve !== "none") {
    const t1 = sleeve === "short" ? 0.33 : shirt ? 0.97 : 0.95;
    const ease = (t: number) => cut.sleeveEase + 0.6 + cut.sleeveEase * 0.3 * t;
    const ts = [0.04, 0.3, ELBOW, 0.62, 0.86].filter((t) => t < t1 - 0.05);
    // The sleeve cap starts at the shoulder seam and rounds over the deltoid.
    const tube: Outline = [
      shoulderPt,
      ...ts.map((t) => arm.point(t, arm.half(t) + ease(t))),
      arm.point(t1, arm.half(t1) + ease(t1), true),
      arm.point(t1, -(arm.half(t1) + ease(t1)), true),
      ...ts
        .slice()
        .reverse()
        .filter((t) => t > 0.15)
        .map((t) => arm.point(t, -(arm.half(t) + ease(t)))),
      { x: halfAt(y.armpit) - 1, y: y.armpit + 1.5, sharp: true },
    ];
    parts.push(...both(tube));

    if (sleeve === "long") {
      if (shirt || details.has("ribbing")) {
        const tc = t1 - (shirt ? 0.09 : 0.07);
        const e = arm.half(tc) + ease(tc);
        lines.push(...both([arm.point(tc, e), arm.point(tc, -e)]));
      }
      // The inside of the elbow bunches.
      const crease = (t: number, from: number, to: number) => [
        arm.point(t, -(arm.half(t) + ease(t)) * from),
        arm.point(t + 0.04, -(arm.half(t) + ease(t)) * to),
      ];
      folds.push(
        ...both(crease(ELBOW - 0.03, 0.95, 0.2)),
        ...both(crease(ELBOW + 0.05, 0.9, 0.35)),
      );
    }
  }
  parts.push([dip, ...right, hemCenter, ...mirrored(right)]);

  const front = (from: number) => [
    { x: 0, y: from },
    { x: 0, y: hem },
  ];
  if (shirt) {
    // A pointed collar either side of the neck, meeting at the top button.
    for (const side of [1, -1]) {
      parts.push([
        { x: side * neckX * 0.7, y: y.neck - 1.2, sharp: true },
        { x: side * (neckX + 0.5), y: y.neck - 1.2 },
        { x: side * (neckX + 1.3), y: y.neck + 1.2 },
        { x: side * 2.4, y: y.neck + 4.6, sharp: true },
        { x: side * 0.2, y: y.neck + 2.4, sharp: true },
      ]);
    }
  }
  if (details.has("placket") || open) {
    lines.push(front(shirt ? y.neck + 3 : dipY));
    if (!open || details.has("placket")) {
      const from = shirt ? y.neck + 4 : dipY + 2;
      const n = Math.max(3, Math.round((hem - from) / 9));
      for (let i = 0; i < n; i++)
        buttons.push({ x: 0.9, y: lerp(from, hem - 3, i / (n - 1)) });
    }
  }
  if (details.has("lapels")) {
    // Notched lapels laid over the front, rolling down to the top button.
    for (const side of [1, -1]) {
      parts.push([
        { x: side * neckX, y: y.neck - 0.6, sharp: true },
        { x: side * (neckX + 2.6), y: y.neck + 3.2, sharp: true },
        { x: side * (neckX + 1.6), y: y.neck + 4.6, sharp: true },
        { x: side * half.chest * 0.6, y: y.chest - 0.5, sharp: true },
        { x: side * half.chest * 0.3, y: lerp(y.chest, dipY, 0.55) },
        { x: 0, y: dipY, sharp: true },
      ]);
    }
    lines.push(front(dipY));
    buttons.push({ x: 0.9, y: y.waist - 1 }, { x: 0.9, y: y.waist + 6 });
  }
  if (item.category === "outerwear" && hem > y.hip) {
    // Flap pockets at the hip.
    const py = lerp(y.waist, y.hip, 0.75);
    const px = halfAt(py);
    lines.push(
      ...both([
        { x: px * 0.35, y: py },
        { x: px * 0.8, y: py - 0.6 },
      ]),
    );
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
    // Cinched fabric gathers above and below the belt.
    for (const f of [-0.6, -0.2, 0.25, 0.65]) {
      folds.push(
        [
          { x: f * w * 1.08, y: y.waist - 10 },
          { x: f * w, y: y.waist - 2 },
        ],
        [
          { x: f * w, y: y.waist + 2 },
          { x: f * w * 1.15, y: y.waist + 14 },
        ],
      );
    }
  }
  if (details.has("ribbing")) {
    const w = halfAt(hem - 3);
    lines.push([
      { x: -w, y: hem - 3 },
      { x: w, y: hem - 3 },
    ]);
  }
  if (cut.ease >= 2.5 && !flared) {
    // Loose bodies fall in long diagonal folds from under the arms.
    folds.push(
      ...both([
        { x: halfAt(y.armpit) * 0.82, y: y.armpit + 4 },
        { x: halfAt(y.waist) * 0.7, y: lerp(y.armpit, sideHem, 0.6) },
        { x: halfAt(sideHem) * 0.55, y: sideHem - 2 },
      ]),
    );
  }
  if (flared) {
    folds.push(...drapeFolds(y.hip, halfAt(y.hip), hem, halfAt(sideHem)));
  }
  return { parts, lines, folds, buttons };
}

/** Trousers and skirts, waistband down. */
function lowerGarment(L: Landmarks, item: Cut): Garment {
  const { y, half, leg } = L;
  const cut = CUT[item.silhouette];
  const hem = hemY(L, item.length);
  const details = new Set(item.details ?? []);
  const top = y.waist + 1;
  const waistband = (w: number): Pt[] => [
    { x: -w, y: top + 3 },
    { x: w, y: top + 3 },
  ];

  if (item.silhouette === "a-line") {
    const hemHalf = L.halfAt(hem) + cut.flare;
    const right: Pt[] = [
      { x: half.waist + 0.6, y: top, sharp: true },
      { x: half.hip + cut.ease, y: y.hip },
      ...hemline(hemHalf, hem, hem + 1.2, 0.8),
    ];
    const lines: Pt[][] = [waistband(half.waist + 0.4)];
    if (details.has("pleats")) {
      for (const f of [-0.66, -0.33, 0, 0.33, 0.66]) {
        lines.push([
          { x: f * half.waist, y: top + 3 },
          { x: f * hemHalf, y: hem },
        ]);
      }
    }
    return {
      parts: [[...right, { x: 0, y: hem + 1.2 }, ...mirrored(right)]],
      lines,
      folds: drapeFolds(y.hip + 2, half.hip + cut.ease, hem, hemHalf),
      buttons: [],
    };
  }

  // Ease off the leg, blending toward a straight fall from the thigh.
  const thigh = leg.outer(y.crotch) + cut.ease;
  const off = (base: number) => {
    const fitted = base + cut.ease;
    return lerp(fitted, Math.max(fitted, thigh * 0.85), cut.straight);
  };
  // Flare goes on the outside seam only, so wide legs still read as two legs.
  const flareAt = (at: number) =>
    cut.flare * Math.max(0, (at - y.crotch) / (hem - y.crotch)) ** 1.5;
  const legYs = [y.crotch, lerp(y.crotch, y.knee, 0.5), y.knee, hem];
  const outer = legYs.map((at, i) => ({
    x: leg.center(at) + off(leg.outer(at)) + flareAt(at),
    y: at,
    sharp: i === legYs.length - 1,
  }));
  const innerX = (at: number) =>
    Math.max(0.8, leg.center(at) - off(leg.inner(at)) + flareAt(at) * 0.3);
  const inner = legYs
    .map((at, i) => ({
      x: innerX(at),
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

  const lines: Pt[][] = [waistband(half.waist + 0.5)];
  // Slanted front pockets.
  lines.push(
    ...both([
      { x: half.waist * 0.62, y: top + 3 },
      { x: half.hip * 0.98, y: lerp(top, y.hip, 0.75) },
    ]),
  );
  if (details.has("crease")) {
    lines.push(
      ...both([
        { x: leg.center(y.hip), y: y.hip + 3 },
        { x: leg.center(hem) + flareAt(hem) * 0.65, y: hem },
      ]),
    );
  }
  // Fly seam.
  lines.push([
    { x: 0, y: top + 3 },
    { x: 0, y: y.crotch - 1 },
  ]);

  const folds: Pt[][] = [];
  // Crotch whiskers.
  folds.push(
    ...both([
      { x: 1.2, y: y.crotch - 0.5 },
      { x: half.hip * 0.42, y: y.crotch - 3.5 },
    ]),
  );
  if (cut.flare >= 2) {
    // Wide legs fall in long folds off the thigh.
    for (const f of [0.45, 0.85]) {
      folds.push(
        ...both([
          {
            x: leg.center(y.crotch) + leg.outer(y.crotch) * f * 0.6,
            y: y.crotch + 6,
          },
          {
            x: leg.center(hem) + (off(leg.outer(hem)) + flareAt(hem)) * f,
            y: hem - 1,
          },
        ]),
      );
    }
  } else if (item.length === "ankle") {
    // Full-length legs break over the foot.
    folds.push(
      ...both([
        { x: innerX(hem) + 0.8, y: hem - 6 },
        { x: leg.center(hem) + 1, y: hem - 4.5 },
        { x: leg.center(hem) + off(leg.outer(hem)) - 0.6, y: hem - 6.5 },
      ]),
    );
  }

  return {
    parts: [[...right, crotch, ...mirrored(right)]],
    lines,
    folds,
    buttons: [{ x: 0, y: top + 1.5 }],
  };
}

export function garmentOutlines(L: Landmarks, item: Cut): Garment {
  return item.category === "bottom"
    ? lowerGarment(L, item)
    : upperGarment(L, item);
}

/** Plain pieces that complete an outfit around the item. */
const BASE_TOP: Cut = {
  category: "top",
  silhouette: "fitted",
  sleeve: "short",
  // Tucked in: the hem sits just under the waistband.
  length: "waist",
};
const BASE_BOTTOM: Cut = {
  category: "bottom",
  silhouette: "straight",
  length: "ankle",
};

/**
 * The pieces plus whatever plain pieces they need to read as an outfit, back
 * to front: a top goes over trousers, a bottom over a tucked-in tee,
 * outerwear over both. A dress takes the place of the top and bottoms.
 */
export function outfit(L: Landmarks, pieces: Cut[]): Layer[] {
  const own = (category: Cut["category"]): Layer | null => {
    const piece = pieces.findIndex((p) => p.category === category);
    return piece < 0
      ? null
      : { role: "item", garment: garmentOutlines(L, pieces[piece]), piece };
  };
  const dress = own("dress");
  const top = own("top");
  const bottom = own("bottom");
  const outer = own("outerwear");
  const baseTop: Layer = {
    role: "baseTop",
    garment: garmentOutlines(L, BASE_TOP),
  };
  const baseBottom: Layer = {
    role: "baseBottom",
    garment: garmentOutlines(L, BASE_BOTTOM),
  };
  const under = dress
    ? [dress]
    : bottom && !top
      ? [baseTop, bottom]
      : [bottom ?? baseBottom, top ?? baseTop];
  return outer ? [...under, outer] : under;
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * Bands to lay over a garment for its pattern, in the box's units: plaid
 * crosses wide bands both ways with thin lines between, stripes run
 * vertically. Prints have no simple repeat and stay solid.
 */
export function patternBands(
  box: Box,
  pattern: "solid" | "plaid" | "stripes" | "print",
  cm: number,
): Box[] {
  const bands: Box[] = [];
  const across = (step: number, size: number, offset = 0) => {
    for (let y = box.y + offset; y < box.y + box.height; y += step)
      bands.push({ x: box.x, y, width: box.width, height: size });
  };
  const down = (step: number, size: number, offset = 0) => {
    for (let x = box.x + offset; x < box.x + box.width; x += step)
      bands.push({ x, y: box.y, width: size, height: box.height });
  };
  if (pattern === "plaid") {
    across(5 * cm, 1.8 * cm);
    down(5 * cm, 1.8 * cm);
    across(5 * cm, 0.3 * cm, 3.4 * cm);
    down(5 * cm, 0.3 * cm, 3.4 * cm);
  } else if (pattern === "stripes") {
    down(2.2 * cm, 0.8 * cm);
  }
  return bands;
}
