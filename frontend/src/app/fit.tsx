import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Alert, Text, View } from "react-native";
import { fitImageSource } from "@/api/catalog";
import { track } from "@/api/userData";
import { AiTryOn } from "@/components/AiTryOn";
import { GlassRow, GlassSection } from "@/components/GlassList";
import { GlassScreen } from "@/components/GlassScreen";
import { ProductImage } from "@/components/ItemCard";
import { Mannequin } from "@/components/Mannequin";
import { GlassButton, PrimaryButton } from "@/components/onboarding/Buttons";
import { findItem, shopUrl } from "@/data/catalog";
import { useLatestMeasurements } from "@/hooks/useRecommendations";
import { fitFromItems, fitPieces, MIN_PIECES, outfitName } from "@/lib/outfit";
import { openProduct } from "@/lib/shop";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";
import { BRAND, TYPE } from "@/theme/brand";

const VISUAL_HEIGHT = 460;

/**
 * The pieces picked in a saved list or closet outfit (`?ids=a,b`), worn
 * together in one AI try-on image on the user's body, with a Shop link for
 * each, and Save to closet so the fit needn't be picked again.
 */
export default function FitScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const t = useTheme();
  const pieces = useMemo(
    () =>
      fitPieces(
        fitFromItems((ids ?? "").split(",").filter(Boolean).map(findItem)),
      ),
    [ids],
  );
  // By the ids asked for, so an outfit with a piece that can't be found still counts as saved.
  const outfit = useSaved((s) =>
    s.outfits.find((o) => o.itemIds.join(",") === ids),
  );
  const shopFor = useProfile((s) => s.shopFor);
  const latest = useLatestMeasurements();
  const source = fitImageSource(pieces, shopFor, latest);
  // While the image is made (or if it fails), the drawn mannequin in the whole fit.
  const drawn = pieces[0] ? (
    <Mannequin
      measurements={latest}
      shopFor={shopFor}
      items={pieces}
      height={VISUAL_HEIGHT - 56}
    />
  ) : null;

  const name = (title: string, onName: (name: string) => void) =>
    Alert.prompt(
      title,
      undefined,
      (text) => {
        if (text?.trim()) onName(text.trim());
      },
      "plain-text",
      outfit?.name ?? outfitName(pieces),
    );
  const save = () =>
    name("Save to closet", (text) => {
      useSaved.getState().saveOutfit(
        text,
        pieces.map((i) => i.id),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  const footer =
    pieces.length < MIN_PIECES ? undefined : outfit ? (
      <GlassButton
        label="Rename fit"
        onPress={() =>
          name("Rename fit", (text) =>
            useSaved.getState().renameOutfit(outfit.id, text),
          )
        }
      />
    ) : (
      <PrimaryButton label="Save to closet" onPress={save} />
    );

  return (
    <GlassScreen
      badge="TRY ON"
      eyebrow={
        outfit
          ? `In your closet · ${pieces.length} pieces`
          : `${pieces.length} pieces · on your body`
      }
      title={
        outfit ? `*${outfit.name.replaceAll("*", "")}*` : "Worn\n*together.*"
      }
      footer={footer}
    >
      {drawn ? (
        <View
          style={{
            height: VISUAL_HEIGHT,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: BRAND.white,
            borderWidth: 1,
            borderColor: BRAND.glassEdge,
            alignItems: "center",
            paddingTop: 16,
            shadowColor: BRAND.shadow,
            shadowOpacity: 0.08,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          {source ? (
            <AiTryOn key={source.uri} source={source} fallback={drawn} />
          ) : (
            drawn
          )}
        </View>
      ) : (
        <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
          These pieces aren&apos;t saved anymore. Pick two or three from a saved
          list to try them on together.
        </Text>
      )}

      {pieces.length ? (
        <GlassSection
          title="In this fit"
          note={
            source
              ? undefined
              : "Demo pieces show on the drawn mannequin; the AI image is for store listings."
          }
        >
          {pieces.map((item) => (
            <GlassRow
              key={item.id}
              leading={
                <View
                  style={{
                    width: 40,
                    height: 50,
                    borderRadius: 10,
                    overflow: "hidden",
                    backgroundColor: item.colors[0],
                  }}
                >
                  <ProductImage item={item} />
                </View>
              }
              label={item.name}
              detail={`${item.brand} · ${item.priceLabel ?? `$${item.price}`}`}
              value="Shop"
              chevron
              onPress={() => {
                track("shop", item, t.season?.id);
                openProduct(shopUrl(item), t.colors.accentText);
              }}
            />
          ))}
        </GlassSection>
      ) : null}
    </GlassScreen>
  );
}
