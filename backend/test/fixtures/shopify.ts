// Shopify Global Catalog responses in the shape recorded from the live API
// (2026-10-18, UCP 2026-08-25). Merchants and products are made up: no real
// catalog data is stored in the repo.

const seller = (name: string, domain: string) => ({
  id: "gid://shopify/Shop/1001",
  name,
  url: `https://${domain}`,
  domain: `${name.toLowerCase().replace(/\W/g, "")}.myshopify.com`,
  links: [{ type: "refund_policy", url: `https://${domain}/policies/refund.html` }],
});

export const trouser = {
  id: "gid://shopify/p/AAA111",
  title: "Everyday Relaxed Trouser",
  description: { plain: "<p>Relaxed fit &amp; drawstring waist.</p>" },
  handle: "everyday-relaxed-trouser",
  rating: { value: 4.6, scale_min: 1, scale_max: 5, count: 120 },
  media: [{ type: "image", url: "https://cdn.shopify.com/s/files/1/0001/trouser-olive.jpg", alt_text: "Olive relaxed trouser" }],
  options: [
    { name: "Color", values: [{ label: "Olive Green" }, { label: "Bering Sea" }, { label: "Space Black" }] },
    { name: "Waist size", values: [{ label: "30\"" }, { label: "32\"" }] },
    { name: "Inseam length", values: [{ label: "30\"" }, { label: "32\"" }] },
  ],
  metadata: { top_features: ["Drawstring waist"], tech_specs: ["Fit: Relaxed", "Length: Full", "Material: Linen blend", "Care: Machine wash"] },
  variants: [
    {
      id: "gid://shopify/ProductVariant/5001",
      title: "Everyday Relaxed Trouser - Olive Green",
      url: "https://fernhill.example/products/everyday-relaxed-trouser?variant=5001&utm_source=shopify&utm_medium=catalog",
      price: { amount: 8900, currency: "USD" },
      availability: { available: true },
      options: [
        { name: "Waist size", label: "32\"" },
        { name: "Color", label: "Olive Green" },
        { name: "Inseam length", label: "30\"" },
      ],
      seller: seller("Fernhill", "fernhill.example"),
      checkout_url: "https://fernhill.example/cart/5001:1",
      condition: ["new"],
      eligible: { native_checkout: false },
    },
  ],
  price_range: { min: { amount: 8900, currency: "USD" }, max: { amount: 8900, currency: "USD" } },
};

/** No options at all: the color can only come from the title. */
export const sweater = {
  id: "gid://shopify/p/BBB222",
  title: "Charcoal Grey Crewneck Sweater",
  description: { plain: "Merino." },
  handle: "charcoal-crewneck",
  media: [{ type: "image", url: "https://cdn.shopify.com/s/files/1/0002/sweater.jpg", alt_text: "" }],
  variants: [
    {
      id: "gid://shopify/ProductVariant/5002",
      title: "Charcoal Grey Crewneck Sweater",
      url: "https://ostra.example/products/charcoal-crewneck?variant=5002",
      price: { amount: 120050, currency: "JPY" },
      availability: { available: true },
      seller: seller("Ostra", "ostra.example"),
    },
  ],
  price_range: { min: { amount: 120050, currency: "JPY" }, max: { amount: 120050, currency: "JPY" } },
};

/** No image, no price, a color name the table doesn't know. */
export const bare = {
  id: "gid://shopify/p/CCC333",
  title: "Linen Overshirt",
  handle: "linen-overshirt",
  options: [{ name: "Colour", values: [{ label: "Sea Spray" }] }],
  variants: [
    {
      id: "gid://shopify/ProductVariant/5003",
      title: "Linen Overshirt",
      url: "https://tide.example/products/linen-overshirt?variant=5003",
      availability: { available: false },
      options: [{ name: "Colour", label: "Sea Spray" }],
      seller: seller("Tide", "tide.example"),
    },
  ],
};

/** No variant carries a merchant URL, so there is nothing to link to: dropped. */
export const noUrl = {
  id: "gid://shopify/p/DDD444",
  title: "Mystery Jacket",
  media: [{ type: "image", url: "https://cdn.shopify.com/s/files/1/0004/jacket.jpg" }],
  variants: [{ id: "gid://shopify/ProductVariant/5004", title: "Mystery Jacket", price: { amount: 5000, currency: "USD" } }],
};

export const searchResult = (products: unknown[], cursor: string | null = "c1") => ({
  jsonrpc: "2.0",
  id: 1,
  result: {
    structuredContent: {
      ucp: { version: "2026-08-25" },
      products,
      messages: [],
      pagination: cursor ? { has_next_page: true, total_count: 437, cursor } : { has_next_page: false, total_count: products.length },
    },
  },
});

export const productDetail = {
  ...trouser,
  media: [...trouser.media, { type: "image", url: "https://cdn.shopify.com/s/files/1/0001/trouser-back.jpg", alt_text: "Back" }],
  options: [
    { name: "Color", values: [{ label: "Olive Green", available: true, exists: true }, { label: "Space Black", available: false, exists: true }] },
    { name: "Waist size", values: [{ label: "30\"", available: true, exists: true }, { label: "32\"", available: true, exists: true }] },
  ],
  variants: [
    trouser.variants[0],
    {
      ...trouser.variants[0],
      id: "gid://shopify/ProductVariant/5005",
      title: "Everyday Relaxed Trouser - Space Black",
      url: "https://fernhill.example/products/everyday-relaxed-trouser?variant=5005",
      availability: { available: false },
      options: [
        { name: "Waist size", label: "30\"" },
        { name: "Color", label: "Space Black" },
      ],
    },
  ],
  selected: [
    { name: "Color", label: "Olive Green" },
    { name: "Waist size", label: "32\"" },
  ],
};

export const productResult = (product: unknown) => ({
  jsonrpc: "2.0",
  id: 1,
  result: { structuredContent: { ucp: { version: "2026-08-25" }, product } },
});

/** What get_product returns for an id that doesn't resolve (recorded). */
export const notFoundResult = {
  jsonrpc: "2.0",
  id: 1,
  result: {
    structuredContent: {
      ucp: { version: "2026-08-25" },
      messages: [{ type: "error", code: "not_found", content: "Product not found: gid://shopify/p/nope", severity: "unrecoverable" }],
    },
  },
};

/** A missing agent profile (recorded, HTTP 422). */
export const rpcError = {
  jsonrpc: "2.0",
  id: 1,
  error: { code: -32001, message: "UCP discovery failed", data: { code: "invalid_profile_url", content: "Unable to fetch agent profile: Missing profile uri" } },
};
