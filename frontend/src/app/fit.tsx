import { Pressable, View } from "react-native";
import { AiTryOn } from "@/components/AiTryOn";
import { Mannequin } from "@/components/Mannequin";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { shopUrl } from "@/data/catalog";
import { fitImageSource } from "@/api/catalog";
import { track } from "@/api/userData";
import { useLatestMeasurements } from "@/hooks/useRecommendations";
import { fitPieces } from "@/lib/outfit";
import { openProduct } from "@/lib/shop";
import { useFit } from "@/store/fit";
import { useProfile } from "@/store/profile";
import { useTheme } from "@/theme";
import { BRAND } from "@/theme/brand";

const VISUAL_HEIGHT = 420;

/** The pieces the user picked, worn together in one AI try-on image. */
export default function FitScreen() {
  const t = useTheme();
  const pieces = fitPieces(useFit((s) => s.pieces));
  const shopFor = useProfile((s) => s.shopFor);
  const latest = useLatestMeasurements();
  const source = fitImageSource(pieces, shopFor, latest);
  // While the image is made (or if it fails), the drawn mannequin in the main piece.
  const drawn = pieces[0] ? (
    <Mannequin
      measurements={latest}
      shopFor={shopFor}
      item={pieces[0]}
      height={VISUAL_HEIGHT - t.space(14)}
    />
  ) : null;

  return (
    <Screen edges={[]}>
      <View style={{ gap: t.space(1) }}>
        <Text variant="title">Your fit</Text>
        <Text tone="muted">
          {pieces.length >= 2
            ? "Every piece together on your body."
            : "Add a top and bottoms, or a dress, from any item's Add to fit. A jacket goes over either."}
        </Text>
      </View>

      {drawn ? (
        <View
          style={{
            height: VISUAL_HEIGHT,
            borderRadius: t.radius.lg,
            overflow: "hidden",
            backgroundColor: BRAND.white,
            alignItems: "center",
            paddingTop: t.space(4),
          }}
        >
          {source ? (
            <AiTryOn key={source.uri} source={source} fallback={drawn} />
          ) : (
            drawn
          )}
        </View>
      ) : null}

      {pieces.length ? (
        <MasonryGrid
          entries={pieces.map((item) => ({ item }))}
          footer={(item) => (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: t.space(1),
              }}
            >
              <Pressable
                hitSlop={6}
                onPress={() => useFit.getState().remove(item.category)}
              >
                <Text variant="caption" tone="muted">
                  Remove
                </Text>
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() => {
                  track("shop", item, t.season?.id);
                  openProduct(shopUrl(item), t.colors.accentText);
                }}
              >
                <Text variant="caption" tone="accent">
                  Shop ›
                </Text>
              </Pressable>
            </View>
          )}
        />
      ) : null}
    </Screen>
  );
}
