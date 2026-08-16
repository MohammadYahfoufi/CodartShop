import type { DeliveryArea, PaymentMethod } from "@/lib/types";

export const deliveryAreas: Array<{ value: DeliveryArea; label: string; fee: number }> = [
  { value: "beirut", label: "Beirut", fee: 3 },
  { value: "mount-lebanon", label: "Mount Lebanon", fee: 4 },
  { value: "north", label: "North Lebanon", fee: 5 },
  { value: "south", label: "South Lebanon", fee: 5 },
  { value: "bekaa", label: "Bekaa", fee: 5 },
];

export const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash-on-delivery", label: "Cash on delivery" },
  { value: "whish-money", label: "Whish Money" },
  { value: "bank-transfer", label: "Bank transfer" },
];

export function getDeliveryArea(value: unknown) {
  return deliveryAreas.find((area) => area.value === value) ?? null;
}

export function getPaymentMethod(value: unknown) {
  return paymentMethods.find((method) => method.value === value) ?? null;
}
