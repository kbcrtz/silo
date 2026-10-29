import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { analyzeSelfieOnce } from "@/api/colorAnalysis";
import { PrimaryButton } from "@/components/onboarding/Buttons";
import { Glass } from "@/components/onboarding/Glass";
import { Header, stepBadge } from "@/components/onboarding/Header";
import { Headline } from "@/components/onboarding/Headline";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { persistPhoto, photoUri } from "@/lib/photos";
import { pickSelfie } from "@/lib/pickPhoto";
import { useProfile } from "@/store/profile";
import { BRAND, TYPE } from "@/theme/brand";

const CARD_HEIGHT = 407;

/** Step two: the selfie the color analysis reads. */
export default function Selfie() {
  const selfie = useProfile((s) => s.selfiePhoto);
  const set = useProfile((s) => s.set);

  const choose = async () => {
    const uri = await pickSelfie();
    if (!uri) return;
    const name = persistPhoto(uri, "selfie");
    set({ selfiePhoto: name, photoTraits: undefined });
    // Errors surface when the user asks for results, not here.
    analyzeSelfieOnce(photoUri(name)).catch(() => {});
  };

  return (
    <OnboardingScreen>
      <Header badge={stepBadge(2)} />
      <View style={{ marginTop: 56 }}>
        <Headline
          eyebrow="Natural light works best"
          title={"Take a clear\n*selfie.*"}
        />
      </View>
      <Text style={[TYPE.body, { color: BRAND.inkSoft, marginTop: 14 }]}>
        Face a window, skip filters and remove tinted glasses. A small copy is
        saved to your profile for your passport.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          selfie ? "Change selfie" : "Take or choose a selfie"
        }
        onPress={choose}
        style={{ marginTop: 36 }}
      >
        <Glass
          radius={40}
          variant="clear"
          fill="rgba(255,255,255,0.4)"
          edge={BRAND.outlineSoft}
          style={{
            height: CARD_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selfie ? (
            <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
              <Image
                source={photoUri(selfie)}
                style={{ flex: 1 }}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
              <View
                style={{
                  position: "absolute",
                  bottom: 18,
                  alignSelf: "center",
                }}
              >
                <Glass
                  radius={18}
                  fill={BRAND.glassFillStrong}
                  style={{
                    paddingHorizontal: 16,
                    height: 36,
                    justifyContent: "center",
                  }}
                >
                  <Text style={[TYPE.control, { fontSize: 13 }]}>
                    Change photo
                  </Text>
                </Glass>
              </View>
            </Animated.View>
          ) : (
            <>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#000000",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SymbolView
                  name="camera"
                  size={24}
                  weight="regular"
                  tintColor={BRAND.white}
                  style={{ width: 28, height: 24 }}
                />
              </View>
              <Text
                style={[
                  TYPE.control,
                  {
                    fontFamily: TYPE.button.fontFamily,
                    fontSize: 14,
                    marginTop: 20,
                  },
                ]}
              >
                Take or choose a selfie
              </Text>
              <Text style={[TYPE.caption, { color: "#959395", marginTop: 10 }]}>
                JPG, PNG or HEIC
              </Text>
            </>
          )}
        </Glass>
      </Pressable>

      <PrimaryButton
        label="Analyze my colors"
        onPress={() => router.push("/onboarding/questions")}
        disabled={!selfie}
        style={{ marginTop: 21 }}
      />
    </OnboardingScreen>
  );
}
