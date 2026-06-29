"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { KeysFileStorage } = require("../../../shared/storage/keys");

describe("KeysFileStorage", () => {
  let tmpDir;
  let storage;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.BILLIONS_NETWORK_MASTER_KMS_KEY;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "keys-test-"));
    storage = new KeysFileStorage("kms.json");
    // Override filePath to use temp directory
    storage.filePath = path.join(tmpDir, "kms.json");
  });

  afterEach(async () => {
    process.env = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("_decodeEntry", () => {
    it("decodes legacy format entries", () => {
      const entry = { alias: "secp256k1:key1", privateKeyHex: "deadbeef" };
      const result = storage._decodeEntry(entry);
      expect(result).toEqual({ alias: "secp256k1:key1", privateKeyHex: "deadbeef" });
    });

    it("decodes version 1 plain entries", () => {
      const entry = {
        version: 1,
        provider: "plain",
        data: { alias: "secp256k1:key1", key: "deadbeef", createdAt: "2026-01-01T00:00:00Z" },
      };
      const result = storage._decodeEntry(entry);
      expect(result).toEqual({
        alias: "secp256k1:key1",
        privateKeyHex: "deadbeef",
        createdAt: "2026-01-01T00:00:00Z",
      });
    });

    it("returns opaque entry when encrypted but no master key set", () => {
      const entry = {
        version: 1,
        provider: "encrypted",
        data: { alias: "secp256k1:key1", key: "iv:tag:cipher", createdAt: "2026-01-01T00:00:00Z" },
      };
      const result = storage._decodeEntry(entry);
      expect(result._opaque).toBe(true);
      expect(result.alias).toBe("secp256k1:key1");
      expect(result._raw).toBe(entry);
    });

    it("decrypts encrypted entry when master key is set", () => {
      const masterKey = "my-test-master-key-long-enough";
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = masterKey;

      const { encryptKey } = require("../../../shared/storage/crypto");
      const encrypted = encryptKey("deadbeef", masterKey);

      const entry = {
        version: 1,
        provider: "encrypted",
        data: { alias: "secp256k1:key1", key: encrypted, createdAt: "2026-01-01T00:00:00Z" },
      };
      const result = storage._decodeEntry(entry);
      expect(result.privateKeyHex).toBe("deadbeef");
      expect(result.alias).toBe("secp256k1:key1");
    });

    it("throws on unrecognized format", () => {
      const entry = { version: 99, provider: "unknown", data: { alias: "test" } };
      expect(() => storage._decodeEntry(entry)).toThrow("Unrecognised kms.json entry format");
    });
  });

  describe("_encodeEntry", () => {
    it("encodes as plain when no master key", () => {
      const entry = { alias: "secp256k1:key1", privateKeyHex: "deadbeef", createdAt: "2026-01-01T00:00:00Z" };
      const result = storage._encodeEntry(entry);
      expect(result).toEqual({
        version: 1,
        provider: "plain",
        data: { alias: "secp256k1:key1", key: "deadbeef", createdAt: "2026-01-01T00:00:00Z" },
      });
    });

    it("encodes as encrypted when master key is set", () => {
      process.env.BILLIONS_NETWORK_MASTER_KMS_KEY = "my-test-master-key-long-enough";
      const entry = { alias: "secp256k1:key1", privateKeyHex: "deadbeef", createdAt: "2026-01-01T00:00:00Z" };
      const result = storage._encodeEntry(entry);
      expect(result.version).toBe(1);
      expect(result.provider).toBe("encrypted");
      expect(result.data.alias).toBe("secp256k1:key1");
      expect(result.data.key).toContain(":");
    });
  });

  describe("readFile", () => {
    it("returns empty array when file does not exist", async () => {
      const keys = await storage.readFile();
      expect(keys).toEqual([]);
    });

    it("throws when root is not an array", async () => {
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify({ not: "array" }));
      await expect(storage.readFile()).rejects.toThrow("kms.json root must be an array");
    });

    it("filters out opaque entries from return value", async () => {
      const data = [
        { version: 1, provider: "plain", data: { alias: "key1", key: "abc", createdAt: "2026-01-01T00:00:00Z" } },
        { version: 1, provider: "encrypted", data: { alias: "key2", key: "iv:tag:cipher", createdAt: "2026-01-01T00:00:00Z" } },
      ];
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify(data));

      const keys = await storage.readFile();
      expect(keys).toHaveLength(1);
      expect(keys[0].alias).toBe("key1");
    });

    it("stores opaque entries in _opaqueEntries", async () => {
      const encryptedEntry = {
        version: 1,
        provider: "encrypted",
        data: { alias: "key2", key: "iv:tag:cipher", createdAt: "2026-01-01T00:00:00Z" },
      };
      const data = [
        { version: 1, provider: "plain", data: { alias: "key1", key: "abc", createdAt: "2026-01-01T00:00:00Z" } },
        encryptedEntry,
      ];
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify(data));

      await storage.readFile();
      expect(storage._opaqueEntries).toHaveLength(1);
      expect(storage._opaqueEntries[0]).toEqual(encryptedEntry);
    });
  });

  describe("importKey", () => {
    it("adds a new key", async () => {
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, "[]");

      await storage.importKey({ alias: "secp256k1:key1", key: "deadbeef" });

      const content = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(content).toHaveLength(1);
      expect(content[0].data.alias).toBe("secp256k1:key1");
      expect(content[0].data.key).toBe("deadbeef");
    });

    it("updates an existing key by alias", async () => {
      const data = [
        { version: 1, provider: "plain", data: { alias: "secp256k1:key1", key: "old", createdAt: "2026-01-01T00:00:00Z" } },
      ];
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify(data));

      await storage.importKey({ alias: "secp256k1:key1", key: "new" });

      const content = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(content).toHaveLength(1);
      expect(content[0].data.key).toBe("new");
    });

    it("removes opaque entry with same alias on import", async () => {
      const encryptedEntry = {
        version: 1,
        provider: "encrypted",
        data: { alias: "secp256k1:key1", key: "iv:tag:cipher", createdAt: "2026-01-01T00:00:00Z" },
      };
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify([encryptedEntry]));

      // Read first to populate _opaqueEntries
      await storage.readFile();
      expect(storage._opaqueEntries).toHaveLength(1);

      await storage.importKey({ alias: "secp256k1:key1", key: "newkey" });

      const content = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      // Should have the new key and no opaque entries
      expect(content).toHaveLength(1);
      expect(content[0].data.key).toBe("newkey");
      expect(content[0].provider).toBe("plain");
    });
  });

  describe("get", () => {
    it("returns private key hex for matching alias", async () => {
      const data = [
        { version: 1, provider: "plain", data: { alias: "secp256k1:key1", key: "deadbeef", createdAt: "2026-01-01T00:00:00Z" } },
      ];
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify(data));

      const result = await storage.get({ alias: "secp256k1:key1" });
      expect(result).toBe("deadbeef");
    });

    it("returns empty string when alias not found", async () => {
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, "[]");

      const result = await storage.get({ alias: "nonexistent" });
      expect(result).toBe("");
    });
  });

  describe("list", () => {
    it("returns all keys as alias/key pairs", async () => {
      const data = [
        { version: 1, provider: "plain", data: { alias: "key1", key: "abc", createdAt: "2026-01-01T00:00:00Z" } },
        { version: 1, provider: "plain", data: { alias: "key2", key: "def", createdAt: "2026-01-01T00:00:00Z" } },
      ];
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify(data));

      const result = await storage.list();
      expect(result).toEqual([
        { alias: "key1", key: "abc" },
        { alias: "key2", key: "def" },
      ]);
    });

    it("returns empty array when no keys", async () => {
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, "[]");

      const result = await storage.list();
      expect(result).toEqual([]);
    });
  });
});
