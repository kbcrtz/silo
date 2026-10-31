import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { buy, loadOffers, restore, type Offer } from "@/api/purchases";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Glass } from "@/components/onboarding/Glass";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { FAMILIES, familyOf, type Family } from "@/data/families";
import { LOOKS, type Look } from "@/data/looks";
import { paletteRuns, pickLooks, type PlanId } from "@/lib/paywall";
import { photoUri } from "@/lib/photos";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

const FEATURES = [
  "A live feed matched to your season",
  "Unlimited AI try-ons",
  "What's popular in your colors",
];

const CARD_W = 112;
const CARD_H = 158;
const CARD_RADIUS = 22;
/** Where each card lands as the fan opens, from far left to far right. */
const FAN = [
  { x: -106, y: 26, rotate: -15, scale: 0.8 },
  { x: -56, y: 10, rotate: -7, scale: 0.9 },
  { x: 0, y: 0, rotate: 0, scale: 1 },
  { x: 56, y: 10, rotate: 7, scale: 0.9 },
  { x: 106, y: 26, rotate: 15, scale: 0.8 },
];
const CENTER = 2;

/**
 * One card of the fan. It starts tucked behind the middle and springs out
 * to its place; the outer cards follow the inner ones.
 */
function FanCard({ index, children }: { index: number; children: ReactNode }) {
  const slot = FAN[index];
  const from = Math.abs(index - CENTER);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      120 + from * 110,
      withSpring(1, { damping: 15, stiffness: 110 }),
    );
  }, [p, from]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.25], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: slot.x * p.value },
      { translateY: slot.y * p.value + (1 - p.value) * 24 },
      { rotate: `${slot.rotate * p.value}deg` },
      { scale: interpolate(p.value, [0, 1], [0.86, slot.scale]) },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: "50%",
          marginLeft: -CARD_W / 2,
          width: CARD_W,
          height: CARD_H,
          zIndex: 10 - from,
          borderRadius: CARD_RADIUS,
          backgroundColor: BRAND.white,
          shadowColor: BRAND.shadow,
          shadowOpacity: 0.16,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: CARD_RADIUS,
          borderWidth: 3,
          borderColor: "rgba(255,255,255,0.92)",
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/** A run of the palette as fabric bands, top to bottom. */
function SwatchCard({ colors }: { colors: string[] }) {
  return (
    <>
      {colors.map((c, i) => (
        <View key={c + i} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </>
  );
}

/** An outfit photo, filling the card. */
function LookCard({ look }: { look: Look }) {
  return <Image source={look.image} style={{ flex: 1 }} contentFit="cover" />;
}

/**
 * The middle card, with the season on a glass label: a look when there are
 * looks, else the shopper's selfie, else the whole palette.
 */
function CenterCard({
  look,
  selfie,
  family,
}: {
  look?: Look;
  selfie?: string;
  family: Family;
}) {
  return (
    <View style={{ flex: 1 }}>
      {look ? (
        <LookCard look={look} />
      ) : selfie ? (
        <Image
          source={photoUri(selfie)}
          style={{ flex: 1 }}
          contentFit="cover"
        />
      ) : (
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
          {family.palette.map((c, i) => (
            <View
              key={c + i}
              style={{ width: "25%", height: "20%", backgroundColor: c }}
            />
          ))}
        </View>
      )}
      <Glass
        radius={12}
        fill={BRAND.glassFillStrong}
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 8,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={TYPE.badge} numberOfLines={1}>
          {`${family.temperature} ${family.season}`.toUpperCase()}
        </Text>
      </Glass>
    </View>
  );
}

/**
 * The opening fan: five looks in the shopper's colors, or until there are
 * looks for their season, their selfie flanked by their palette.
 */
function Fan({
  family,
  looks,
  selfie,
}: {
  family: Family;
  looks: Look[];
  selfie?: string;
}) {
  const sides = paletteRuns(family.palette, 4);
  return (
    <View
      style={{ height: CARD_H + 26 }}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {FAN.map((_, i) => (
        <FanCard key={i} index={i}>
          {i === CENTER ? (
            <CenterCard look={looks[i]} selfie={selfie} family={family} />
          ) : looks[i] ? (
            <LookCard look={looks[i]} />
          ) : (
            <SwatchCard colors={sides[i < CENTER ? i : i - 1] ?? []} />
          )}
        </FanCard>
      ))}
    </View>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: selected ? BRAND.white : BRAND.outline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {selected ? (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: BRAND.white,
          }}
        />
      ) : null}
    </View>
  );
}

/** A plan row. Selected turns ink, like the onboarding options. */
function PlanRow({
  title,
  detail,
  price,
  per,
  badge,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  price: string;
  per: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const ink = selected ? BRAND.white : BRAND.ink;
  const soft = selected ? "rgba(255,255,255,0.68)" : BRAND.inkSoft;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${price} ${per}. ${detail}`}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      // Room for the badge that sits on the top edge.
      style={{ paddingTop: badge ? 10 : 0 }}
    >
      <Glass
        radius={26}
        variant="clear"
        fill={selected ? BRAND.ink : BRAND.glassFill}
        solid={selected}
        edge={selected ? BRAND.ink : BRAND.outlineSoft}
        style={{
          height: 60,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Radio selected={selected} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[TYPE.button, { fontSize: 15, color: ink }]}>
            {title}
          </Text>
          <Text style={[TYPE.bodySmall, { color: soft }]}>{detail}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[TYPE.metal, { color: ink }]}>{price}</Text>
          <Text style={[TYPE.caption, { color: soft }]}>{per}</Text>
        </View>
      </Glass>
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 20,
            height: 21,
            paddingHorizontal: 9,
            borderRadius: 11,
            justifyContent: "center",
            backgroundColor: BRAND.white,
            borderWidth: 1,
            borderColor: BRAND.ink,
          }}
        >
          <Text style={TYPE.badge}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Apple's standard licence, which App Review accepts as the terms of a subscription. */
const TERMS_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const PER: Record<PlanId, string> = {
  annual: "year",
  monthly: "month",
  weekly: "week",
};

/**
 * Silo membership, the last step of onboarding: Silo is paid only, so a
 * plan is the only way in. The fan opens, then the title, the list and the
 * plans follow it in. Plans and purchases come from the App Store through
 * RevenueCat (src/api/purchases.ts); mock mode fakes the purchase.
 */
export function Paywall({ onSubscribed }: { onSubscribed: () => void }) {
  const seasonId = useProfile((s) => s.colorProfile?.seasonId);
  const selfie = useProfile((s) => s.selfiePhoto);
  const shopFor = useProfile((s) => s.shopFor);
  const family = FAMILIES[seasonId ? familyOf(seasonId) : "warm-spring"];
  const looks = pickLooks(LOOKS[family.id], shopFor, FAN.length);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [planId, setPlanId] = useState<PlanId>("annual");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadOffers().then(setOffers, () => setOffers([]));
  }, []);
  const offer = (id: PlanId) => offers?.find((o) => o.id === id);
  const plan = offer(planId) ?? offers?.[0];
  const annual = offer("annual");
  const monthly = offer("monthly");
  const save =
    annual && monthly && monthly.perYear
      ? Math.max(0, Math.floor((1 - annual.perYear / monthly.perYear) * 100))
      : 0;

  const subscribe = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      if (!(await buy(plan))) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSubscribed();
    } catch (e) {
      Alert.alert(
        "Couldn't complete the purchase",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const restorePurchases = async () => {
    setBusy(true);
    try {
      if (await restore()) return onSubscribed();
      Alert.alert(
        "Nothing to restore",
        "No Silo membership was found for this Apple ID.",
      );
    } catch {
      Alert.alert("Couldn't restore", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <Animated.View
      entering={FadeIn.delay(900).duration(400)}
      style={{ gap: 12 }}
    >
      <PrimaryButton
        label={offers && !offers.length ? "Plans unavailable" : "Continue"}
        onPress={subscribe}
        loading={busy || !offers}
        disabled={!plan}
      />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
        }}
      >
        <SymbolView
          name="checkmark.shield"
          size={12}
          tintColor={BRAND.inkSoft}
          style={{ width: 13, height: 13 }}
        />
        <Text style={[TYPE.caption, { color: BRAND.inkSoft }]}>
          {plan
            ? `${plan.price} a ${PER[plan.id]}. Renews automatically; cancel anytime in Settings.`
            : "Loading plans…"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
        {[
          { label: "Restore purchases", onPress: restorePurchases },
          {
            label: "Terms of Use",
            onPress: () => WebBrowser.openBrowserAsync(TERMS_URL),
          },
        ].map((link) => (
          <Pressable
            key={link.label}
            accessibilityRole="button"
            onPress={link.onPress}
            disabled={busy}
            hitSlop={12}
          >
            <Text
              style={[
                TYPE.caption,
                { color: BRAND.inkSoft, textDecorationLine: "underline" },
              ]}
            >
              {link.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  return (
    <OnboardingScreen
      backdrop={family.id}
      contentStyle={{ gap: 14 }}
      footer={footer}
    >
      <Header badge="MEMBERSHIP" />
      <Fan family={family} looks={looks} selfie={selfie} />

      <Animated.View entering={FadeInDown.delay(350).duration(450)}>
        <Headline
          size="medium"
          eyebrow="Silo membership"
          title={"Everything in\n*your colors.*"}
        />
      </Animated.View>

      <View style={{ gap: 8 }}>
        {FEATURES.map((f, i) => (
          <Animated.View
            key={f}
            entering={FadeInDown.delay(480 + i * 70).duration(400)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <SymbolView
              name="checkmark"
              size={13}
              weight="semibold"
              tintColor={BRAND.ink}
              style={{ width: 16, height: 16 }}
            />
            <Text style={TYPE.control}>{f}</Text>
          </Animated.View>
        ))}
      </View>

      <Animated.View
        entering={FadeInDown.delay(760).duration(450)}
        style={{ gap: 10 }}
        accessibilityRole="radiogroup"
      >
        {annual ? (
          <PlanRow
            title="Yearly"
            badge={save ? `SAVE ${save}%` : undefined}
            detail={`${annual.perMonth} a month`}
            price={annual.price}
            per="per year"
            selected={plan?.id === "annual"}
            onPress={() => setPlanId("annual")}
          />
        ) : null}
        {monthly ? (
          <PlanRow
            title="Monthly"
            detail="Billed every month"
            price={monthly.price}
            per="per month"
            selected={plan?.id === "monthly"}
            onPress={() => setPlanId("monthly")}
          />
        ) : null}
        {offer("weekly") ? (
          <PlanRow
            title="Weekly"
            detail="Billed every week"
            price={offer("weekly")!.price}
            per="per week"
            selected={plan?.id === "weekly"}
            onPress={() => setPlanId("weekly")}
          />
        ) : null}
      </Animated.View>
    </OnboardingScreen>
  );
}
