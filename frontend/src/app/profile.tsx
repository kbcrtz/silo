import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { removeAccount, signOut } from "@/api/auth";
import { GlassRow, GlassSection, GlassSegmented } from "@/components/GlassList";
import { Backdrop, useSeasonBackdrop } from "@/components/onboarding/Backdrop";
import { Header } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { GUTTER } from "@/components/onboarding/OnboardingScreen";
import { PassportCard } from "@/components/passport/PassportCard";
import { usePassportData } from "@/components/passport/usePassportData";
import { GoogleLogo, SignInButtons } from "@/components/SignInButtons";
import { bodyShape } from "@/lib/bodyShape";
import type { FitPreference } from "@/lib/fit";
import {
  latestMeasurements,
  MEASUREMENT_INFO,
  MEASUREMENT_TYPES,
} from "@/lib/measurements";
import { deletePhoto, persistPhoto, photoUri } from "@/lib/photos";
import { pickSelfie } from "@/lib/pickPhoto";
import { formatMeasurement } from "@/lib/units";
import { useAccount } from "@/store/account";
import { clearLocalData } from "@/store/backup";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

const FIT_OPTIONS: { id: FitPreference; label: string }[] = [
  { id: "slim", label: "Slim" },
  { id: "regular", label: "Regular" },
  { id: "relaxed", label: "Relaxed" },
];

const PROVIDER_NAMES = { apple: "Apple", google: "Google" };
/** The widest the passport gets, so it doesn't swamp a large phone. */
const CARD_MAX = 340;
/** Inside a section, where content lines up with its rows. */
const PAD = 18;

/** The section's photo: the selfie in a small circle, or a placeholder. */
function PhotoThumb({ selfie }: { selfie?: string }) {
  return selfie ? (
    <Image
      source={photoUri(selfie)}
      contentFit="cover"
      style={{ width: 32, height: 32, borderRadius: 16 }}
    />
  ) : (
    <SymbolView
      name="person.crop.circle"
      size={24}
      weight="light"
      tintColor={BRAND.ink}
      style={{ width: 32, height: 32 }}
    />
  );
}

/** Body shape over the latest of each measurement, three to a row. */
function BodySummary() {
  const entries = useMeasurements((s) => s.entries);
  const unitSystem = useProfile((s) => s.unitSystem);
  const latest = useMemo(() => latestMeasurements(entries), [entries]);
  const shape = bodyShape(latest);
  const types = MEASUREMENT_TYPES.filter((type) => latest[type] !== undefined);

  return (
    <View style={{ padding: PAD, gap: 14 }}>
      {shape ? (
        <View style={{ gap: 2 }}>
          <Text style={[TYPE.eyebrow, { color: BRAND.inkSoft }]}>
            BODY SHAPE
          </Text>
          <Text style={TYPE.metal}>{shape.name}</Text>
        </View>
      ) : (
        <Text style={[TYPE.eyebrow, { color: BRAND.inkSoft }]}>
          {types.length ? "LATEST MEASUREMENTS" : "BODY SHAPE"}
        </Text>
      )}
      {types.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
          {types.map((type) => (
            <View key={type} style={{ width: "33.33%", gap: 2 }}>
              <Text style={[TYPE.caption, { color: BRAND.inkSoft }]}>
                {MEASUREMENT_INFO[type].label}
              </Text>
              <Text
                style={[TYPE.control, { fontFamily: TYPE.button.fontFamily }]}
              >
                {formatMeasurement(type, latest[type]!, unitSystem)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft }]}>
          Add your measurements for sizes picked to fit you.
        </Text>
      )}
      {!shape && types.length ? (
        <Text style={[TYPE.bodySmall, { color: BRAND.inkSoft }]}>
          Add chest, waist and hips to see your body shape.
        </Text>
      ) : null}
    </View>
  );
}

/** Signed in: who as, sign out and delete. Otherwise the sign-in buttons. */
function AccountSection() {
  const account = useAccount((s) => s.account);

  const confirmSignOut = () =>
    Alert.alert(
      "Sign out?",
      "Your Silo stays on your account. This iPhone starts over.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", onPress: () => signOut() },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "Your profile, measurements and saved pieces are deleted from Silo for good.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            removeAccount().catch((e) =>
              Alert.alert(
                "Couldn't delete your account",
                e instanceof Error ? e.message : "Please try again.",
              ),
            ),
        },
      ],
    );

  if (account.kind !== "member")
    return (
      <GlassSection title="Account">
        <View style={{ padding: PAD, gap: 16 }}>
          <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
            Sign in to back up your colors, measurements and saved pieces, and
            get them back on any iPhone.
          </Text>
          <SignInButtons onSignedIn={() => {}} />
        </View>
      </GlassSection>
    );

  const provider = account.provider;
  return (
    <GlassSection title="Account">
      <GlassRow
        leading={
          <View style={{ width: 24, alignItems: "center" }}>
            {provider === "google" ? (
              <GoogleLogo size={18} />
            ) : (
              <SymbolView
                name={
                  provider === "apple" ? "apple.logo" : "person.crop.circle"
                }
                size={19}
                weight="regular"
                tintColor={BRAND.ink}
                style={{ width: 24, height: 24 }}
              />
            )}
          </View>
        }
        label={
          provider ? `Signed in with ${PROVIDER_NAMES[provider]}` : "Signed in"
        }
        detail={account.email ?? "Backed up to your account"}
      />
      <GlassRow
        icon="rectangle.portrait.and.arrow.right"
        label="Sign out"
        onPress={confirmSignOut}
      />
      <GlassRow
        icon="trash"
        label="Delete account"
        destructive
        onPress={confirmDelete}
      />
    </GlassSection>
  );
}

