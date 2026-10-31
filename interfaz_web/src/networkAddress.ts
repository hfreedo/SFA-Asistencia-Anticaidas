export function networkAddress(address: string, port: number, serverUrl: string) {
  const protocol = new URL(serverUrl).protocol;
  if (protocol !== "http:" && protocol !== "https:") throw new Error("Unsupported local protocol");
  const host = address.includes(":") && !address.startsWith("[") ? `[${address}]` : address;
  return new URL(`${protocol}//${host}:${port}`).origin;
}
