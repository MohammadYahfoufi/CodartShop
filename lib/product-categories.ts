export const PRODUCT_CATEGORIES = [
  { value: "Wireless Audio", label: "Wireless Audio", image: "/icons/earbuds.svg" },
  { value: "Wired Audio", label: "Wired Audio", image: "/icons/wired-audio.svg" },
  { value: "Chargers", label: "Chargers", image: "/icons/chargers.svg" },
  { value: "Cables", label: "Cables", image: "/icons/cables.svg" },
  { value: "Power Banks", label: "Power Banks", image: "/icons/power-banks.svg" },
  { value: "Adapters", label: "Adapters", image: "/icons/adapters.svg" },
  { value: "Car Accessories", label: "Car Accessories", image: "/icons/car-accessories.svg" },
] as const;

export const DEFAULT_PRODUCT_CATEGORY = PRODUCT_CATEGORIES[0].value;
