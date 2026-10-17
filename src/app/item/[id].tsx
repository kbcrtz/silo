import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { startTryOn } from "@/api/tryOn";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ColorBlock } from "@/components/ItemCard";
import { Screen } from "@/components/Screen";
import { Swatches } from "@/components/Swatches";
import { Text } from "@/components/Text";
import { findItem } from "@/data/catalog";
import { SIZE_CHARTS } from "@/data/sizeCharts";
import { recommendSize } from "@/lib/fit";
import { latestMeasurements, MEASUREMENT_INFO } from "@/lib/measurements";
import { paletteMatch } from "@/lib/paletteMatch";
import { photoUri } from "@/lib/photos";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { useTryOn } from "@/store/tryOn";
import { useTheme } from "@/theme";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = findItem(id);
  const t = useTheme();
  const entries = useMeasurements((s) => s.entries);
  const latest = useMemo(() => latestMeasurements(entries), [entries]);
  const bodyPhoto = useProfile((s) => s.bodyPhoto);
  const fitPreference = useProfile((s) => s.fitPreference);
  const [starting, setStarting] = useState(false);

  if (!item) {
    return (
      <Screen>
        <Text variant="title">Item not found</Text>
      </Screen>
    );
  }

  const match = t.season ? paletteMatch(item.colors, t.season) : null;
  const chart = SIZE_CHARTS[item.sizeChartId];
  const size = chart ? recommendSize(latest, chart, fitPreference) : null;

  const tryOn = async () => {
    if (!bodyPhoto) {
      Alert.alert(
        "Add a body photo first",
        "Try-on uses a full-length photo of you. Add one on the Me tab.",
      );
      return;
    }
    setStarting(true);
    try {
      const jobId = await startTryOn(photoUri(bodyPhoto), item, latest);
      useTryOn.getState().add({
        id: jobId,
        itemId: item.id,
        bodyPhoto,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
      router.push({ pathname: "/result/[id]", params: { id: jobId } });
    } catch (e) {
      Alert.alert(
        "Couldn't start try-on",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen
      edges={[]}
      footer={<Button label="Try it on" onPress={tryOn} loading={starting} />}
    >
      <View
        style={{
          aspectRatio: 1 / item.aspect,
          borderRadius: t.radius.lg,
          overflow: "hidden",
          backgroundColor: item.colors[0],
        }}
      >
        {item.imageUrl ? (
          <Image
            source={item.imageUrl}
            style={{ flex: 1 }}
            contentFit="cover"
          />
        ) : (
          <ColorBlock item={item} />
        )}
      </View>

      <View style={{ gap: t.space(1) }}>
        <Text variant="title">{item.name}</Text>
        <Text tone="muted">
          {item.brand} · ${item.price}
        </Text>
      </View>

      {match && t.season ? (
        <Card>
          <Text variant="caption" tone="muted">
            COLOR MATCH
          </Text>
          <Text variant="heading">
            {match.label} for {t.season.name} · {match.score}%
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: t.space(3),
            }}
          >
            <Swatches colors={item.colors} size={28} />
            <Text tone="muted">vs your palette</Text>
            <Swatches colors={t.season.best.slice(0, 4)} size={20} />
          </View>
        </Card>
      ) : null}

      {size ? (
        <Card>
          <Text variant="caption" tone="muted">
            YOUR SIZE
          </Text>
          {size.kind === "size" ? (
            <>
              <Text variant="title">{size.size}</Text>
              <Text tone="muted">
                {size.confidence === "high"
                  ? "Should fit well"
                  : size.confidence === "medium"
                    ? "Close fit"
                    : "Between sizes"}
                {fitPreference !== "regular" ? ` · ${fitPreference} fit` : ""}
              </Text>
              {size.notes.map((note) => (
                <Text key={note}>• {note}</Text>
              ))}
            </>
          ) : (
            <>
              <Text>
                Add your{" "}
                {size.missing
                  .map((m) => MEASUREMENT_INFO[m].label.toLowerCase())
                  .join(", ")}{" "}
                to get a size.
              </Text>
              <Button
                variant="secondary"
                label="Add measurements"
                onPress={() => router.push("/measurements")}
              />
            </>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
