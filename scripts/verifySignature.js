const { JWSPacker, byteEncoder } = require("@0xpolygonid/js-sdk");
const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  outputSuccess,
  validateArgs,
  runScript,
} = require("./shared/utils");

async function main() {
  const args = parseArgs();
  validateArgs(
    args,
    ["token"],
    "node scripts/verifySignature.js --token <token> [--did <did>]",
  );

  const { kms, challengeStorage } = await getInitializedRuntime();

  const challenge = await challengeStorage.getChallenge(args.did);
  if (!challenge) {
    throw new Error(
      `No challenge found for DID: ${args.did}. Generate a challenge first with generateChallenge.js`,
    );
  }

  const resolveDIDDocument = {
    resolve: async (did) => {
      const resp = await fetch(
        `https://resolver.privado.id/1.0/identifiers/${did}`,
      );
      return await resp.json();
    },
  };

  const jws = new JWSPacker(kms, resolveDIDDocument);
  const basicMessage = await jws.unpack(byteEncoder.encode(args.token));

  if (basicMessage.from !== args.did) {
    throw new Error(
      `Invalid from: expected from ${args.did}, got ${basicMessage.from}`,
    );
  }

  const payload = basicMessage.body;
  if (payload.message !== challenge) {
    throw new Error(
      `Invalid signature: challenge mismatch ${payload.message} !== ${challenge}`,
    );
  }

  outputSuccess("Signature verified successfully");
}

runScript(main);
