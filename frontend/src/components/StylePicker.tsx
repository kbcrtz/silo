import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import type { FashionStyle } from "@/api/catalog";
import { OptionButton, TWO_UP } from "@/components/onboarding/Controls";
import { Glass } from "@/components/onboarding/Glass";
import {
  AESTHETIC_INFO,
  aestheticsFor,
  examplesFor,
  type Aesthetic,
} from "@/data/aesthetics";
import { COLOR_STYLES, MAX_LOOKS, toggleLook } from "@/lib/taste";
import type { ShopFor } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

function Label({ children }: { children: string }) {
  return <Text style={[TYPE.eyebrow, { marginBottom: 12 }]}>{children}</Text>;
}

/** One look as a glass card: its name and three example pieces. Selected turns ink. */
function LookCard({
  look,
  shopFor,
  selected,
  full,
  onPress,
}: {
  look: Aesthetic;
  shopFor: ShopFor;
  selected: boolean;
  /** Three are picked and this isn't one of them. */
  full: boolean;
  onPress: () => void;
}) {
  const { label } = AESTHETIC_INFO[look];
  const examples = examplesFor(look, shopFor);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: full }}
      accessibilityLabel={label}
      accessibilityHint={examples}
      onPress={() => {
        if (full) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
        Haptics.selectionAsync();
        onPress();
      }}
      style={{ width: "48.7%", opacity: full ? 0.55 : 1 }}
    >
      <Glass
        radius={20}
        variant="clear"
        fill={selected ? BRAND.ink : BRAND.glassTint}
        solid={selected}
        edge={selected ? BRAND.ink : BRAND.outline}
        style={{ minHeight: 82, padding: 14, gap: 6 }}
      >
        <Text
          style={[TYPE.question, selected && { color: BRAND.white }]}
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
        <Text
          style={[
            TYPE.bodySmall,
            { color: selected ? "rgba(255,255,255,0.75)" : BRAND.inkSoft },
          ]}
          maxFontSizeMultiplier={1.3}
        >
          {examples}
        </Text>
      </Glass>
    </Pressable>
  );
}

/**
 * Pick up to three looks and how you wear color. The same picker runs in
 * onboarding and in Profile › Your style; the parent owns the state.
 */
export function StylePicker({
  shopFor,
  liked,
  onLikedChange,
  colorStyle,
  onColorStyleChange,
}: {
  shopFor: ShopFor;
  liked: Aesthetic[];
  onLikedChange: (liked: Aesthetic[]) => void;
  colorStyle: FashionStyle;
  onColorStyleChange: (style: FashionStyle) => void;
}) {
  const full = liked.length >= MAX_LOOKS;
  return (
    <View style={{ gap: 26 }}>
      <View>
        <Label>{`PICK UP TO ${MAX_LOOKS} · ${liked.length} CHOSEN`}</Label>
        <View
          // Two 48.7% cells with a fixed 9 pt gap overflow a phone under 394 pt
          // wide and drop to one column; spacing them apart always fits.
          style={TWO_UP}
        >
          {aestheticsFor(shopFor).map((look) => {
            const selected = liked.includes(look);
            return (
              <LookCard
                key={look}
                look={look}
                shopFor={shopFor}
                selected={selected}
                full={full && !selected}
                onPress={() => onLikedChange(toggleLook(liked, look))}
              />
            );
          })}
        </View>
      </View>
      <View>
        <Label>HOW DO YOU WEAR COLOR?</Label>
        <View
          // Two 48.7% cells with a fixed 9 pt gap overflow a phone under 394 pt
          // wide and drop to one column; spacing them apart always fits.
          style={TWO_UP}
        >
          {COLOR_STYLES.map((c) => (
            <OptionButton
              key={c.id}
              label={c.label}
              selected={colorStyle === c.id}
              onPress={() => onColorStyleChange(c.id)}
              style={{ width: "48.7%" }}
            />
          ))}
        </View>
        <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft, marginTop: 12 }]}>
          Everything stays in your palette; this picks which of its colors lead.
        </Text>
      </View>
    </View>
  );
}
