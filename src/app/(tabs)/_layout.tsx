import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme";

export default function TabsLayout() {
  const t = useTheme();
  return (
    <NativeTabs tintColor={t.colors.accentText}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="try-on">
        <NativeTabs.Trigger.Label>Try On</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.rectangle.stack" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
