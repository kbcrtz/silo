import type { CatalogItem } from "@/data/catalog";
import { useProfile } from "@/store/profile";
import { recordSignal } from "@/store/taste";

const item = {
  id: "gid://shopify/p/1",
  name: "Relaxed Cargo Pants",
  category: "bottom",
  colors: [],
} as unknown as CatalogItem;

/** What useDiscover restarts the feed on: the stated style and the waived rules. */
const feedKeys = () => {
  const taste = useProfile.getState().taste;
  return { stated: taste?.stated, waived: taste?.waivers?.waived };
};

describe("recordSignal", () => {
  it("never changes what restarts the feed when a shopper opens, saves or shops", () => {
    recordSignal(item, "open");
    const before = feedKeys();
    recordSignal(item, "save");
    recordSignal({ ...item, id: "p2" }, "shop");
    recordSignal(item, "save");
    const after = feedKeys();
    expect(after.stated).toBe(before.stated);
    expect(after.waived ?? []).toEqual(before.waived ?? []);
    // Same reference too, so nothing downstream sees a change.
    recordSignal(item, "shop");
    expect(feedKeys().waived).toBe(after.waived);
  });

  it("writes nothing when the item has already earned that signal", () => {
    recordSignal(item, "save");
    const taste = useProfile.getState().taste;
    recordSignal(item, "save");
    expect(useProfile.getState().taste).toBe(taste);
  });
});
