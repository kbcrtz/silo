import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { createContext, useContext, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GlassScreen } from "@/components/GlassScreen";
import { ProductImage } from "@/components/ItemCard";
import { GlassButton } from "@/components/onboarding/Buttons";
import { GUTTER } from "@/components/onboarding/OnboardingScreen";
import { findItem } from "@/data/catalog";
import { photoUri } from "@/lib/photos";
import { useSaved, type Outfit } from "@/store/saved";
import { BRAND, TYPE } from "@/theme/brand";

const RADIUS = 22;

/** A list's cover: its four newest items in a 2x2 grid, on glass. */
function Mosaic({ itemIds }: { itemIds: string[] }) {
  const items = itemIds
    .map(findItem)
    .filter((i) => i !== undefined)
    .slice(0, 4);
  const cell = (i: number) => (
    <View key={i} style={{ flex: 1, backgroundColor: BRAND.glassFill }}>
      {items[i] ? <ProductImage item={items[i]} /> : null}
    </View>
  );
  return (
    <View
      style={{
        aspectRatio: 1,
        borderRadius: RADIUS,
        overflow: "hidden",
        gap: 2,
        backgroundColor: BRAND.glassEdge,
        borderWidth: 1,
        borderColor: BRAND.glassEdge,
      }}
    >
      {[0, 2].map((row) => (
        <View key={row} style={{ flex: 1, flexDirection: "row", gap: 2 }}>
          {cell(row)}
          {cell(row + 1)}
        </View>
      ))}
    </View>
  );
}

function ListTile({
  id,
  name,
  itemIds,
}: {
  id: string;
  name: string;
  itemIds: string[];
}) {
  const width = useContext(TileWidth);
  return (
    <Link href={{ pathname: "/saved/[id]", params: { id } }} asChild>
      <Pressable style={{ width, gap: 10 }}>
        <Mosaic itemIds={itemIds} />
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text style={[TYPE.control, { fontSize: 16 }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[TYPE.caption, { color: BRAND.inkSoft }]}>
            {itemIds.length} {itemIds.length === 1 ? "piece" : "pieces"}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

/**
 * The fit's AI try-on image once it has been seen on the Fit screen; until
 * then, or when the file isn't on this phone (a backup restored elsewhere),
 * its pieces in a mosaic.
 */
function OutfitCover({ outfit }: { outfit: Outfit }) {
  const [missing, setMissing] = useState<string>();
  const file = outfit.cover?.file;
  if (!file || missing === file) return <Mosaic itemIds={outfit.itemIds} />;
  return (
    <View
      style={{
        aspectRatio: 1,
        borderRadius: RADIUS,
        overflow: "hidden",
        backgroundColor: BRAND.white,
        borderWidth: 1,
        borderColor: BRAND.glassEdge,
      }}
    >
      <Image
        source={photoUri(file)}
        style={{ flex: 1 }}
        // The mannequin stands head to feet in a 3:4 image; keep all of it.
        contentFit="contain"
        accessibilityLabel={`${outfit.name}, AI try-on`}
        onError={() => setMissing(file)}
      />
    </View>
  );
}

/** A closet outfit: its pieces on a cover; opens the fit, hold to rename or delete. */
function OutfitTile({ outfit }: { outfit: Outfit }) {
  const width = useContext(TileWidth);
  const manage = () =>
    Alert.alert(outfit.name, undefined, [
      {
        text: "Rename",
        onPress: () =>
          Alert.prompt(
            "Rename fit",
            undefined,
            (name) => {
              if (name?.trim())
                useSaved.getState().renameOutfit(outfit.id, name.trim());
            },
            "plain-text",
            outfit.name,
          ),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => useSaved.getState().deleteOutfit(outfit.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  return (
    <Link
      href={{ pathname: "/fit", params: { ids: outfit.itemIds.join(",") } }}
      asChild
    >
      <Pressable
        onLongPress={manage}
        accessibilityHint="Hold to rename or delete"
        style={{ width, gap: 10 }}
      >
        <OutfitCover outfit={outfit} />
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text style={[TYPE.control, { fontSize: 16 }]} numberOfLines={1}>
            {outfit.name}
          </Text>
          <Text style={[TYPE.caption, { color: BRAND.inkSoft }]}>
            {outfit.itemIds.length} pieces
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const Heading = ({ label }: { label: string }) => (
  <Text style={[TYPE.eyebrow, { color: BRAND.inkSoft, marginBottom: -8 }]}>
    {label}
  </Text>
);

const GAP = 14;
/** A shelf tile's width, set by the screen so about two and a bit show. */
const TileWidth = createContext(160);

/**
 * A row of tiles that scrolls sideways, running to the screen's edges and
 * stopping on a tile. The next tile peeks in so the row reads as scrollable.
 */
function Shelf({ width, children }: { width: number; children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={width + GAP}
      snapToAlignment="start"
      style={{ marginHorizontal: -GUTTER }}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: GAP }}
    >
      <TileWidth.Provider value={width}>{children}</TileWidth.Provider>
    </ScrollView>
  );
}

export default function Saved() {
  const itemIds = useSaved((s) => s.itemIds);
  const lists = useSaved((s) => s.lists);
  const outfits = useSaved((s) => s.outfits);
  const screen = useWindowDimensions().width;
  // Two tiles and a sliver of the third across the content width.
  const tile = Math.round((screen - GUTTER * 2 - GAP) / 2.25);

  const newList = () =>
    Alert.prompt("New list", undefined, (name) => {
      if (name?.trim()) useSaved.getState().createList(name.trim());
    });

  return (
    <GlassScreen
      badge="SAVED"
      eyebrow={`${itemIds.length} ${itemIds.length === 1 ? "piece" : "pieces"} saved`}
      title={"Your\n*closet.*"}
      footer={<GlassButton label="New list" onPress={newList} />}
    >
      {itemIds.length ? null : (
        <Text style={[TYPE.body, { color: BRAND.inkSoft, marginTop: -12 }]}>
          Nothing saved yet.
        </Text>
      )}

      {outfits.length ? (
        <>
          <Heading label="OUTFITS" />
          <Shelf width={tile}>
            {outfits.map((outfit) => (
              <OutfitTile key={outfit.id} outfit={outfit} />
            ))}
          </Shelf>
          <Heading label="LISTS" />
        </>
      ) : null}

      <Shelf width={tile}>
        <ListTile id="all" name="All saved" itemIds={itemIds} />
        {lists.map((list) => (
          <ListTile
            key={list.id}
            id={list.id}
            name={list.name}
            itemIds={list.itemIds}
          />
        ))}
      </Shelf>
    </GlassScreen>
  );
}
