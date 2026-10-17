import { Image } from "expo-image";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Card } from "@/components/Card";
import { ColorBlock } from "@/components/ItemCard";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { findItem } from "@/data/catalog";
import { photoUri } from "@/lib/photos";
import { isPending, useTryOn } from "@/store/tryOn";
import { useTheme } from "@/theme";

export default function TryOnGallery() {
  const t = useTheme();
  const jobs = useTryOn((s) => s.jobs);

  return (
    <Screen>
      <View style={{ gap: t.space(1) }}>
        <Text variant="title">Try On</Text>
        <Text tone="muted">Your generated looks</Text>
      </View>

      {jobs.length === 0 ? (
        <Card>
          <Text variant="heading">No looks yet</Text>
          <Text tone="muted">
            Open any item in Discover and tap "Try it on" to see yourself
            wearing it.
          </Text>
        </Card>
      ) : (
        <View
          style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space(3) }}
        >
          {jobs.map((job) => {
            const item = findItem(job.itemId);
            return (
              <Link
                key={job.id}
                href={{ pathname: "/result/[id]", params: { id: job.id } }}
                asChild
              >
                <Pressable style={{ width: "48%", gap: t.space(1) }}>
                  <View
                    style={{
                      aspectRatio: 3 / 4,
                      borderRadius: t.radius.md,
                      overflow: "hidden",
                      backgroundColor: t.colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {job.status === "succeeded" ? (
                      <Image
                        source={job.resultUrl ?? photoUri(job.bodyPhoto)}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : isPending(job) ? (
                      <ActivityIndicator color={t.colors.accentText} />
                    ) : item ? (
                      <ColorBlock item={item} />
                    ) : null}
                  </View>
                  <Text variant="caption" numberOfLines={1}>
                    {item?.name ?? "Item"}
                  </Text>
                  <Text
                    variant="caption"
                    tone={job.status === "failed" ? "danger" : "muted"}
                  >
                    {statusLabel[job.status]}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const statusLabel = {
  queued: "Queued",
  running: "Generating…",
  succeeded: "Ready",
  failed: "Failed",
} as const;