/**
 * The profile, over the season gradient like the rest of the app: the
 * passport up top, then grouped glass sections for what it prints, the
 * body behind the sizes, the account and the app.
 */
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const backdrop = useSeasonBackdrop();
  const profile = useProfile();
  const passport = usePassportData();
  const member = useAccount((s) => s.account.kind === "member");
  const cardWidth = Math.min(width - GUTTER * 2, CARD_MAX);

  const redoOnboarding = () =>
    Alert.alert("Redo onboarding?", "Your measurement history is kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Redo", onPress: () => profile.set({ onboarded: false }) },
    ]);

  // Only the passport picture changes; the color analysis stays as it is.
  const changePhoto = async () => {
    const uri = await pickSelfie();
    if (!uri) return;
    const old = profile.selfiePhoto;
    profile.set({ selfiePhoto: persistPhoto(uri, "selfie") });
    if (old) deletePhoto(old);
  };

  const resetApp = () =>
    Alert.alert(
      "Reset Silo?",
      "Clears your profile, measurements and saved items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: clearLocalData,
        },
      ],
    );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop id={backdrop} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: GUTTER,
          paddingBottom: insets.bottom + 32,
          gap: 28,
        }}
      >
        <View style={{ gap: 20 }}>
          <Header badge="SILO ID" />
          <Headline
            size="medium"
            eyebrow={
              passport
                ? `${passport.season.name} · Issued ${passport.issued}`
                : "Your profile"
            }
            title={"Your\n*Silo.*"}
          />
        </View>

        {passport ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <PassportCard data={passport} width={cardWidth} />
            <Text style={[TYPE.caption, { color: BRAND.inkSoft }]}>
              Tilt to shimmer · Drag to turn · Tap to flip
            </Text>
          </View>
        ) : (
          <GlassSection>
            <GlassRow
              icon="person.text.rectangle"
              label="Get your passport"
              detail="Finish color analysis to have one issued."
              onPress={redoOnboarding}
            />
          </GlassSection>
        )}

        <GlassSection title="On your passport">
          <GlassRow
            icon="signature"
            label="Name"
            trailing={
              <TextInput
                value={profile.displayName ?? ""}
                onChangeText={(displayName) => profile.set({ displayName })}
                placeholder="Add your name"
                placeholderTextColor={BRAND.placeholder}
                selectionColor={BRAND.ink}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={24}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="Name on your passport"
                style={[
                  TYPE.control,
                  { flex: 1, textAlign: "right", paddingVertical: 8 },
                ]}
              />
            }
          />
          <GlassRow
            leading={<PhotoThumb selfie={profile.selfiePhoto} />}
            label="Photo"
            value={profile.selfiePhoto ? "Change" : "Add"}
            onPress={changePhoto}
          />
        </GlassSection>

        <GlassSection
          title="Your fit"
          note="Sizes are recommended from your latest measurements and the fit you like."
        >
          <BodySummary />
          <GlassRow
            icon="ruler"
            label="Measurements"
            value="Edit & history"
            chevron
            onPress={() => router.push("/measurements")}
          />
          <View style={{ padding: PAD, gap: 12 }}>
            <Text style={TYPE.control}>Fit preference</Text>
            <GlassSegmented
              options={FIT_OPTIONS}
              value={profile.fitPreference}
              onChange={(fitPreference) => profile.set({ fitPreference })}
            />
          </View>
        </GlassSection>

        <AccountSection />

        <GlassSection title="Silo">
          <GlassRow
            icon="arrow.counterclockwise"
            label="Redo onboarding"
            onPress={redoOnboarding}
          />
          {/* Signed in, a reset would back the empty phone up over the account. */}
          {member ? null : (
            <GlassRow
              icon="xmark.circle"
              label="Reset app"
              destructive
              onPress={resetApp}
            />
          )}
        </GlassSection>

        <Text
          style={[
            TYPE.wordmark,
            { alignSelf: "center", color: BRAND.inkFaint, marginTop: -4 },
          ]}
        >
          Silo
        </Text>
      </ScrollView>
    </View>
  );
}
