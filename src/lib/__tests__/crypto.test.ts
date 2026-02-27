import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_KEY = "a".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

import { encrypt, decrypt } from "../crypto";

describe("encrypt", () => {
  it("returns a string with the enc: prefix", () => {
    const result = encrypt("hello");
    expect(result.startsWith("enc:")).toBe(true);
  });

  it("produces three colon-separated segments after the prefix", () => {
    const result = encrypt("hello");
    const withoutPrefix = result.slice("enc:".length);
    const parts = withoutPrefix.split(":");
    expect(parts).toHaveLength(3);
  });

  it("produces different ciphertext on repeated calls for same plaintext (random IV)", () => {
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(a).not.toBe(b);
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("hello")).toThrow();
  });

  it("throws when ENCRYPTION_KEY is too short", () => {
    process.env.ENCRYPTION_KEY = "abc123";
    expect(() => encrypt("hello")).toThrow();
  });
});

describe("decrypt", () => {
  it("round-trips a simple plaintext string", () => {
    const plaintext = "hello world";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const plaintext = "";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips a string with special characters", () => {
    const plaintext = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips unicode and emoji", () => {
    const plaintext = "Hello 世界 🌍 émojis naïve café résumé";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips a long string", () => {
    const plaintext = "x".repeat(10_000);
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("round-trips a JSON payload", () => {
    const plaintext = JSON.stringify({
      apiKey: "sk-secret-key-12345",
      endpoint: "https://api.example.com",
      scopes: ["read", "write"],
    });
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("returns plaintext strings unchanged — backward compat (no enc: prefix)", () => {
    expect(decrypt("plain-api-key-no-prefix")).toBe("plain-api-key-no-prefix");
  });

  it("returns empty string unchanged when no enc: prefix", () => {
    expect(decrypt("")).toBe("");
  });

  it("does not need env var for non-prefixed values", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(decrypt("no-prefix-here")).toBe("no-prefix-here");
  });

  it("throws on corrupted ciphertext (wrong number of segments)", () => {
    expect(() => decrypt("enc:aabbcc:ddeeff")).toThrow();
  });

  it("throws on corrupted ciphertext (only prefix)", () => {
    expect(() => decrypt("enc:")).toThrow();
  });

  it("throws when auth tag is tampered with (GCM integrity check)", () => {
    const ciphertext = encrypt("sensitive data");
    const parts = ciphertext.split(":");
    parts[2] = "00".repeat(16);
    const corrupted = parts.join(":");
    expect(() => decrypt(corrupted)).toThrow();
  });

  it("throws when decrypting with a different key than used to encrypt", () => {
    const ciphertext = encrypt("secret");
    process.env.ENCRYPTION_KEY = "b".repeat(64);
    expect(() => decrypt(ciphertext)).toThrow();
  });
});

describe("enc: prefix detection", () => {
  it("encrypt always adds the enc: prefix", () => {
    const inputs = ["", "hello", "enc:already-looks-encrypted", "special!@#"];
    for (const input of inputs) {
      expect(encrypt(input).startsWith("enc:")).toBe(true);
    }
  });

  it("enc: prefix is case-sensitive — ENC: values returned as-is", () => {
    expect(decrypt("ENC:something")).toBe("ENC:something");
  });
});
