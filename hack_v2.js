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
        //find and root all the servers we can access
        let servers = await scanAndRoot(ns);
        await copyFiles(ns, servers);

        // //figure out how much collective ram we have
        let ramData = getRamData(ns, servers);
        // ns.print(`freeRams:${JSON.stringify(ramData)}`);
        
        //find and rank targets
        let targets = getAndSortTargets(ns, servers);
        ns.print(targets);

        //coordinate attacks

        await ns.sleep(waitTimeBetweenManagementCycles * 10);
    }
}

/** Scan all known servers and attempt to gain root access */
async function scanAndRoot(ns) {
    let servers = ["home"];
    scanAll(ns, "home", servers);

    let rootedServers = [];

    for(let i = 0; i<servers.length; i++) {
        let server = servers[i]
        if(await ns.hasRootAccess(server)) {
            rootedServers.push(server)
        } else {
            var portOpened = 0;
            if (await ns.fileExists("BruteSSH.exe")) {
                await ns.brutessh(server);
                portOpened++;
            }
            if (await ns.fileExists("FTPCrack.exe")) {
                await ns.ftpcrack(server);
                portOpened++;
            }
            if (await ns.fileExists("HTTPWorm.exe")) {
                await ns.httpworm(server);
                portOpened++;
            }
            if (await ns.fileExists("relaySMTP.exe")) {
                await ns.relaysmtp(server);
                portOpened++;
            }
            if (await ns.fileExists("SQLInject.exe")) {
                await ns.sqlinject(server);
                portOpened++;
            }
            if (await ns.getServerNumPortsRequired(server) <= portOpened) {
                await ns.nuke(server);
                rootedServers.push(server);
            }
        }
    }


    return rootedServers;
}

/** Recursivly scan all servers and save to the servers parameter
 * @param {NS} ns Handle to netscript.
 * @param {string} host Hostname to scan from.
 * @param {Array} servers Array of servers known, modified during execution.
 */
function scanAll(ns, host, servers) {
    let hosts = ns.scan(host);
    for(let i = 0; i < hosts.length; i++) {
        if(!servers.includes(hosts[i])) {
            // ns.print(`Found server: ${hosts[i]}`);
            servers.push(hosts[i]);
            scanAll(ns, hosts[i], servers);
        }
    }
}

async function copyFiles(ns, servers) {
    for(let i=0; i<servers.length; i++) {
        // ns.print(`Copying files to ${servers[i]}`);
        await ns.scp(files, "home", servers[i]);
    }
}

function getRamData(ns, servers) {
    let totalMaxRam = 0;
    let totalFreeRam = 0;
    let serverRamData = [];

    for(let i=0; i<servers.length; i++) {
        let server = servers[i];
        const maxRam = ns.getServerMaxRam(server);
        const usedRam = ns.getServerUsedRam(server);
        let freeRam = maxRam - usedRam;
        // round down to full hack slots
        freeRam = Math.floor(freeRam / slaveScriptRam) * slaveScriptRam

        totalMaxRam += maxRam;

        if (freeRam >= slaveScriptRam) {
            serverRamData.push({ host: server, freeRam: freeRam });
            totalFreeRam += freeRam;
        }

    }
    serverRamData.sort((a, b) => b.freeRam - a.freeRam);
    return {totalMaxRam, totalFreeRam, serverRamData};
}

function getAndSortTargets(ns, servers) {
    return servers.filter(server => ns.getServerMaxMoney(server) > 100000
                                    && ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel()
                                    && ns.getServerGrowth(server) > 1)
                            .sort((a, b) => 5 * ns.getServerMinSecurityLevel(a) - 5 * ns.getServerMinSecurityLevel(b)
                            + ns.getServerGrowth(b) - ns.getServerGrowth(a));
}
