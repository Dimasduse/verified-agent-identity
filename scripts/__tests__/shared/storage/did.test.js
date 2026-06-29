"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { DidsFileStorage } = require("../../../shared/storage/did");

describe("DidsFileStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "did-test-"));
    storage = new DidsFileStorage("defaultDid.json");
    storage.filePath = path.join(tmpDir, "defaultDid.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("saves a new DID entry", async () => {
      await storage.save({ did: "did:test:123", publicKeyHex: "0xabc", isDefault: false });
      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({ did: "did:test:123", publicKeyHex: "0xabc", isDefault: false });
    });

    it("updates existing DID entry", async () => {
      await storage.save({ did: "did:test:123", publicKeyHex: "0xold", isDefault: false });
      await storage.save({ did: "did:test:123", publicKeyHex: "0xnew", isDefault: true });

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].publicKeyHex).toBe("0xnew");
      expect(data[0].isDefault).toBe(true);
    });

    it("unsets other defaults when saving with isDefault=true", async () => {
      await storage.save({ did: "did:test:1", publicKeyHex: "0xa", isDefault: true });
      await storage.save({ did: "did:test:2", publicKeyHex: "0xb", isDefault: true });

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(2);
      expect(data[0].isDefault).toBe(false);
      expect(data[1].isDefault).toBe(true);
    });

    it("does not unset defaults when isDefault=false", async () => {
      await storage.save({ did: "did:test:1", publicKeyHex: "0xa", isDefault: true });
      await storage.save({ did: "did:test:2", publicKeyHex: "0xb", isDefault: false });

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data[0].isDefault).toBe(true);
      expect(data[1].isDefault).toBe(false);
    });
  });

  describe("find", () => {
    it("finds entry by DID", async () => {
      await storage.save({ did: "did:test:123", publicKeyHex: "0xabc", isDefault: false });
      const entry = await storage.find("did:test:123");
      expect(entry).toEqual({ did: "did:test:123", publicKeyHex: "0xabc", isDefault: false });
    });

    it("returns undefined when DID not found", async () => {
      const entry = await storage.find("did:nonexistent");
      expect(entry).toBeUndefined();
    });
  });

  describe("getDefault", () => {
    it("returns the default DID entry", async () => {
      await storage.save({ did: "did:test:1", publicKeyHex: "0xa", isDefault: false });
      await storage.save({ did: "did:test:2", publicKeyHex: "0xb", isDefault: true });

      const defaultEntry = await storage.getDefault();
      expect(defaultEntry.did).toBe("did:test:2");
    });

    it("returns undefined when no default exists", async () => {
      await storage.save({ did: "did:test:1", publicKeyHex: "0xa", isDefault: false });
      const defaultEntry = await storage.getDefault();
      expect(defaultEntry).toBeUndefined();
    });

    it("returns undefined when no entries exist", async () => {
      const defaultEntry = await storage.getDefault();
      expect(defaultEntry).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns all DID entries", async () => {
      await storage.save({ did: "did:test:1", publicKeyHex: "0xa", isDefault: true });
      await storage.save({ did: "did:test:2", publicKeyHex: "0xb", isDefault: false });

      const entries = await storage.list();
      expect(entries).toHaveLength(2);
    });

    it("returns empty array when no entries", async () => {
      const entries = await storage.list();
      expect(entries).toEqual([]);
    });
  });
});
