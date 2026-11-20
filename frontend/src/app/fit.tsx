import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { File } from "expo-file-system";
import { useEffect, useMemo, useState } from "react";
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
import {
  coverKey,
  fitFromItems,
  fitPieces,
  MIN_PIECES,
  outfitName,
} from "@/lib/outfit";
import { deletePhoto, newPhotoName, photoExists, photoUri } from "@/lib/photos";
import { openProduct } from "@/lib/shop";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";
import { BRAND, TYPE } from "@/theme/brand";
import { recordSignal } from "@/store/taste";

const VISUAL_HEIGHT = 460;

type ImageAddress = { uri: string; headers: Record<string, string> };

/**
 * Keeps a saved fit's AI image as its closet cover, downloaded into the
 * photos directory, unless the cover already shows this image and its file
 * is here. The server saved the image when it made it, so this second fetch
 * is served from storage and never generates (or bills) a new one.
 */
async function keepCover(outfitId: string, source: ImageAddress) {
  const key = coverKey(source.uri);
  const outfit = useSaved.getState().outfits.find((o) => o.id === outfitId);
  if (!outfit) return;
  // A cover restored from a backup names a file that isn't on this phone.
  if (outfit.cover?.key === key && photoExists(outfit.cover.file)) return;
  const file = newPhotoName("fit");
  try {
    await File.downloadFileAsync(source.uri, new File(photoUri(file)), {
      headers: source.headers,
    });
    useSaved.getState().setOutfitCover(outfitId, { file, key });
  } catch {
    // No cover this time; the mosaic stays and the next view tries again.
    deletePhoto(file);
  }
}

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
  // The address of the AI image once it's on screen, for the closet cover.
  const [shown, setShown] = useState<ImageAddress>();
  useEffect(() => {
    if (outfit && shown) keepCover(outfit.id, shown);
  }, [outfit?.id, shown?.uri]); // eslint-disable-line react-hooks/exhaustive-deps
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
            <AiTryOn
              key={source.uri}
              source={source}
              fallback={drawn}
              onReady={() => setShown(source)}
            />
          ) : (
            drawn
          )}
        </View>
      ) : (
        <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
          These pieces aren&apos;t saved anymore.
        </Text>
      )}

      {pieces.length ? (
        <GlassSection title="In this fit">
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
                recordSignal(item, "shop");
                openProduct(shopUrl(item), t.colors.accentText);
              }}
            />
          ))}
        </GlassSection>
      ) : null}
    </GlassScreen>
  );
}
