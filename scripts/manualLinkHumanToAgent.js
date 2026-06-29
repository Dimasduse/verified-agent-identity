const { createPairing } = require("./linkHumanToAgent");
const { parseArgs, validateArgs, runScript } = require("./shared/utils");

async function main() {
  const args = parseArgs();
  validateArgs(
    args,
    ["challenge"],
    'node manualLinkHumanToAgent.js --challenge \'{"name": "Agent Name", "description": "Short description"}\' [--did <did>]',
  );

  const challenge = JSON.parse(args.challenge);
  const url = await createPairing(challenge, args.did);

  console.log(url);
}

runScript(main);
