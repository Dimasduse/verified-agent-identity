"use strict";

// Mock external ESM dependencies that utils.js imports
jest.mock("@0xpolygonid/js-sdk", () => ({
  bytesToHex: (bytes) => Buffer.from(bytes).toString("hex"),
  keyPath: (keyType, keyID) => `${keyType}:${keyID}`,
  PROTOCOL_CONSTANTS: {
    PROTOCOL_MESSAGE_TYPE: {
      AUTHORIZATION_RESPONSE_MESSAGE_TYPE: "authorization-response",
    },
  },
}));

jest.mock("@iden3/js-iden3-core", () => {
  const mockEthAddress = new Uint8Array([
    0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd,
    0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12,
  ]);
  const mockId = {
    bigInt: () => BigInt("123456789"),
  };
  return {
    DID: {
      parse: jest.fn((did) => ({ string: () => did })),
      idFromDID: jest.fn(() => mockId),
    },
    Id: {
      ethAddressFromId: jest.fn(() => mockEthAddress),
    },
  };
});

jest.mock("uuid", () => ({
  v7: jest.fn(() => "test-uuid-v7"),
}));

jest.mock("@noble/curves/secp256k1", () => ({
  secp256k1: {
    Point: {
      fromHex: jest.fn(() => ({
        toHex: jest.fn(() => "compressed-public-key-hex"),
      })),
    },
  },
}));

const {
  normalizeKey,
  addHexPrefix,
  buildEthereumAddressFromDid,
  createDidDocument,
  normalizedKeyPath,
  getAuthResponseMessage,
  parseArgs,
  formatError,
  outputSuccess,
  urlFormating,
  codeFormating,
} = require("../../shared/utils");

describe("utils", () => {
  describe("normalizeKey", () => {
    it("removes 0x prefix when present", () => {
      expect(normalizeKey("0xabcdef")).toBe("abcdef");
    });

    it("returns key unchanged when no 0x prefix", () => {
      expect(normalizeKey("abcdef")).toBe("abcdef");
    });

    it("handles empty string after prefix", () => {
      expect(normalizeKey("0x")).toBe("");
    });

    it("does not remove prefix if not at start", () => {
      expect(normalizeKey("abc0xdef")).toBe("abc0xdef");
    });
  });

  describe("addHexPrefix", () => {
    it("adds 0x prefix when missing", () => {
      expect(addHexPrefix("abcdef")).toBe("0xabcdef");
    });

    it("does not double-add prefix when already present", () => {
      expect(addHexPrefix("0xabcdef")).toBe("0xabcdef");
    });

    it("handles empty string", () => {
      expect(addHexPrefix("")).toBe("0x");
    });
  });

  describe("buildEthereumAddressFromDid", () => {
    it("returns address with 0x prefix", () => {
      const address = buildEthereumAddressFromDid("did:iden3:test:123");
      expect(address.startsWith("0x")).toBe(true);
    });

    it("returns a hex string", () => {
      const address = buildEthereumAddressFromDid("did:iden3:test:123");
      expect(address).toMatch(/^0x[0-9a-f]+$/);
    });
  });

  describe("createDidDocument", () => {
    it("returns proper W3C DID document structure", () => {
      const doc = createDidDocument("did:iden3:test:123", "0x04publickey");
      expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(doc.id).toBe("did:iden3:test:123");
      expect(doc.verificationMethod).toHaveLength(1);
      expect(doc.verificationMethod[0].id).toBe("did:iden3:test:123#ethereum-based-id");
      expect(doc.verificationMethod[0].controller).toBe("did:iden3:test:123");
      expect(doc.verificationMethod[0].type).toBe("EcdsaSecp256k1RecoveryMethod2020");
      expect(doc.authentication).toEqual(["did:iden3:test:123#ethereum-based-id"]);
    });

    it("includes compressed public key from secp256k1", () => {
      const doc = createDidDocument("did:iden3:test:123", "0x04publickey");
      expect(doc.verificationMethod[0].publicKeyHex).toBe("compressed-public-key-hex");
    });
  });

  describe("normalizedKeyPath", () => {
    it("creates key path without 0x prefix", () => {
      const result = normalizedKeyPath("secp256k1", "0xabcdef");
      expect(result).toBe("secp256k1:abcdef");
    });

    it("works with key without prefix", () => {
      const result = normalizedKeyPath("secp256k1", "abcdef");
      expect(result).toBe("secp256k1:abcdef");
    });
  });

  describe("getAuthResponseMessage", () => {
    it("returns proper authorization response structure", () => {
      const msg = getAuthResponseMessage("did:test:123", "my-challenge");
      expect(msg.id).toBe("test-uuid-v7");
      expect(msg.thid).toBe("test-uuid-v7");
      expect(msg.from).toBe("did:test:123");
      expect(msg.to).toBe("");
      expect(msg.type).toBe("authorization-response");
      expect(msg.body.message).toBe("my-challenge");
      expect(msg.body.scope).toEqual([]);
    });
  });

  describe("parseArgs", () => {
    const originalArgv = process.argv;

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("parses --key value pairs", () => {
      process.argv = ["node", "script.js", "--did", "abc123", "--key", "xyz"];
      expect(parseArgs()).toEqual({ did: "abc123", key: "xyz" });
    });

    it("returns empty object when no args", () => {
      process.argv = ["node", "script.js"];
      expect(parseArgs()).toEqual({});
    });

    it("ignores non-flag arguments", () => {
      process.argv = ["node", "script.js", "random", "--did", "abc"];
      expect(parseArgs()).toEqual({ did: "abc" });
    });

    it("handles single flag-value pair", () => {
      process.argv = ["node", "script.js", "--challenge", '{"name":"test"}'];
      expect(parseArgs()).toEqual({ challenge: '{"name":"test"}' });
    });
  });

  describe("formatError", () => {
    it("formats error with message", () => {
      const error = new Error("Something went wrong");
      expect(formatError(error)).toBe("Error: Something went wrong");
    });

    it("handles error with empty message", () => {
      const error = new Error("");
      expect(formatError(error)).toBe("Error: ");
    });
  });

  describe("outputSuccess", () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("outputs string directly", () => {
      outputSuccess("hello");
      expect(consoleSpy).toHaveBeenCalledWith("hello");
    });

    it("outputs object as pretty JSON", () => {
      outputSuccess({ key: "value" });
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify({ key: "value" }, null, 2)
      );
    });

    it("outputs array as pretty JSON", () => {
      outputSuccess([1, 2, 3]);
      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify([1, 2, 3], null, 2)
      );
    });
  });

  describe("urlFormating", () => {
    it("creates markdown link format", () => {
      expect(urlFormating("Click here", "https://example.com")).toBe(
        "[Click here](https://example.com)"
      );
    });
  });

  describe("codeFormating", () => {
    it("wraps data in escaped backticks", () => {
      expect(codeFormating("some code")).toBe("\\`\\`\\`some code\\`\\`\\`");
    });
  });
});
