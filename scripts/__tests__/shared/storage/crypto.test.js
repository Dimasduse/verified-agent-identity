"use strict";

const { getMasterKey, encryptKey, decryptKey } = require("../../../shared/storage/crypto");

describe("crypto", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getMasterKey", () => {
    it("returns null when BILLIONS_NETWORK_MASTER_KMS_KEY is not set", () => {
      delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when env var is not a string (undefined)", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = undefined;
      delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when key is too short (less than 16 chars)", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "short";
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when key is exactly 15 chars", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "a".repeat(15);
      expect(getMasterKey()).toBeNull();
    });

    it("returns null when key is whitespace-only (trimmed length < 16)", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "   ";
      expect(getMasterKey()).toBeNull();
    });

    it("returns trimmed key when key is valid (>= 16 chars)", () => {
      const key = "my-super-secret-master-key-12345";
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = key;
      expect(getMasterKey()).toBe(key);
    });

    it("returns trimmed key when key has leading/trailing spaces", () => {
      const key = "my-super-secret-master-key-12345";
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = `  ${key}  `;
      expect(getMasterKey()).toBe(key);
    });

    it("returns key when exactly 16 chars", () => {
      const key = "a".repeat(16);
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = key;
      expect(getMasterKey()).toBe(key);
    });
  });

  describe("encryptKey / decryptKey", () => {
    const masterKey = "test-master-key-at-least-16-chars";
    const plaintext = "deadbeef1234567890abcdef";

    it("encrypts and decrypts a key successfully", () => {
      const encrypted = encryptKey(plaintext, masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertext on each call (random IV)", () => {
      const encrypted1 = encryptKey(plaintext, masterKey);
      const encrypted2 = encryptKey(plaintext, masterKey);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("encrypted output has format iv:authTag:ciphertext (3 colon-separated hex parts)", () => {
      const encrypted = encryptKey(plaintext, masterKey);
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      // IV should be 12 bytes = 24 hex chars
      expect(parts[0]).toHaveLength(24);
      // Auth tag should be 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // Ciphertext length depends on plaintext length
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it("throws on decryption with wrong master key", () => {
      const encrypted = encryptKey(plaintext, masterKey);
      expect(() => decryptKey(encrypted, "wrong-master-key-at-least-16")).toThrow(
        "kms.json decryption failed"
      );
    });

    it("throws on invalid encrypted format (missing parts)", () => {
      expect(() => decryptKey("invalid-no-colons", masterKey)).toThrow(
        "Invalid encrypted key format"
      );
    });

    it("throws on invalid encrypted format (only 2 parts)", () => {
      expect(() => decryptKey("part1:part2", masterKey)).toThrow(
        "Invalid encrypted key format"
      );
    });

    it("handles empty string plaintext", () => {
      const encrypted = encryptKey("", masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe("");
    });

    it("handles long plaintext", () => {
      const longKey = "a".repeat(1024);
      const encrypted = encryptKey(longKey, masterKey);
      const decrypted = decryptKey(encrypted, masterKey);
      expect(decrypted).toBe(longKey);
    });
  });
});
