export const PRODUCT_CATEGORIES = [
  { value: "Wireless Audio", label: "Wireless Audio", image: "/categories/wireless-audio.png" },
  { value: "Wired Audio", label: "Wired Audio", image: "/categories/wired-audio.png" },
  { value: "Chargers", label: "Chargers", image: "/categories/chargers.png" },
  { value: "Cables", label: "Cables", image: "/categories/cables.png" },
  { value: "Power Banks", label: "Power Banks", image: "/categories/power-banks.png" },
  { value: "Adapters", label: "Adapters", image: "/categories/adapters.png" },
  { value: "Car Accessories", label: "Car Accessories", image: "/categories/car-accessories.png" },
] as const;

export const DEFAULT_PRODUCT_CATEGORY = PRODUCT_CATEGORIES[0].value;
