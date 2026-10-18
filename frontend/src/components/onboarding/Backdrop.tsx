import { BlurMask, Canvas, Fill, Oval } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { familyOf } from "@/data/families";
import { useTheme } from "@/theme";
import {
  BACKDROPS,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  type BackdropId,
} from "@/theme/backdrops";

function BackdropCanvas({
  id,
  width,
  height,
  span,
}: {
  id: BackdropId;
  width: number;
  height: number;
  /**
   * How much of the frame, from the top, to fit into the box's height.
   * Without it the frame scales by width alone, as on a full screen.
   */
  span?: number;
}) {
  const { base, blobs } = BACKDROPS[id];
  // Blobs are laid out on the 402pt design frame; scale them to this box.
  const kx = width / FRAME_WIDTH;
  const ky = span ? height / span : kx;
  const kb = Math.sqrt(kx * ky);
  return (
    <Canvas style={{ width, height }}>
      <Fill color={base} />
      {blobs.map((b, i) => (
        <Oval
          key={i}
          x={(b.x - b.rx) * kx}
          y={(b.y - b.ry) * ky}
          width={b.rx * 2 * kx}
          height={b.ry * 2 * ky}
          color={b.color}
        >
          <BlurMask blur={b.blur * kb} style="normal" />
        </Oval>
      ))}
    </Canvas>
  );
}

/** The backdrop for the user's season, or the neutral one before analysis. */
export function useSeasonBackdrop(): BackdropId {
  const season = useTheme().season;
  return season ? familyOf(season.id) : "neutral";
}

/**
 * The soft gradient behind every onboarding screen. Changing `id` fades the
 * new one in over the old, which is how results turn into the user's season.
 */
export function Backdrop({ id }: { id: BackdropId }) {
  const { width, height } = useWindowDimensions();
  const [layers, setLayers] = useState({ under: id, over: id });
  useEffect(() => {
    setLayers((l) => (l.over === id ? l : { under: l.over, over: id }));
  }, [id]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BackdropCanvas id={layers.under} width={width} height={height} />
      <Animated.View
        key={layers.over}
        entering={FadeIn.duration(900)}
        style={StyleSheet.absoluteFill}
      >
        <BackdropCanvas id={layers.over} width={width} height={height} />
      </Animated.View>
    </View>
  );
}

/**
 * A backdrop fitted into whatever box holds it, so a button or a panel
 * carries the same gradient as the screen behind it. `span` picks how much
 * of the frame shows: all of it, or just the top for a calmer slice.
 */
export function BackdropFill({
  id,
  span = FRAME_HEIGHT,
  style,
}: {
  id: BackdropId;
  span?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      style={[StyleSheet.absoluteFill, style]}
    >
      {size.width > 0 ? <BackdropCanvas id={id} span={span} {...size} /> : null}
    </View>
  );
}
