export const realtimeTopics = {
  catalog: "codart-catalog",
  adminOrders: "codart-admin-orders",
  userOrders: (userId: string) => `codart-user-orders-${userId}`,
  orderStatus: (orderId: string) => `codart-order-status-${orderId}`,
};
