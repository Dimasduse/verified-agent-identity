"use strict";

const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { ChallengeFileStorage } = require("../../../shared/storage/challenge");

describe("ChallengeFileStorage", () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "challenge-test-"));
    storage = new ChallengeFileStorage("challenges.json");
    storage.filePath = path.join(tmpDir, "challenges.json");
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("save", () => {
    it("saves a new challenge for a DID", async () => {
      await storage.save("did:test:123", "challenge-abc");
      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].did).toBe("did:test:123");
      expect(data[0].challenge).toBe("challenge-abc");
      expect(data[0].created_at).toBeDefined();
    });

    it("updates existing challenge for same DID", async () => {
      await storage.save("did:test:123", "old-challenge");
      await storage.save("did:test:123", "new-challenge");

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].challenge).toBe("new-challenge");
    });

    it("saves multiple challenges for different DIDs", async () => {
      await storage.save("did:test:1", "challenge-1");
      await storage.save("did:test:2", "challenge-2");

      const data = JSON.parse(await fs.readFile(storage.filePath, "utf-8"));
      expect(data).toHaveLength(2);
    });
  });

  describe("find", () => {
    it("finds entry by DID", async () => {
      await storage.save("did:test:123", "my-challenge");
      const entry = await storage.find("did:test:123");
      expect(entry.did).toBe("did:test:123");
      expect(entry.challenge).toBe("my-challenge");
    });

    it("returns undefined when DID not found", async () => {
      const entry = await storage.find("did:nonexistent");
      expect(entry).toBeUndefined();
    });
  });

  describe("getChallenge", () => {
    it("returns challenge string for existing DID", async () => {
      await storage.save("did:test:123", "the-challenge");
      const challenge = await storage.getChallenge("did:test:123");
      expect(challenge).toBe("the-challenge");
    });

    it("returns undefined for non-existent DID", async () => {
      const challenge = await storage.getChallenge("did:nonexistent");
      expect(challenge).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns all entries", async () => {
      await storage.save("did:test:1", "c1");
      await storage.save("did:test:2", "c2");
      const entries = await storage.list();
      expect(entries).toHaveLength(2);
    });

    it("returns empty array when no entries", async () => {
      const entries = await storage.list();
      expect(entries).toEqual([]);
    });
  });

  describe("delete", () => {
    it("deletes entry by DID and returns true", async () => {
      await storage.save("did:test:123", "challenge");
      const result = await storage.delete("did:test:123");
      expect(result).toBe(true);

      const entries = await storage.list();
      expect(entries).toHaveLength(0);
    });

    it("returns false when DID not found", async () => {
      const result = await storage.delete("did:nonexistent");
      expect(result).toBe(false);
    });

    it("does not delete other entries", async () => {
      await storage.save("did:test:1", "c1");
      await storage.save("did:test:2", "c2");
      await storage.delete("did:test:1");

      const entries = await storage.list();
      expect(entries).toHaveLength(1);
      expect(entries[0].did).toBe("did:test:2");
    });
  });
});
