// hack severs for this much of their money
// the money ratio is increased and decreased automatically, starting with this value initially
let hackMoneyRatio = 0.1;

// time to wait between checking and calculating new attacks (in ms) 
const waitTimeBetweenManagementCycles = 1000;

// time difference between finishing [ hack - grow - weaken ] in burst attacks (in ms)
const timeDiff = 200;

// time between burst attacks. Needs to be bigger than 2 * time diff (in ms)
const timeBetweenAttacks = 500;

// RAM requirement of the slave scripts for weak, grow & hack
const slaveScriptRam = 1.75;

// names of the slave scripts
const weakenScriptName = "weaken.js";
const growScriptName = "grow.js";
const hackScriptName = "hack.js";

// list of slave script files
const files = [weakenScriptName, growScriptName, hackScriptName];

// hard-coded values to save RAM by not using ns functions ...AnalyzeSecurity()
const growThreadSecurityIncrease = 0.004;
const hackThreadSecurityIncrease = 0.002;

/** @param {NS} ns **/
export async function main(ns) {
    // Disable default Logging
    ns.disableLog("ALL");

    // initially set hackMoneyRatio based on progress measured by home server RAM
    let homeRam = ns.getServerMaxRam("home");
    if (homeRam >= 65536) {
        hackMoneyRatio = 0.99;
        ns.tprint("Increase hackMoneyRatio to " + hackMoneyRatio)
    }
    else if (homeRam >= 16384) {
        hackMoneyRatio = 0.9;
        ns.tprint("Increase hackMoneyRatio to " + hackMoneyRatio)
    }
    else if (homeRam > 8192) {
        hackMoneyRatio = 0.5;
        ns.tprint("Increase hackMoneyRatio to " + hackMoneyRatio)
    }
    else if (homeRam > 2048) {
        hackMoneyRatio = 0.2;
        ns.tprint("Increase hackMoneyRatio to " + hackMoneyRatio)
    }
    ns.print("INFO initial hack money ratio: " + hackMoneyRatio);

    while (true) {
        await ns.sleep(1000 * 10);
    }
}
