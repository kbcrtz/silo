import { useSaved } from "@/store/saved";

describe("saved store", () => {
  beforeEach(() => useSaved.getState().clear());

  it("saves newest first and unsaves from every list", () => {
    const s = useSaved.getState();
    s.toggle("a");
    s.toggle("b");
    const list = s.createList("Fall", "a");
    expect(useSaved.getState().itemIds).toEqual(["a", "b"]);

    useSaved.getState().toggle("a");
    const after = useSaved.getState();
    expect(after.itemIds).toEqual(["b"]);
    expect(after.lists.find((l) => l.id === list)!.itemIds).toEqual([]);
  });

  it("adding to a list saves the item", () => {
    const list = useSaved.getState().createList("Work");
    useSaved.getState().toggleInList(list, "c");
    expect(useSaved.getState().itemIds).toEqual(["c"]);
    useSaved.getState().toggleInList(list, "c");
    expect(useSaved.getState().lists[0].itemIds).toEqual([]);
    // Taking it out of a list keeps it saved.
    expect(useSaved.getState().itemIds).toEqual(["c"]);
  });
});
