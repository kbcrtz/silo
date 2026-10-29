import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { fitImageSource } from "@/api/catalog";
import { track } from "@/api/userData";
import { AiTryOn } from "@/components/AiTryOn";
import { GlassRow, GlassSection } from "@/components/GlassList";
import { GlassScreen } from "@/components/GlassScreen";
import { ProductImage } from "@/components/ItemCard";
import { Mannequin } from "@/components/Mannequin";
import { findItem, shopUrl } from "@/data/catalog";
import { useLatestMeasurements } from "@/hooks/useRecommendations";
import { fitFromItems, fitPieces } from "@/lib/outfit";
import { openProduct } from "@/lib/shop";
import { useProfile } from "@/store/profile";
import { useTheme } from "@/theme";
import { BRAND, TYPE } from "@/theme/brand";

const VISUAL_HEIGHT = 460;

/**
 * The pieces picked in a saved list (`?ids=a,b`), worn together in one AI
 * try-on image on the user's body, with a Shop link for each.
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

  return (
    <GlassScreen
      badge="TRY ON"
      eyebrow={`${pieces.length} pieces · on your body`}
      title={"Worn\n*together.*"}
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
