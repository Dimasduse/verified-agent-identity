const { randomInt } = require("crypto");
const { getInitializedRuntime } = require("./shared/bootstrap");
const {
  parseArgs,
  outputSuccess,
  validateArgs,
  runScript,
} = require("./shared/utils");

async function main() {
  const args = parseArgs();
  validateArgs(args, ["did"], "node scripts/generateChallenge.js --did <did>");

  const { challengeStorage } = await getInitializedRuntime();

  const challenge = randomInt(0, 10000000000).toString();
  await challengeStorage.save(args.did, challenge);

  outputSuccess(challenge);
}

runScript(main);
