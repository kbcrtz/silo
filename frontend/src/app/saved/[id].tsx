import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { track } from "@/api/userData";
import { GlassRow, GlassSection } from "@/components/GlassList";
import { GlassScreen } from "@/components/GlassScreen";
import { MasonryGrid } from "@/components/MasonryGrid";
import { GlassButton, PrimaryButton } from "@/components/onboarding/Buttons";
import { findItem, shopUrl } from "@/data/catalog";
import {
  canMakeFit,
  canTryOn,
  fitIds,
  MIN_PIECES,
  toggleInFit,
  type Fit,
} from "@/lib/outfit";
import { openProduct } from "@/lib/shop";
import { useSaved } from "@/store/saved";
import { useTheme } from "@/theme";
import { BRAND, TYPE } from "@/theme/brand";

/** Stars would turn part of a list's name italic in the headline. */
const plain = (name: string) => name.replaceAll("*", "");

/**
 * One saved list, or every saved item when the id is "all". Try on together
 * turns the grid into a picker: one piece of each kind, and the button opens
 * them as one AI image on the user's body.
 */
export default function SavedList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const list = useSaved((s) => s.lists.find((l) => l.id === id));
  const allIds = useSaved((s) => s.itemIds);
  const isAll = id === "all";
  const itemIds = isAll ? allIds : (list?.itemIds ?? []);
  const items = itemIds.map(findItem).filter((i) => i !== undefined);
  const [picking, setPicking] = useState(false);
  const [fit, setFit] = useState<Fit>({});
  const picked = Object.keys(fit).length;

  const deleteList = () =>
    Alert.alert(`Delete "${list?.name}"?`, "The items stay in All saved.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          useSaved.getState().deleteList(id);
          router.back();
        },
      },
    ]);

  const stopPicking = () => {
    setPicking(false);
    setFit({});
  };

  if (!isAll && !list) {
    return (
      <GlassScreen badge="LIST" eyebrow="Saved" title={"List not\n*found.*"}>
        <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
          It may have been deleted on another device.
        </Text>
      </GlassScreen>
    );
  }

  const footer = picking ? (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <GlassButton label="Cancel" onPress={stopPicking} />
      <PrimaryButton
        label={
          canTryOn(fit)
            ? `Try on ${picked} pieces`
            : picked
              ? "Pick one more piece"
              : `Pick ${MIN_PIECES} or 3 pieces`
        }
        disabled={!canTryOn(fit)}
        onPress={() =>
          router.push({
            pathname: "/fit",
            params: { ids: fitIds(fit).join(",") },
          })
        }
        style={{ flex: 1 }}
      />
    </View>
  ) : (
    <View style={{ gap: 10 }}>
      <PrimaryButton
        label="Try on together"
        disabled={!canMakeFit(items)}
        onPress={() => {
          Haptics.selectionAsync();
          setPicking(true);
        }}
      />
      {canMakeFit(items) ? null : (
        <Text
          style={[TYPE.caption, { color: BRAND.inkSoft, textAlign: "center" }]}
        >
          {items.length < MIN_PIECES
            ? "Save at least two pieces to try them on together."
            : "Add a top and bottoms, or a jacket, to try a fit on."}
        </Text>
      )}
    </View>
  );

  return (
    <GlassScreen
      badge={isAll ? "SAVED" : "LIST"}
      eyebrow={`${items.length} ${items.length === 1 ? "piece" : "pieces"}`}
      title={isAll ? "All\n*saved.*" : `*${plain(list!.name)}*`}
      footer={footer}
    >
      {picking ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
            Pick a top and bottoms, or a dress. Add a jacket to layer it over
            either. Picking another of the same kind swaps it in.
          </Text>
        </Animated.View>
      ) : null}

      {items.length ? (
        <MasonryGrid
          entries={items.map((item) => ({ item }))}
          pick={
            picking
              ? (item) => ({
                  picked: fit[item.category]?.id === item.id,
                  onPress: () => {
                    Haptics.selectionAsync();
                    setFit((f) => toggleInFit(f, item));
                  },
                })
              : undefined
          }
          footer={(item) =>
            picking ? null : (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Shop ${item.name}`}
                hitSlop={14}
                onPress={() => {
                  track("shop", item, t.season?.id);
                  openProduct(shopUrl(item), t.colors.accentText);
                }}
                style={{ marginTop: t.space(1) }}
              >
                <Text style={[TYPE.caption, { color: BRAND.ink }]}>Shop ›</Text>
              </Pressable>
            )
          }
        />
      ) : (
        <Text style={[TYPE.body, { color: BRAND.inkSoft }]}>
          {isAll
            ? "Nothing saved yet. Tap Save on anything in your feed."
            : "Empty for now. Open an item, tap Save, then pick this list."}
        </Text>
      )}

      {!isAll && !picking ? (
        <GlassSection>
          <GlassRow
            icon="trash"
            label="Delete list"
            destructive
            onPress={deleteList}
          />
        </GlassSection>
      ) : null}
    </GlassScreen>
  );
}
