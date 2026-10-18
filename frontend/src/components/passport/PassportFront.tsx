import {
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Image,
  Line,
  matchFont,
  Path,
  Rect,
  RoundedRect,
  Skia,
  Text,
  useImage,
  vec,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { mix } from "@/lib/color";
import {
  CARD_PAD,
  CardSurface,
  Holo,
  useCardStock,
  rosettePath,
  type HoloUniforms,
} from "./CardSurface";
import { sansFont, serifFont } from "./fonts";
import type { PassportData } from "./usePassportData";

const GRAYSCALE = [
  0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0,
  0, 1, 0,
];

function describeTraits(t: PassportData["traits"]) {
  const pick = (v: number, neg: string, mid: string, pos: string) =>
    v < -0.2 ? neg : v > 0.2 ? pos : mid;
  return {
    undertone: pick(t.warmth, "Cool", "Neutral", "Warm"),
    contrast: pick(t.clarity, "Soft", "Medium", "Bright"),
  };
}

/** "SILO MEMBER" -> "Silo Member": a signature is written, not shouted. */
function signatureText(name: string): string {
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type Props = {
  width: number;
  height: number;
  data: PassportData;
  fontMgr: SkTypefaceFontProvider;
  /** Thin lines: no glitter, which would read as gaps at this width. */
  uniforms: HoloUniforms;
  /** Filled areas: with glitter. */
  fillUniforms: HoloUniforms;
};

export function PassportFront({
  width: w,
  height: h,
  data,
  fontMgr: mgr,
  uniforms,
  fillUniforms,
}: Props) {
  const u = w / 100;
  const { season } = data;
  const { ink, muted } = useCardStock(season);
  const photo = useImage(data.selfieUri ?? null);
  const traits = describeTraits(data.traits);

  const fonts = useMemo(() => {
    const mrzProbe = matchFont({ fontFamily: "Menlo", fontSize: 10 });
    // Size the MRZ so its 36 characters span the card's inner width exactly.
    const mrzSize = (10 * (88 * u)) / mrzProbe.getTextWidth("<".repeat(36));
    return {
      // Set like onboarding: Instrument Serif for the wordmark and season,
      // DM Sans for the labels and values.
      wordmark: serifFont(mgr, 11 * u, true),
      subtitle: sansFont(mgr, 2.3 * u, true),
      label: sansFont(mgr, 2.1 * u, true),
      value: sansFont(mgr, 3.7 * u),
      season: serifFont(mgr, 6.4 * u),
      mrz: matchFont({ fontFamily: "Menlo", fontSize: mrzSize }),
      signature: matchFont({ fontFamily: "Snell Roundhand", fontSize: 6 * u }),
      micro: sansFont(mgr, 1.5 * u, true),
    };
  }, [u, mgr]);

  const seal = useMemo(
    () => rosettePath(w - 14 * u, 12 * u, 7.5 * u, 10, 6),
    [w, u],
  );

  const photoRect = { x: 7 * u, y: 24 * u, width: 30 * u, height: 39 * u };
  const photoClip = Skia.RRectXY(
    Skia.XYWHRect(photoRect.x, photoRect.y, photoRect.width, photoRect.height),
    2 * u,
    2 * u,
  );

  const fields: [string, string][] = [
    ["NAME / NOM", data.name],
    ["UNDERTONE", traits.undertone],
    ["CONTRAST", traits.contrast],
    ["ISSUED / DÉLIVRÉ", data.issued],
  ];

  const meters: [string, string, number][] = [
    ["COOL", "WARM", data.traits.warmth],
    ["LIGHT", "DEEP", data.traits.depth],
    ["SOFT", "BRIGHT", data.traits.clarity],
  ];

  const micro = `SILO · ${season.name.toUpperCase()} · `.repeat(12);

  return (
    <Canvas style={{ width: w + 2 * CARD_PAD, height: h + 2 * CARD_PAD }}>
      <CardSurface
        width={w}
        height={h}
        season={season}
        uniforms={uniforms}
        fillUniforms={fillUniforms}
        rosette={[0.72, 0.5]}
      >
        {/* Header */}
        <Text x={7 * u} y={15 * u} text="Silo" font={fonts.wordmark}>
          <Holo uniforms={fillUniforms} />
        </Text>
        <Text
          x={7.4 * u}
          y={19.6 * u}
          text="COLOR PASSPORT · PASSEPORT CHROMATIQUE"
          font={fonts.subtitle}
          color={muted}
        />
        <Path path={seal} style="stroke" strokeWidth={0.7}>
          <Holo uniforms={uniforms} />
        </Path>
        <Circle
          cx={w - 14 * u}
          cy={12 * u}
          r={8.2 * u}
          style="stroke"
          strokeWidth={1}
        >
          <Holo uniforms={uniforms} />
        </Circle>

        {/* Portrait */}
        <Group clip={photoClip}>
          <Rect {...photoRect} color={mix(season.signature, "#ffffff", 0.6)} />
          {photo ? (
            <Image image={photo} {...photoRect} fit="cover" />
          ) : (
            <Group color={mix(season.signature, "#ffffff", 0.25)}>
              <Circle
                cx={photoRect.x + 15 * u}
                cy={photoRect.y + 15 * u}
                r={7 * u}
              />
              <Circle
                cx={photoRect.x + 15 * u}
                cy={photoRect.y + 37 * u}
                r={14 * u}
              />
            </Group>
          )}
        </Group>
        <RoundedRect {...photoRect} r={2 * u} style="stroke" strokeWidth={1.2}>
          <Holo uniforms={uniforms} />
        </RoundedRect>

        {/* Season and fields */}
        <Text
          x={42 * u}
          y={28 * u}
          text="SEASON / SAISON"
          font={fonts.label}
          color={muted}
        />
        <Text
          x={42 * u}
          y={34 * u}
          text={season.name}
          font={fonts.season}
          color={ink}
        />
        {fields.map(([label, value], i) => (
          <Group key={label}>
            <Text
              x={42 * u}
              y={(40.5 + i * 7.4) * u}
              text={label}
              font={fonts.label}
              color={muted}
            />
            <Text
              x={42 * u}
              y={(44.8 + i * 7.4) * u}
              text={value}
              font={fonts.value}
              color={ink}
            />
          </Group>
        ))}

        {/* Palette */}
        <Text
          x={7 * u}
          y={74 * u}
          text="PALETTE"
          font={fonts.label}
          color={muted}
        />
        <Text
          x={93 * u - fonts.label.getTextWidth(`No. ${data.number}`)}
          y={74 * u}
          text={`No. ${data.number}`}
          font={fonts.label}
          color={muted}
        />
        {season.best.map((color, i) => {
          const cx = 10.8 * u + i * 11.15 * u;
          return (
            <Group key={`${color}-${i}`}>
              <Circle cx={cx} cy={81 * u} r={4.2 * u} color={color} />
              <Circle
                cx={cx}
                cy={81 * u}
                r={4.8 * u}
                style="stroke"
                strokeWidth={1.1}
              >
                <Holo uniforms={uniforms} />
              </Circle>
            </Group>
          );
        })}

        {/* Trait meters */}
        {meters.map(([lo, hi, value], i) => {
          const y = (94 + i * 7) * u;
          const x0 = 7 * u;
          const x1 = 93 * u;
          const pos = x0 + ((value + 1) / 2) * (x1 - x0);
          return (
            <Group key={lo}>
              <Text
                x={x0}
                y={y - 1.6 * u}
                text={lo}
                font={fonts.label}
                color={muted}
              />
              <Text
                x={x1 - fonts.label.getTextWidth(hi)}
                y={y - 1.6 * u}
                text={hi}
                font={fonts.label}
                color={muted}
              />
              <Line
                p1={vec(x0, y)}
                p2={vec(x1, y)}
                color={ink}
                strokeWidth={0.6}
                opacity={0.35}
              />
              <Circle cx={pos} cy={y} r={1.6 * u}>
                <Holo uniforms={uniforms} />
              </Circle>
              <Circle
                cx={pos}
                cy={y}
                r={1.6 * u}
                style="stroke"
                strokeWidth={0.6}
                color={ink}
              />
            </Group>
          );
        })}

        {/* Ghost portrait, as printed beside the MRZ on real passports */}
        {photo ? (
          <Group
            opacity={0.28}
            clip={Skia.RRectXY(
              Skia.XYWHRect(79 * u, 111 * u, 14 * u, 16 * u),
              u,
              u,
            )}
          >
            <Image
              image={photo}
              x={79 * u}
              y={111 * u}
              width={14 * u}
              height={16 * u}
              fit="cover"
            >
              <ColorMatrix matrix={GRAYSCALE} />
            </Image>
          </Group>
        ) : null}
        {/* Holder's signature */}
        <Text
          x={7 * u}
          y={113.5 * u}
          text="HOLDER'S SIGNATURE / SIGNATURE DU TITULAIRE"
          font={fonts.label}
          color={muted}
        />
        <Text
          x={8 * u}
          y={122.5 * u}
          text={signatureText(data.name)}
          font={fonts.signature}
          color={ink}
        />
        <Line
          p1={vec(7 * u, 124 * u)}
          p2={vec(70 * u, 124 * u)}
          color={ink}
          strokeWidth={0.5}
          opacity={0.35}
        />

        {/* Machine-readable zone */}
        <Rect
          x={4 * u}
          y={128 * u}
          width={92 * u}
          height={14 * u}
          color="#ffffff"
          opacity={0.4}
        />
        <Text
          x={6 * u}
          y={133.8 * u}
          text={data.mrz[0]}
          font={fonts.mrz}
          color={ink}
        />
        <Text
          x={6 * u}
          y={139.6 * u}
          text={data.mrz[1]}
          font={fonts.mrz}
          color={ink}
        />

        <Text
          x={5 * u}
          y={h - 1.1 * u}
          text={micro}
          font={fonts.micro}
          color={ink}
          opacity={0.35}
        />
      </CardSurface>
    </Canvas>
  );
}
