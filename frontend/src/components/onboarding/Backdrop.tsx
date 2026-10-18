import { BlurMask, Canvas, Fill, Oval } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BACKDROPS, FRAME_WIDTH, type BackdropId } from "@/theme/backdrops";

function BackdropCanvas({ id }: { id: BackdropId }) {
  const { width, height } = useWindowDimensions();
  const { base, blobs } = BACKDROPS[id];
  // Blobs are laid out on the 402pt design frame; scale them to this screen.
  const k = width / FRAME_WIDTH;
  return (
    <Canvas style={{ width, height }}>
      <Fill color={base} />
      {blobs.map((b, i) => (
        <Oval
          key={i}
          x={(b.x - b.rx) * k}
          y={(b.y - b.ry) * k}
          width={b.rx * 2 * k}
          height={b.ry * 2 * k}
          color={b.color}
        >
          <BlurMask blur={b.blur * k} style="normal" />
        </Oval>
      ))}
    </Canvas>
  );
}

/**
 * The soft gradient behind every onboarding screen. Changing `id` fades the
 * new one in over the old, which is how results turn into the user's season.
 */
export function Backdrop({ id }: { id: BackdropId }) {
  const [layers, setLayers] = useState({ under: id, over: id });
  useEffect(() => {
    setLayers((l) => (l.over === id ? l : { under: l.over, over: id }));
  }, [id]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BackdropCanvas id={layers.under} />
      <Animated.View
        key={layers.over}
        entering={FadeIn.duration(900)}
        style={StyleSheet.absoluteFill}
      >
        <BackdropCanvas id={layers.over} />
      </Animated.View>
    </View>
  );
}
