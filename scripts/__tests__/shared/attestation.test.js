"use strict";

const { ethers } = require("ethers");
const {
  buildEncodedAttestation,
  computeAttestationHash,
  buildJsonAttestation,
} = require("../../shared/attestation");

// Use a known test DID that can be parsed by iden3 library
// We'll mock DID.parse and DID.idFromDID to avoid needing a real DID
jest.mock("@iden3/js-iden3-core", () => {
  const mockId = {
    bigInt: () => BigInt("12345678901234567890"),
  };
  return {
    DID: {
      parse: jest.fn((did) => did),
      idFromDID: jest.fn(() => mockId),
    },
    Id: {
      ethAddressFromId: jest.fn(() => new Uint8Array(20)),
    },
  };
});

describe("attestation", () => {
  const testReq = {
    recipientDid: "did:iden3:test:123",
    recipientEthAddress: "0x1234567890123456789012345678901234567890",
  };

  describe("buildJsonAttestation", () => {
    it("returns correct structure", () => {
      const result = buildJsonAttestation(testReq);

      expect(result.schemaId).toBe(
        "0xca354bee6dc5eded165461d15ccb13aceb6f77ebbb1fd3fe45aca686097f2911"
      );
      expect(result.attester).toEqual({
        did: "",
        iden3Id: "0",
        ethereumAddress: "0x0000000000000000000000000000000000000000",
      });
      expect(result.recipient.did).toBe("did:iden3:test:123");
      expect(result.recipient.ethereumAddress).toBe(
        "0x1234567890123456789012345678901234567890"
      );
      expect(result.recipient.iden3Id).toBe("12345678901234567890");
      expect(result.expirationTime).toBe("0");
      expect(result.revocable).toBe(false);
      expect(result.refId).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      expect(result.data).toBe("0x");
    });
  });

  describe("buildEncodedAttestation", () => {
    it("returns a hex-encoded string", () => {
      const encoded = buildEncodedAttestation(testReq);
      expect(encoded).toMatch(/^0x[0-9a-f]+$/i);
    });

    it("returns consistent output for same input", () => {
      const encoded1 = buildEncodedAttestation(testReq);
      const encoded2 = buildEncodedAttestation(testReq);
      expect(encoded1).toBe(encoded2);
    });

    it("returns different output for different recipients", () => {
      const req2 = {
        recipientDid: "did:iden3:test:456",
        recipientEthAddress: "0x0000000000000000000000000000000000000001",
      };
      const encoded1 = buildEncodedAttestation(testReq);
      const encoded2 = buildEncodedAttestation(req2);
      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe("computeAttestationHash", () => {
    it("returns a numeric string", () => {
      const hash = computeAttestationHash(testReq);
      expect(typeof hash).toBe("string");
      expect(/^\d+$/.test(hash)).toBe(true);
    });

    it("returns consistent hash for same input", () => {
      const hash1 = computeAttestationHash(testReq);
      const hash2 = computeAttestationHash(testReq);
      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different inputs", () => {
      const req2 = {
        recipientDid: "did:iden3:test:456",
        recipientEthAddress: "0x0000000000000000000000000000000000000001",
      };
      const hash1 = computeAttestationHash(testReq);
      const hash2 = computeAttestationHash(req2);
      expect(hash1).not.toBe(hash2);
    });

    it("applies bitmask to truncate leading nibble", () => {
      const hash = computeAttestationHash(testReq);
      const bigIntHash = BigInt(hash);
      // The result should be < 2^252 (mask removes top 4 bits of 256-bit hash)
      const maxValue = BigInt("0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      expect(bigIntHash <= maxValue).toBe(true);
    });
  });
});
