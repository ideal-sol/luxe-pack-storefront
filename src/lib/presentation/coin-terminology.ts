export function presentCoinTerminology(value: string) {
  return value.split("ポイント").join("コイン");
}
