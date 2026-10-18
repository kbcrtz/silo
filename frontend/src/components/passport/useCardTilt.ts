import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  SensorType,
  useAnimatedSensor,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const clamp = (v: number, min = -1, max = 1) => {
  "worklet";
  return Math.min(max, Math.max(min, v));
};

/** Change in the gravity direction (as a fraction of g) that maps to full tilt: about 15 degrees. */
const GYRO_RANGE = 0.25;
/**
 * Seconds for the neutral pose to drift to how the phone is being held, so any
 * holding angle becomes "flat". Time-based, so it behaves the same at 60Hz and
 * 120Hz; too fast and ordinary tilts are absorbed before they show.
 */
const RECENTER_SECONDS = 4;
/** Seconds of smoothing on raw sensor readings, to hide sensor jitter. */
const SMOOTHING_SECONDS = 0.06;
/** Flip a sign if tilting the phone turns the card the wrong way on device. */
const X_SIGN = -1;
const Y_SIGN = -1;

const SPRING_BACK = { damping: 12, stiffness: 120 };
const FLIP_SPRING = { damping: 16, stiffness: 90 };

function haptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Two kinds of motion, each -1..1 per axis:
 * - card (dragX/dragY): the card's 3D rotation, from a drag only, springing
 *   back on release. The card never moves on its own.
 * - foil (foilX/foilY): the holographic shimmer, from the drag plus the
 *   direction of gravity relative to the phone (unless Reduce Motion is set)
 *   plus `sweep`, a one-off shimmer the caller can animate.
 *
 * Also owns the tap-to-flip state, 0 (front) to 1 (back).
 *
 * Gravity rather than the rotation sensor's roll/pitch: Euler angles are
 * unstable near upright, which is exactly how a phone is held to look at the
 * card. Readings are normalized by their own magnitude, so the units don't
 * matter. The simulator has no motion sensor, so drag is the way to test there.
 */
export function useCardTilt(width: number, height: number) {
  const reduceMotion = useReducedMotion();
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: "auto" });

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const gyroX = useSharedValue(0);
  const gyroY = useSharedValue(0);
  const baseX = useSharedValue<number | null>(null);
  const baseZ = useSharedValue(0);
  const sweep = useSharedValue(0);
  const flip = useSharedValue(0);

  useFrameCallback((frame) => {
    // Not gated on sensor.isAvailable: that flag is captured into this worklet
    // once, before registration finishes, and stays false even while readings
    // arrive. An all-zero reading (no sensor yet) is skipped below instead.
    if (reduceMotion) return;
    const { x, y, z } = sensor.sensor.value;
    const magnitude = Math.hypot(x, y, z);
    if (magnitude < 0.01) return;
    const gx = x / magnitude; // left/right tilt
    const gz = z / magnitude; // toward/away tilt
    if (baseX.value === null) {
      baseX.value = gx;
      baseZ.value = gz;
    }
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    const recenter = 1 - Math.exp(-dt / RECENTER_SECONDS);
    const smooth = 1 - Math.exp(-dt / SMOOTHING_SECONDS);
    baseX.value += (gx - baseX.value) * recenter;
    baseZ.value += (gz - baseZ.value) * recenter;
    const targetX = clamp((X_SIGN * (gx - baseX.value)) / GYRO_RANGE);
    const targetY = clamp((Y_SIGN * (gz - baseZ.value)) / GYRO_RANGE);
    gyroX.value += (targetX - gyroX.value) * smooth;
    gyroY.value += (targetY - gyroY.value) * smooth;
  });

  const foilX = useDerivedValue(() =>
    clamp(dragX.value + gyroX.value + sweep.value),
  );
  const foilY = useDerivedValue(() => clamp(dragY.value + gyroY.value));

  // Horizontal drags tilt (and then track both axes); vertical drags fail
  // fast so the screen's ScrollView keeps scrolling.
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onChange((e) => {
      dragX.value = clamp(e.translationX / (width * 0.45));
      dragY.value = clamp(e.translationY / (height * 0.45));
    })
    .onFinalize(() => {
      dragX.value = withSpring(0, SPRING_BACK);
      dragY.value = withSpring(0, SPRING_BACK);
    });

  const tap = Gesture.Tap().onEnd(() => {
    flip.value = withSpring(flip.value > 0.5 ? 0 : 1, FLIP_SPRING);
    runOnJS(haptic)();
  });

  return {
    dragX,
    dragY,
    foilX,
    foilY,
    sweep,
    flip,
    gesture: Gesture.Exclusive(pan, tap),
  };
}
