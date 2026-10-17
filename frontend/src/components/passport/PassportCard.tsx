import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import { CARD_PAD } from "./CardSurface";
import { rgb01 } from "./holoShader";
import { PassportBack } from "./PassportBack";
import { PassportFront } from "./PassportFront";
import type { PassportData } from "./usePassportData";
import { useCardTilt } from "./useCardTilt";

/** Height / width, close to a passport booklet page. */
export const CARD_ASPECT = 1.47;

const MAX_ROTATE_X = 10;
const MAX_ROTATE_Y = 14;
const PERSPECTIVE = 900;

/**
 * The 3D passport. Both faces are separate Skia canvases stacked in one view;
 * the whole stack rotates with tilt, and the back is pre-rotated 180deg so a
 * flip simply adds 180deg. Faces swap visibility at the edge-on point, when
 * neither is visible, so nothing pops.
 */
export function PassportCard({
  data,
  width,
}: {
  data: PassportData;
  width: number;
}) {
  const height = width * CARD_ASPECT;
  const { tiltX, tiltY, flip, dragX, gesture } = useCardTilt(width, height);

  // One shimmer sweep on mount, so the foil announces itself.
  useEffect(() => {
    dragX.value = -0.9;
    dragX.value = withTiming(0, {
      duration: 1600,
      easing: Easing.out(Easing.cubic),
    });
  }, [dragX]);

  const { signature, best } = data.season;
  const tints = {
    tintA: rgb01(signature),
    tintB: rgb01(best[1]),
    tintC: rgb01(best[2]),
  };
  const fillUniforms = useDerivedValue(() => ({
    resolution: [width, height],
    tilt: [tiltX.value, tiltY.value],
    ...tints,
    glitter: 1,
  }));
  const uniforms = useDerivedValue(() => ({
    ...fillUniforms.value,
    glitter: 0,
  }));

  // Each face gets the same tilt plus its own base turn.
  const face = (side: 0 | 1) => () => {
    "worklet";
    const turn = flip.value * 180 + side * 180;
    const showing = side === 0 ? flip.value < 0.5 : flip.value >= 0.5;
    return {
      opacity: showing ? 1 : 0,
      transform: [
        { perspective: PERSPECTIVE },
        { rotateX: `${-tiltY.value * MAX_ROTATE_X}deg` },
        { rotateY: `${tiltX.value * MAX_ROTATE_Y + turn}deg` },
      ],
    };
  };
  const frontStyle = useAnimatedStyle(face(0));
  const backStyle = useAnimatedStyle(face(1));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ width, height }}
        accessibilityRole="image"
        accessibilityLabel={`Silo passport, ${data.season.name}`}
      >
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.face, frontStyle]}>
            <PassportFront
              width={width}
              height={height}
              data={data}
              uniforms={uniforms}
              fillUniforms={fillUniforms}
            />
          </Animated.View>
          <Animated.View style={[styles.face, backStyle]}>
            <PassportBack
              width={width}
              height={height}
              data={data}
              uniforms={uniforms}
              fillUniforms={fillUniforms}
            />
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  face: {
    position: "absolute",
    left: -CARD_PAD,
    top: -CARD_PAD,
    right: -CARD_PAD,
    bottom: -CARD_PAD,
    backfaceVisibility: "hidden",
  },
});
