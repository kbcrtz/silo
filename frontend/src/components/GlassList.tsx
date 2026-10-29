import * as Haptics from "expo-haptics";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Children, Fragment, useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { BRAND, TYPE } from "@/theme/brand";
import { Glass } from "./onboarding/Glass";

const RADIUS = 22;
/** Where row content and the dividers between rows start. */
const INSET = 18;
const ROW_HEIGHT = 54;

/**
 * A titled group on one glass panel, the way Settings groups rows, with a
 * hairline between each. A `note` explains the group underneath.
 */
export function GlassSection({
  title,
  note,
  children,
}: {
  title?: string;
  note?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: 10 }}>
      {title ? (
        <Text
          style={[TYPE.eyebrow, { color: BRAND.inkSoft, marginLeft: INSET }]}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <Glass radius={RADIUS}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  marginLeft: INSET,
                  backgroundColor: BRAND.hairline,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </Glass>
      {note ? (
        <Text
          style={[
            TYPE.bodySmall,
            { color: BRAND.inkSoft, marginHorizontal: INSET },
          ]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One row: an icon or picture, a label with an optional detail line, and a
 * value, control or chevron on the right. Tappable when it has `onPress`.
 */
export function GlassRow({
  icon,
  leading,
  label,
  detail,
  value,
  trailing,
  onPress,
  destructive,
  chevron,
}: {
  icon?: SFSymbol;
  /** In place of the icon, e.g. a photo. */
  leading?: ReactNode;
  label: string;
  detail?: string;
  value?: string;
  /** In place of the value and chevron, e.g. a text field. */
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** For rows that open another screen. */
  chevron?: boolean;
}) {
  const t = useTheme();
  const color = destructive ? t.colors.danger : BRAND.ink;
  const content = (
    <>
      {leading ??
        (icon ? (
          <SymbolView
            name={icon}
            size={19}
            weight="light"
            tintColor={color}
            style={{ width: 24, height: 24 }}
          />
        ) : null)}
      <View style={{ flex: trailing ? 0 : 1, gap: 1 }}>
        <Text style={[TYPE.control, { color }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text
            style={[TYPE.bodySmall, { color: BRAND.inkSoft }]}
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <>
          {value ? (
            <Text style={[TYPE.control, { color: BRAND.inkSoft }]}>
              {value}
            </Text>
          ) : null}
          {chevron ? (
            <SymbolView
              name="chevron.right"
              size={13}
              weight="semibold"
              tintColor={BRAND.inkMuted}
              style={{ width: 14, height: 14 }}
            />
          ) : null}
        </>
      )}
    </>
  );
  const row = {
    minHeight: ROW_HEIGHT,
    paddingHorizontal: INSET,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  } as const;
  if (!onPress) return <View style={row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        row,
        pressed && { backgroundColor: "rgba(23,19,17,0.05)" },
      ]}
    >
      {content}
    </Pressable>
  );
}

/** A glass segmented control; the ink thumb slides to the choice. */
export function GlassSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const pad = 4;
  const segment = width ? (width - pad * 2) / options.length : 0;
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  // Placed on the first layout, then slides; -1 until measured.
  const x = useSharedValue(-1);
  useEffect(() => {
    if (!segment) return;
    const to = index * segment;
    x.value =
      x.value < 0 ? to : withSpring(to, { damping: 22, stiffness: 260 });
  }, [index, segment, x]);
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.max(x.value, 0) }],
  }));
  return (
    <Glass
      radius={22}
      fill="rgba(255,255,255,0.38)"
      style={{ height: 44, padding: pad, flexDirection: "row" }}
    >
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        pointerEvents="none"
      />
      {segment ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: pad,
              left: pad,
              width: segment,
              height: 44 - pad * 2,
              borderRadius: 18,
              backgroundColor: BRAND.ink,
            },
            thumb,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              onChange(o.id);
            }}
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              style={[
                TYPE.control,
                { fontSize: 14, color: selected ? BRAND.white : BRAND.ink },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Glass>
  );
}
