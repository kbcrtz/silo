import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { createJSONStorage } from "zustand/middleware";

export const storage = createJSONStorage(() => AsyncStorage);

type Persisted = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

/** True once every given persisted store has loaded from AsyncStorage. */
export function useHydrated(stores: Persisted[]): boolean {
  const check = () => stores.every((s) => s.persist.hasHydrated());
  const [hydrated, setHydrated] = useState(check);
  useEffect(() => {
    if (hydrated) return;
    const unsubs = stores.map((s) =>
      s.persist.onFinishHydration(() => setHydrated(check())),
    );
    setHydrated(check());
    return () => unsubs.forEach((u) => u());
    // Stores are module singletons; the list never changes.
  }, []);
  return hydrated;
}
