"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { IdentitiesFileStorage } = require("../../../shared/storage/identities");

describe("IdentitiesFileStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "identities-test-"));
    storage = new IdentitiesFileStorage("identities.json");
    storage.filePath = path.join(tmpDir, "identities.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("returns empty array when file does not exist", async () => {
      const data = await storage.load();
      expect(data).toEqual([]);
    });

    it("returns stored data", async () => {
      const testData = [{ id: "item1", value: "test" }];
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, JSON.stringify(testData));

      const data = await storage.load();
      expect(data).toEqual(testData);
    });
  });

  describe("save", () => {
    it("adds a new item", async () => {
      await storage.save("item1", { id: "item1", value: "hello" });
      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({ id: "item1", value: "hello" });
    });

    it("updates existing item by key", async () => {
      await storage.save("item1", { id: "item1", value: "old" });
      await storage.save("item1", { id: "item1", value: "new" });

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].value).toBe("new");
    });

    it("uses custom keyName for matching", async () => {
      await storage.save("custom-key", { customId: "custom-key", data: "v1" }, "customId");
      await storage.save("custom-key", { customId: "custom-key", data: "v2" }, "customId");

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].data).toBe("v2");
    });

    it("adds multiple items with different keys", async () => {
      await storage.save("item1", { id: "item1", v: 1 });
      await storage.save("item2", { id: "item2", v: 2 });

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(2);
    });
  });

  describe("get", () => {
    it("returns item by key", async () => {
      await storage.save("item1", { id: "item1", value: "test" });
      const item = await storage.get("item1");
      expect(item).toEqual({ id: "item1", value: "test" });
    });

    it("returns undefined when key not found", async () => {
      const item = await storage.get("nonexistent");
      expect(item).toBeUndefined();
    });

    it("uses custom keyName", async () => {
      await storage.save("mykey", { name: "mykey", data: "x" }, "name");
      const item = await storage.get("mykey", "name");
      expect(item).toEqual({ name: "mykey", data: "x" });
    });
  });

  describe("delete", () => {
    it("deletes item by key", async () => {
      await storage.save("item1", { id: "item1", v: 1 });
      await storage.save("item2", { id: "item2", v: 2 });

      await storage.delete("item1");

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("item2");
    });

    it("throws when item not found", async () => {
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, "[]");

      await expect(storage.delete("nonexistent")).rejects.toThrow(
        "Item with id=nonexistent not found"
      );
    });

    it("uses custom keyName for deletion", async () => {
      await storage.save("k1", { name: "k1", x: 1 }, "name");
      await storage.delete("k1", "name");

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(0);
    });

    it("throws with custom keyName in error message", async () => {
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(storage.filePath, "[]");

      await expect(storage.delete("missing", "customKey")).rejects.toThrow(
        "Item with customKey=missing not found"
      );
    });
  });
});
