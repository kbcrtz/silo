import assert from "node:assert/strict";
import { test } from "node:test";
import { junkReason } from "../src/catalog/hygiene.ts";

const usd = { minor: 4900, currency: "USD", formatted: "$49.00" };
const listing = (title: string, store = "Fernhill", price = usd) => ({ title, merchant: { name: store }, price });

test("ordinary listings are kept, including words like sexy that are legitimate retail", () => {
  for (const title of ["Women's Tailored Single-Button Blazer", "Black and White Striped Shirt", "Sexy Satin Slip Dress", "Reputation Tee", "Size-Inclusive Wide Leg Trouser"]) {
    assert.equal(junkReason(listing(title), "US"), null, title);
  }
});

test("counterfeits are caught in the title or the store name", () => {
  assert.equal(junkReason(listing("SP5DER Hoodie 1:1"), "US"), "counterfeit");
  assert.equal(junkReason(listing("Web Hoodie Sky Blue", "Prime Reps"), "US"), "counterfeit");
  assert.equal(junkReason(listing("AAA Replica Jacket"), "US"), "counterfeit");
});

test("resale listings are caught by their shorthand", () => {
  for (const title of ["Nautica Sweater NWT", "J.Crew Blazer EUC", "Pre-owned Wool Coat", "Preloved Denim Jacket", "Thrifted Flannel", "Levi's Jeans Sz 32", "Silk Blouse SZ XL"]) {
    assert.equal(junkReason(listing(title), "US"), "resale", title);
  }
  // Seen live: a used jacket titled with its one size, and a resale shop by name.
  assert.equal(junkReason(listing("Zyia hooded windbreaker jacket, white. Women's M"), "US"), "resale");
  assert.equal(junkReason(listing("Windbreaker", "Rewear"), "US"), "resale");
  assert.equal(junkReason(listing("Linen Shirt", "Northside Consignment"), "US"), "resale");
  // A size word mid-title is ordinary retail.
  assert.equal(junkReason(listing("Women's M Logo Tee in Cream"), "US"), null);
  assert.equal(junkReason(listing("Wide Leg Trouser 33″ - Navy"), "US"), null);
});

test("keyword-stuffed titles are caught: too long, every size, or a run of colors", () => {
  assert.equal(junkReason(listing("x".repeat(101)), "US"), "stuffed");
  assert.equal(junkReason(listing("Women's Casual Loose Shirt S-XXL"), "US"), "stuffed");
  assert.equal(junkReason(listing("Crop Top Black White Pink Party"), "US"), "stuffed");
  assert.equal(junkReason(listing("Grey Gray Tee"), "US"), null, "grey and gray are one color");
});

test("prices in another currency are dropped only where the country's currency is known", () => {
  const inr = { minor: 249900, currency: "INR", formatted: "₹2,499" };
  assert.equal(junkReason(listing("Linen Trouser", "Store", inr), "US"), "currency");
  assert.equal(junkReason(listing("Linen Trouser", "Store", inr), "IN"), null);
  assert.equal(junkReason(listing("Linen Trouser", "Store", inr)), null);
  assert.equal(junkReason({ title: "Linen Trouser", merchant: { name: "Store" }, price: null }, "US"), null);
});
