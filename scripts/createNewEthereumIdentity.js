const { KmsKeyType, hexToBytes } = require("@0xpolygonid/js-sdk");
const { DidMethod, Blockchain, NetworkId } = require("@iden3/js-iden3-core");
const { SigningKey, Wallet, JsonRpcProvider } = require("ethers");
const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  outputSuccess,
  addHexPrefix,
  runScript,
} = require("./shared/utils");

async function main() {
  const args = parseArgs();
  const {
    kms,
    identityWallet,
    didsStorage,
    billionsMainnetConfig,
    revocationOpts,
  } = await getInitializedRuntime();

  // Use provided key or generate a new one
  let privateKeyHex = args.key;
  if (!privateKeyHex) {
    privateKeyHex = new SigningKey(Wallet.createRandom().privateKey).privateKey;
  }

  const signer = new SigningKey(addHexPrefix(privateKeyHex));

  const keyProvider = kms.getKeyProvider(KmsKeyType.Secp256k1);
  if (!keyProvider) {
    throw new Error("Secp256k1 key provider not found");
  }

  const wallet = new Wallet(
    signer,
    new JsonRpcProvider(billionsMainnetConfig.url),
  );

  let did;
  try {
    const result = await identityWallet.createEthereumBasedIdentity({
      method: DidMethod.Iden3,
      blockchain: Blockchain.Billions,
      networkId: NetworkId.Main,
      seed: hexToBytes(privateKeyHex),
      revocationOpts: revocationOpts,
      ethSigner: wallet,
      createBjjCredential: false,
    });
    did = result.did;
  } catch (err) {
    throw new Error(
      `Failed to create Ethereum-based identity: ${err.message}`,
    );
  }

  await didsStorage.save({
    did: did.string(),
    publicKeyHex: signer.publicKey,
    isDefault: true,
  });

  outputSuccess(did.string());
}

runScript(main);
