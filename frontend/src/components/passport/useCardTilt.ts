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

/** Radians of device rotation that map to full tilt. */
const GYRO_RANGE = 0.35;
/** Per-frame pull of the neutral pose toward the current one, so any holding angle becomes "flat". */
const RECENTER = 0.015;
/** Per-frame smoothing of raw sensor readings. */
const SMOOTHING = 0.2;
/** Flip the sign here if tilting the phone moves the foil the wrong way on device. */
const ROLL_SIGN = 1;
const PITCH_SIGN = 1;

const SPRING_BACK = { damping: 12, stiffness: 120 };
const FLIP_SPRING = { damping: 16, stiffness: 90 };

function haptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Card tilt in -1..1 per axis, from two sources added together: the device's
 * rotation sensor (subtle, always on unless Reduce Motion is set) and a drag
 * gesture that springs back on release. Also owns the tap-to-flip state,
 * 0 (front) to 1 (back).
 *
 * The simulator has no motion sensor, so drag is the way to test there.
 */
export function useCardTilt(width: number, height: number) {
  const reduceMotion = useReducedMotion();
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: "auto" });

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const gyroX = useSharedValue(0);
  const gyroY = useSharedValue(0);
  const baseRoll = useSharedValue<number | null>(null);
  const basePitch = useSharedValue(0);
  const flip = useSharedValue(0);

  useFrameCallback(() => {
    if (reduceMotion || !sensor.isAvailable) return;
    const { roll, pitch } = sensor.sensor.value;
    if (baseRoll.value === null) {
      baseRoll.value = roll;
      basePitch.value = pitch;
    }
    baseRoll.value += (roll - baseRoll.value) * RECENTER;
    basePitch.value += (pitch - basePitch.value) * RECENTER;
    const targetX = clamp((ROLL_SIGN * (roll - baseRoll.value)) / GYRO_RANGE);
    const targetY = clamp(
      (PITCH_SIGN * (pitch - basePitch.value)) / GYRO_RANGE,
    );
    gyroX.value += (targetX - gyroX.value) * SMOOTHING;
    gyroY.value += (targetY - gyroY.value) * SMOOTHING;
  });

  const tiltX = useDerivedValue(() => clamp(dragX.value + gyroX.value));
  const tiltY = useDerivedValue(() => clamp(dragY.value + gyroY.value));

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

  return { tiltX, tiltY, flip, dragX, gesture: Gesture.Exclusive(pan, tap) };
}
