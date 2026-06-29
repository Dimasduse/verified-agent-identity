"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { FileStorage } = require("../../../shared/storage/base");

describe("FileStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "filestorage-test-"));
    storage = new FileStorage("test.json", tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("sets filePath correctly", () => {
      expect(storage.filePath).toBe(path.join(tmpDir, "test.json"));
    });

    it("uses default baseDir when not provided", () => {
      const defaultStorage = new FileStorage("data.json");
      expect(defaultStorage.filePath).toBe(
        path.join(process.env.HOME, ".openclaw", "billions", "data.json")
      );
    });
  });

  describe("ensureDirectory", () => {
    it("creates the directory if it does not exist", async () => {
      const nestedStorage = new FileStorage(
        "nested/deep/test.json",
        tmpDir
      );
      await nestedStorage.ensureDirectory();
      const stat = await fs.stat(path.join(tmpDir, "nested", "deep"));
      expect(stat.isDirectory()).toBe(true);
    });

    it("does not throw if directory already exists", async () => {
      await storage.ensureDirectory();
      await expect(storage.ensureDirectory()).resolves.not.toThrow();
    });
  });

  describe("readFile", () => {
    it("returns empty array when file does not exist", async () => {
      const data = await storage.readFile();
      expect(data).toEqual([]);
    });

    it("reads and parses JSON data", async () => {
      const testData = [{ id: 1, name: "test" }];
      await fs.writeFile(
        storage.filePath,
        JSON.stringify(testData),
        "utf-8"
      );
      const data = await storage.readFile();
      expect(data).toEqual(testData);
    });

    it("throws on invalid JSON", async () => {
      await fs.mkdir(path.dirname(storage.filePath), { recursive: true });
      await fs.writeFile(storage.filePath, "not json", "utf-8");
      await expect(storage.readFile()).rejects.toThrow();
    });

    it("throws on non-ENOENT errors", async () => {
      // Make the file a directory to cause a different error
      await fs.mkdir(storage.filePath, { recursive: true });
      await expect(storage.readFile()).rejects.toThrow();
    });
  });

  describe("writeFile", () => {
    it("writes JSON data to file", async () => {
      const testData = [{ id: 1, name: "test" }];
      await storage.writeFile(testData);
      const content = await fs.readFile(storage.filePath, "utf-8");
      expect(JSON.parse(content)).toEqual(testData);
    });

    it("creates directory if it does not exist", async () => {
      const nestedStorage = new FileStorage("sub/test.json", tmpDir);
      await nestedStorage.writeFile([{ key: "value" }]);
      const content = await fs.readFile(nestedStorage.filePath, "utf-8");
      expect(JSON.parse(content)).toEqual([{ key: "value" }]);
    });

    it("overwrites existing file", async () => {
      await storage.writeFile([{ v: 1 }]);
      await storage.writeFile([{ v: 2 }]);
      const content = await fs.readFile(storage.filePath, "utf-8");
      expect(JSON.parse(content)).toEqual([{ v: 2 }]);
    });

    it("writes pretty-printed JSON (2 space indent)", async () => {
      const testData = [{ id: 1 }];
      await storage.writeFile(testData);
      const content = await fs.readFile(storage.filePath, "utf-8");
      expect(content).toBe(JSON.stringify(testData, null, 2));
    });

    it("uses atomic write (temp file then rename)", async () => {
      // After write, no .tmp file should remain
      await storage.writeFile([{ test: true }]);
      const tmpFile = `${storage.filePath}.tmp`;
      await expect(fs.access(tmpFile)).rejects.toThrow();
    });
  });
});
