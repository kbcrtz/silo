import { garmentFromTitle, looksFromTitle, tagsOf } from "../tags";

describe("looksFromTitle", () => {
  it.each([
    ["Brown Parachute Cargo Pants", ["streetwear"]],
    ["Cable Knit Polo Sweater for Women", ["preppy"]],
    ["Tuscany Boho Dress Rust Paisley Print", ["boho"]],
    ["Rust Lace-Trim Long Sleeve Top", ["romantic"]],
    ["Cameron Faux Leather Coat - Camel", ["edgy"]],
    ["Kita Windbreaker Jacket - White", ["sporty"]],
    ["Women's Tailored Single-Button Blazer", ["classic"]],
    ["Men's Mock Neck Pullover Sweater", ["minimal"]],
    ["Worn In Duck Carpenter Pants", ["workwear"]],
    ["Hot Rod Burst Bowling Shirt in Burgundy", ["retro"]],
    ["Everyday Relaxed Trouser", []],
  ])("%s", (title, looks) => {
    expect(looksFromTitle(title)).toEqual(looks);
  });

  it("gives at most two looks", () => {
    expect(looksFromTitle("Floral Lace Crochet Cargo Hoodie").length).toBe(2);
  });
});

describe("garmentFromTitle", () => {
  it.each([
    ["Navy Sweater Vest", "sweater vest"],
    ["Burgundy Linen Shirt Dress", "shirt dress"],
    ["Baggy Cargo Pants IL531", "cargo pants"],
    ["Roman Low Rise Baggy Jeans", "jeans"],
    ["Relaxed Cotton Twill Trouser in Dark Olive", "trousers"],
    ["Organic Oversized Hoodie", "hoodie"],
    ["Camel Merino Wool Blend Fine Knit Crew Neck Sweater", "sweater"],
    ["Classic Lightweight Tee - Burgundy", "tee"],
    ["Men's Camp Collar Shirt", "shirt"],
    ["Camel Trench Coat", "trench"],
    ["Linen Something", undefined],
  ])("%s", (title, garment) => {
    expect(garmentFromTitle(title)).toBe(garment);
  });
});

describe("tagsOf", () => {
  it("prefers the backend's tag, else reads the title", () => {
    expect(tagsOf({ id: "a", name: "Cargo Pants", aesthetics: ["workwear"] }).aesthetics).toEqual(["workwear"]);
    expect(tagsOf({ id: "b", name: "Cargo Pants" })).toEqual({
      id: "b",
      aesthetics: ["streetwear"],
      garment: "cargo pants",
    });
  });
});

it("ignores a look this app version doesn't know", () => {
  expect(tagsOf({ id: "c", name: "Cargo Pants", aesthetics: ["cottagecore" as never] }).aesthetics).toEqual(["streetwear"]);
});
