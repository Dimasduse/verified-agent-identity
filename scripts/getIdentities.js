const { getInitializedRuntime } = require("./shared/bootstrap");
const { outputSuccess, runScript } = require("./shared/utils");

async function main() {
  const { didsStorage } = await getInitializedRuntime();

  const identities = await didsStorage.list();

  if (identities.length === 0) {
    throw new Error(
      "No identities found. Create one with createNewEthereumIdentity.js",
    );
  }

  outputSuccess(identities);
}

runScript(main);
