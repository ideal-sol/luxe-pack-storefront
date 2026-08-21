import type {
  ShippingAddress,
  ShippingAddressCollection,
  ShippingAddressInput,
} from "@/lib/platform";

export type ShippingAddressSummary = ShippingAddressCollection["items"][number];

export const emptyShippingAddress: ShippingAddressInput = {
  city: "",
  building: null,
  phone_number: "",
  postal_code: "",
  prefecture: "",
  recipient_name: "",
  street: "",
};

export function shippingAddressFingerprint(input: ShippingAddressInput) {
  return JSON.stringify([
    input.recipient_name,
    input.postal_code,
    input.prefecture,
    input.city,
    input.street,
    input.building ?? null,
    input.phone_number,
  ]);
}

export function isSameShippingAddress(actual: ShippingAddress, expected: ShippingAddressInput) {
  return shippingAddressFingerprint(actual) === shippingAddressFingerprint(expected);
}

export function toShippingAddressInput(address: ShippingAddress): ShippingAddressInput {
  return {
    building: address.building ?? null,
    city: address.city,
    phone_number: address.phone_number,
    postal_code: address.postal_code,
    prefecture: address.prefecture,
    recipient_name: address.recipient_name,
    street: address.street,
  };
}

export function ShippingAddressFields({
  disabled,
  fieldErrors,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (value: ShippingAddressInput) => void;
  readonly value: ShippingAddressInput;
}) {
  function field(
    name: keyof ShippingAddressInput,
    label: string,
    maximum: number,
    inputMode?: "numeric" | "tel",
  ) {
    const current = value[name] ?? "";
    return (
      <label className="form-field">
        <span>{label}</span>
        <input
          aria-invalid={fieldErrors[name] ? true : undefined}
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maximum}
          onChange={(event) => onChange({
            ...value,
            [name]: event.currentTarget.value || (name === "building" ? null : ""),
          })}
          required={name !== "building"}
          value={current}
        />
        {fieldErrors[name]?.map((message) => (
          <span className="form-field__error" key={message}>{message}</span>
        ))}
      </label>
    );
  }

  return (
    <div className="shipping-address-form__fields">
      {field("recipient_name", "お名前", 120)}
      {field("postal_code", "郵便番号", 16, "numeric")}
      {field("prefecture", "都道府県", 32)}
      {field("city", "市区町村", 120)}
      {field("street", "番地", 191)}
      {field("building", "建物名・部屋番号（任意）", 191)}
      {field("phone_number", "電話番号", 32, "tel")}
    </div>
  );
}

export function ShippingAddressMaskedPresentation({ address }: { readonly address: ShippingAddressSummary }) {
  return (
    <span className="shipping-address-masked">
      <strong>{address.recipient_name_masked}</strong>
      <small>{address.postal_code_masked}／{address.phone_number_masked}</small>
    </span>
  );
}
