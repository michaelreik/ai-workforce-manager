import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "../crypto";

describe("crypto", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-key-for-unit-tests-1234567890abcdef";
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("encrypt returns iv:authTag:ciphertext format", () => {
    const encrypted = encrypt("sk-test-key-123");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // Each part should be valid base64
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
      expect(part.length).toBeGreaterThan(0);
    }
  });

  it("decrypt reverses encrypt", () => {
    const original = "sk-test-openai-key-abc123";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it("encrypt produces different output each time (random IV)", () => {
    const e1 = encrypt("same-input");
    const e2 = encrypt("same-input");
    expect(e1).not.toBe(e2);
    expect(decrypt(e1)).toBe("same-input");
    expect(decrypt(e2)).toBe("same-input");
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(typeof encrypted).toBe("string");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles long strings (full API key)", () => {
    const longKey = "sk-proj-" + "a".repeat(200);
    expect(decrypt(encrypt(longKey))).toBe(longKey);
  });

  it("handles special characters", () => {
    const key = "sk-key/with+special=chars&more!";
    expect(decrypt(encrypt(key))).toBe(key);
  });

  it("handles unicode characters", () => {
    const key = "sk-key-with-ümlauts-and-日本語";
    expect(decrypt(encrypt(key))).toBe(key);
  });

  it("decrypt returns plaintext as-is for un-encrypted strings (migration fallback)", () => {
    expect(decrypt("sk-plain-text-key")).toBe("sk-plain-text-key");
  });

  it("decrypt returns plaintext for strings with fewer than 3 colon-parts", () => {
    expect(decrypt("only:two")).toBe("only:two");
  });

  it("throws when ENCRYPTION_KEY is not set", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY env var is required");
  });

  it("decrypt fails with wrong encryption key", () => {
    const encrypted = encrypt("secret");
    process.env.ENCRYPTION_KEY = "different-key-entirely-1234567890";
    expect(() => decrypt(encrypted)).toThrow();
  });

  it("decrypt fails with tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    // Flip a character in the ciphertext
    const tampered = parts[2].charAt(0) === "A"
      ? parts[2].replace("A", "B")
      : parts[2].replace(parts[2].charAt(0), "Z");
    const tamperedString = `${parts[0]}:${parts[1]}:${tampered}`;
    expect(() => decrypt(tamperedString)).toThrow();
  });

  it("different encryption keys produce different ciphertexts", () => {
    process.env.ENCRYPTION_KEY = "key-1-abcdef1234567890";
    const e1 = encrypt("test");
    process.env.ENCRYPTION_KEY = "key-2-abcdef1234567890";
    const e2 = encrypt("test");
    expect(e1).not.toBe(e2);
  });
});
