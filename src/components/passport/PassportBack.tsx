import {
  Canvas,
  Circle,
  Group,
  Line,
  matchFont,
  Skia,
  Text,
  TextPath,
  vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { mix } from "@/lib/color";
import {
  CARD_PAD,
  CardSurface,
  Holo,
  inkColor,
  type HoloUniforms,
} from "./CardSurface";
import type { PassportData } from "./usePassportData";

type Props = {
  width: number;
  height: number;
  data: PassportData;
  uniforms: HoloUniforms;
  fillUniforms: HoloUniforms;
};

export function PassportBack({
  width: w,
  height: h,
  data,
  uniforms,
  fillUniforms,
}: Props) {
  const u = w / 100;
  const { season } = data;
  const ink = inkColor(season);
  const muted = mix(ink, "#ffffff", 0.35);

  const fonts = useMemo(
    () => ({
      title: matchFont({
        fontFamily: "Didot",
        fontSize: 6.4 * u,
        fontWeight: "bold",
      }),
      subtitle: matchFont({
        fontFamily: "Avenir Next",
        fontSize: 2.3 * u,
        fontWeight: "600",
      }),
      label: matchFont({
        fontFamily: "Avenir Next",
        fontSize: 3.2 * u,
        fontWeight: "500",
      }),
      value: matchFont({
        fontFamily: "Avenir Next",
        fontSize: 3.4 * u,
        fontWeight: "600",
      }),
      small: matchFont({
        fontFamily: "Avenir Next",
        fontSize: 2.1 * u,
        fontWeight: "600",
      }),
      stamp: matchFont({
        fontFamily: "Avenir Next",
        fontSize: 2.3 * u,
        fontWeight: "700",
      }),
      stampCenter: matchFont({
        fontFamily: "Didot",
        fontSize: 4.4 * u,
        fontWeight: "bold",
      }),
    }),
    [u],
  );

  // Stamp: a ring of text around a circle, rotated like it was pressed by hand.
  const stamp = { cx: 74 * u, cy: 127 * u, r: 13 * u };
  const stampRing = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(stamp.cx, stamp.cy, stamp.r - 3.4 * u);
    return path;
  }, [stamp.cx, stamp.cy, stamp.r, u]);

  const rowTop = 30 * u;
  const rowGap = 8.2 * u;

  return (
    <Canvas style={{ width: w + 2 * CARD_PAD, height: h + 2 * CARD_PAD }}>
      <CardSurface
        width={w}
        height={h}
        season={season}
        uniforms={uniforms}
        fillUniforms={fillUniforms}
        rosette={[0.3, 0.42]}
      >
        <Text x={7 * u} y={15 * u} text="Body Record" font={fonts.title}>
          <Holo uniforms={fillUniforms} />
        </Text>
        <Text
          x={7.3 * u}
          y={20 * u}
          text="MENSURATIONS · MEASUREMENTS & FIT"
          font={fonts.subtitle}
          color={muted}
        />

        {data.record.map(({ label, value }, i) => {
          const y = rowTop + i * rowGap;
          const valueX = 93 * u - fonts.value.getTextWidth(value);
          return (
            <Group key={label}>
              <Text
                x={7 * u}
                y={y}
                text={label}
                font={fonts.label}
                color={muted}
              />
              <Text
                x={valueX}
                y={y}
                text={value}
                font={fonts.value}
                color={ink}
              />
              <Line
                p1={vec(7 * u, y + 2.6 * u)}
                p2={vec(93 * u, y + 2.6 * u)}
                color={ink}
                strokeWidth={0.4}
                opacity={0.18}
              />
            </Group>
          );
        })}

        <Text
          x={7 * u}
          y={118 * u}
          text="NEUTRALS"
          font={fonts.small}
          color={muted}
        />
        {season.neutrals.map((color, i) => (
          <Circle
            key={`n-${i}`}
            cx={10 * u + i * 8 * u}
            cy={124 * u}
            r={3 * u}
            color={color}
          ></Circle>
        ))}
        <Text
          x={7 * u}
          y={134 * u}
          text="GO EASY ON"
          font={fonts.small}
          color={muted}
        />
        {season.avoid.map((color, i) => {
          const cx = 10 * u + i * 8 * u;
          const cy = 140 * u;
          return (
            <Group key={`a-${i}`}>
              <Circle cx={cx} cy={cy} r={3 * u} color={color} />
              <Line
                p1={vec(cx - 2.6 * u, cy + 2.6 * u)}
                p2={vec(cx + 2.6 * u, cy - 2.6 * u)}
                color="#ffffff"
                strokeWidth={1.4}
              />
            </Group>
          );
        })}

        <Group
          transform={[{ rotate: -0.22 }]}
          origin={vec(stamp.cx, stamp.cy)}
          opacity={0.78}
        >
          <Circle
            cx={stamp.cx}
            cy={stamp.cy}
            r={stamp.r}
            style="stroke"
            strokeWidth={1.6}
            color={season.signature}
          />
          <Circle
            cx={stamp.cx}
            cy={stamp.cy}
            r={stamp.r - 1.6 * u}
            style="stroke"
            strokeWidth={0.6}
            color={season.signature}
          />
          <TextPath
            path={stampRing}
            text="SILO · VERIFIED FIT · SILO · VERIFIED FIT · "
            font={fonts.stamp}
            color={season.signature}
            initialOffset={0}
          />
          <Text
            x={stamp.cx - fonts.stampCenter.getTextWidth("SILO") / 2}
            y={stamp.cy + 1.4 * u}
            text="SILO"
            font={fonts.stampCenter}
            color={season.signature}
          />
          <Text
            x={stamp.cx - fonts.small.getTextWidth(data.issued) / 2}
            y={stamp.cy + 5.4 * u}
            text={data.issued}
            font={fonts.small}
            color={season.signature}
          />
        </Group>
      </CardSurface>
    </Canvas>
  );
}
