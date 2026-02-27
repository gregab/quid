export const getRandomBytesAsync = (size: number) =>
  Promise.resolve(new Uint8Array(size));
export const digestStringAsync = () => Promise.resolve("mock-hash");
export const CryptoDigestAlgorithm = { SHA256: "SHA-256", SHA1: "SHA-1", MD5: "MD5" };
