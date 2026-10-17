import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { USE_MOCKS } from "@/api/config";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { findItem } from "@/data/catalog";
import { photoUri } from "@/lib/photos";
import { isPending, useTryOn } from "@/store/tryOn";
import { useTheme } from "@/theme";

export default function TryOnResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useTryOn((s) => s.jobs.find((j) => j.id === id));
  const t = useTheme();
  const item = job ? findItem(job.itemId) : undefined;

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/try-on");

  return (
    <Screen
      scroll={false}
      edges={["top"]}
      footer={
        <View style={{ gap: t.space(2), paddingBottom: t.space(2) }}>
          {job?.status === "failed" && item ? (
            <Button
              label="Try again"
              onPress={() =>
                router.replace({
                  pathname: "/item/[id]",
                  params: { id: item.id },
                })
              }
            />
          ) : null}
          <Button variant="secondary" label="Done" onPress={close} />
        </View>
      }
    >
      <View style={{ gap: t.space(1) }}>
        <Text variant="title">{item?.name ?? "Try-on"}</Text>
        {item ? <Text tone="muted">{item.brand}</Text> : null}
      </View>

      <View
        style={{
          flex: 1,
          borderRadius: t.radius.lg,
          overflow: "hidden",
          backgroundColor: t.colors.surface,
          alignItems: "center",
          justifyContent: "center",
          gap: t.space(3),
        }}
      >
        {!job ? (
          <Text tone="muted">This look no longer exists.</Text>
        ) : isPending(job) ? (
          <>
            <ActivityIndicator size="large" color={t.colors.accentText} />
            <Text tone="muted">
              {job.status === "queued"
                ? "Waiting for a spot…"
                : "Dressing you up…"}
            </Text>
          </>
        ) : job.status === "failed" ? (
          <Text tone="danger">{job.error ?? "Generation failed."}</Text>
        ) : (
          <>
            <Image
              source={job.resultUrl ?? photoUri(job.bodyPhoto)}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={300}
            />
            {USE_MOCKS && !job.resultUrl ? (
              <View
                style={{
                  position: "absolute",
                  top: t.space(3),
                  right: t.space(3),
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderRadius: t.radius.pill,
                  paddingHorizontal: t.space(3),
                  paddingVertical: t.space(1),
                }}
              >
                <Text variant="caption" style={{ color: "#fff" }}>
                  Mock result
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
