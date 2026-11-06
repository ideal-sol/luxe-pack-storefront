// Synthetic PR662 Public OpenAPI data, not an unpublished generated Artifact.
export const paidyV23BuyerData = {
  user_id: "00000000-0000-4000-8000-000000000001", age: 10,
  account_registration_date: "2026-10-27", delivery_locn_type: "other",
  days_since_first_transaction: 0,
  previous_payment_methods: { credit_card_used: false, convenience_store_prepayment_used: false, bank_transfer_used: false },
  order_item_categories: ["コイン"], ltv: 0, order_count: 0,
  order_count_last3months: 0, order_amount_last3months: 0, number_of_points: 0,
};
export function paidyV23Action() {
  return {
    type: "paidy_checkout", script_url: "https://apps.paidy.com/", public_key: "pk_fixture",
    payload: {
      amount: 1000, currency: "JPY", store_name: "Fixture", description: "コイン購入",
      buyer: { email: "member@example.test", phone: "09000000000" },
      buyer_data: structuredClone(paidyV23BuyerData),
      order: { order_ref: "00000000-0000-4000-8000-000000000002", shipping: 0, tax: 0,
        items: [{ id: "00000000-0000-4000-8000-000000000003", title: "コイン", quantity: 1, unit_price: 1000 }] },
    },
  };
}
