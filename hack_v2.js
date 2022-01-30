// hack severs for this much of their money
// the money ratio is increased and decreased automatically, starting with this value initially
let hackMoneyRatio = 0.1;

// time to wait between checking and calculating new attacks (in ms) 
const waitTimeBetweenManagementCycles = 1000;

// time difference between finishing [ hack - grow - weaken ] in burst attacks (in ms)
const timeBetweenHGW = 200;

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
    hackMoneyRatio = setInitialHackMoneyRatio(ns, homeRam);
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
        let target = targets[0];
        ns.print(`First target is: ${target}`);

        // let debugHackThreads = Math.floor(ns.hackAnalyzeThreads(target, targetMoney * hackMoneyRatio))
        // ns.print(`Threads needed to hack ${target} ${hackMoneyRatio *100}%: ${debugHackThreads}`);
        let {hackThreads, growThreads, weakThreads} = getAttackThreadCounts(ns, target, hackMoneyRatio);

        let overallRamNeed = ((weakThreads + growThreads + hackThreads) * slaveScriptRam);
        ns.print(`Ram Needed: ${overallRamNeed} System Free Ram: ${ramData.totalFreeRam}`);
        
        let weakTime = 0;
        let growTime = 0;
        let hackTime = 0;
        let parallelAttacks = 1;

        if (overallRamNeed > ramData.totalFreeRam) {
            //todo: need to setup a partial attack
        } else if (hackThreads == 0) {
            //todo: need to grow and weaken
        } else {
            weakTime = ns.getWeakenTime(target);
            growTime = ns.getGrowTime(target);
            hackTime = ns.getHackTime(target);           
            ns.print(`Weaken Time:${ns.tFormat(weakTime)} Grow Time:${ns.tFormat(growTime)} Hack Time:${ns.tFormat(hackTime)}`);
            
            var maxAttacksDuringHack = Math.floor((weakTime - timeBetweenAttacks) / timeBetweenAttacks);
            ns.print(`maxAttacks: ${maxAttacksDuringHack}`);

            for (parallelAttacks = 1; parallelAttacks < maxAttacksDuringHack; parallelAttacks++) {
                // check if we have enough RAM for one more attack
                const nextAmountOfParallelAttacks = parallelAttacks + 1;
                const nextWeakThreads = weakThreads * nextAmountOfParallelAttacks;
                const nextGrowThreads = growThreads * nextAmountOfParallelAttacks;
                const nextHackThreads = hackThreads * nextAmountOfParallelAttacks;
                const nextTotalThreads = nextWeakThreads + nextGrowThreads + nextHackThreads;
                const nextRamNeeded = nextTotalThreads * slaveScriptRam;
                const nextRamMoreThanCurrentFreeRam = nextRamNeeded >= ramData.totalFreeRam;

                const nextParallelAttacksMoreThanMax = parallelAttacks >= maxAttacksDuringHack;

                const ratioOfOverallFreeRam = ramData.overallFreeRam / ramData.totalMaxRam;
                const lessThan10PercentFreeRam = ratioOfOverallFreeRam < 0.1;
                const lowOverallMaxRam = ramData.overallMaxRam < 512;
                const lowOnRam = lessThan10PercentFreeRam && lowOverallMaxRam;

                // ns.print(`parallelAttacks: ${parallelAttacks} nextRamNeeded: ${nextRamNeeded} freeRam: ${ramData.totalFreeRam} maxRam: ${ramData.totalMaxRam}`)
                if (nextRamMoreThanCurrentFreeRam || nextParallelAttacksMoreThanMax || lowOnRam) {
                    // we do not have enough RAM for more attacks
                    parallelAttacks -= 1;
                    break;
                }
            }
            ns.print(`INFO: ${parallelAttacks} attacks aimed at ${target} HGW[${hackThreads}|${growThreads}|${weakThreads}]`);
        }

        // re-calculate overall RAM need after scaling full attacs down or up
        overallRamNeed = ((weakThreads + growThreads + hackThreads) * slaveScriptRam) * parallelAttacks;
        if (overallRamNeed > ramData.overallFreeRam) {
            // Typically, there should be enough RAM for the planned attack. Warn if not.
            ns.print("WARN RAM calculation issue for target: " + target + " need / free: " + overallRamNeed + " / " + ramData.overallFreeRam);
        }
        ramData.overallFreeRam -= overallRamNeed;

        
        let attackTimes = {hackTime, growTime, weakTime};
        let attackThreads = {hackThreads, growThreads, weakThreads}
        executeParallelBatchAttack(ns, target, parallelAttacks, attackTimes, attackThreads, ramData.serverRamData);

        await ns.sleep(waitTimeBetweenManagementCycles * 10);
    }
}

function coordinateAttack(ns, servers, ramData, targets) {

}

function executeParallelBatchAttack(ns, target, parallelAttacks, attackTimes, attackThreads, serverRamData) {
    let {weakSleep, growSleep, hackSleep, parallelAttackOveride} = getAttackSleepTimes(ns, attackTimes);
    let {weakThreads, growThreads, hackThreads} = attackThreads;
    // ns.print(`wthreads:${weakThreads} gthreads:${growThreads} hthreads: ${hackThreads}`)

    //there was a syncro issue
    if (parallelAttackOveride) {
        parallelAttacks = 1;
    }

    for (let i = 0; i < parallelAttacks; i++) {
        if (weakThreads > 0) {
            tryToRunAttack(ns, weakenScriptName, weakThreads, serverRamData, target, weakSleep);
        }
        if (growThreads > 0) {
            tryToRunAttack(ns, growScriptName, growThreads, serverRamData, target, growSleep);
        }
        if (hackThreads > 0) {
            tryToRunAttack(ns, hackScriptName, hackThreads, serverRamData, target, hackSleep);
        }

        weakSleep += timeBetweenAttacks;
        growSleep += timeBetweenAttacks;
        hackSleep += timeBetweenAttacks;
    }
}

function getAttackThreadCounts(ns, target, hackMoneyRatio) {
    let weakThreads = 0;
    let growThreads = 0;
    let hackThreads = 0;

    let addedGrowSecurity = 0;
    let addedHackSecurity = 0;
    
    let targetMaxMoney = ns.getServerMaxMoney(target);
    let targetMoney = ns.getServerMoneyAvailable(target);
    let targetMinSecurity = ns.getServerMinSecurityLevel(target);
    let targetSecurity = ns.getServerSecurityLevel(target);
    let targetSecDifference = targetSecurity - targetMinSecurity;

    //protect from a divide by zero error
    if (targetMoney < 1) {
        targetMoney = 1;
    }
    
    //hack if close to min security
    if (targetSecDifference < 0.5) {
        let targetMoneyRatio = targetMaxMoney / targetMoney;
        let hackReGrowRatio = 1;
        let overallGrowRatio = 1;
        
        //but only if we have enough availible money, oherwise just grow and weaken
        if (targetMoneyRatio <= 1.1) {
            hackThreads = Math.floor(ns.hackAnalyzeThreads(target, targetMoney * hackMoneyRatio))
            hackReGrowRatio = 1 / (1 - hackMoneyRatio);
            addedHackSecurity = hackThreads * hackThreadSecurityIncrease;
        }

        // grow what was missing before and what we expect to hack
        // multiply the initial grow ratio by the expected new grow ratio needed after hack
        overallGrowRatio = targetMoneyRatio * hackReGrowRatio;

        // Considering 0 cores on all serers. 
        // The last parameter 0 can be removed if optimizing for running slave threads on home server with > 0 cores only
        // else, grow threads onother servers than home will not grow sufficiently and break perfect attack chains
        growThreads = Math.ceil((ns.growthAnalyze(target, overallGrowRatio, 0)));

        addedGrowSecurity = growThreads * growThreadSecurityIncrease;  
    }
    weakThreads = Math.ceil((targetSecDifference + addedGrowSecurity + addedHackSecurity) * 20);
    ns.print(`Threads; Hack:${hackThreads} Grow:${growThreads} Weaken:${weakThreads}`);

    return {hackThreads, growThreads, weakThreads};
}

function getAttackSleepTimes(ns, attackTimes) {
    let weakSleep = 0;
    let growSleep = 0;
    let hackSleep = 0;
    let parallelAttackOveride = false;
    
    // grow should finish timediff ms before weaken finishes
    growSleep = (attackTimes.weakTime - attackTimes.growTime) - timeBetweenHGW;
    if (growSleep < 0) {
        // make sure that we do not get negative sleep value in case of crazy low execution times
        // in this case, tweak time between attacks and time diff
        ns.print("WARN: time synchronisation issue for parallel attacks");
        growSleep = 0;
        parallelAttackOveride = true;
    }
    hackSleep = (attackTimes.weakTime - attackTimes.hackTime) - 2 * timeBetweenHGW;
    if (hackSleep < 0) {
        // make sure that we do not get negative sleep value in case of crazy low execution times
        // in this case, tweak time between attacks and time diff
        hackSleep = 0;
        growSleep = 0;
        parallelAttackOveride = true;
        ns.print("WARN time synchronisation issue for parallel attacks");
    }
    // ns.print(`weakSleep:${ns.tFormat(weakSleep)} growSleep:${ns.tFormat(growSleep)} hackSleep:${ns.tFormat(hackSleep)}`);

    return {weakSleep, growSleep, hackSleep, parallelAttackOveride};
}

function tryToRunAttack(ns, script, threads, serversRamData, target, sleepTime) {
    while (serversRamData.length) {
        let host = serversRamData[0].host;
        let ram = serversRamData[0].freeRam;
        

        //not enough ram to run script, skip
        if (ram < slaveScriptRam) {
            serversRamData.shift();
        }
        //server can run some threads needed
        else if (ram < slaveScriptRam * threads) {
            const threadForThisHost = Math.floor(ram / slaveScriptRam);
            // ns.print(`TRACE: ${host} can run ${threadForThisHost} threads out of ${threads}`);
            ns.exec(script, host, threadForThisHost, target, sleepTime);
            threads -= threadForThisHost;
            serversRamData.shift();
        }
        //server can run whole task
        else {
            // ns.print(`TRACE: ${host} running ${script} on ${target} with ${threads} threads after ${ns.tFormat(sleepTime)}`);
            ns.exec(script, host, threads, target, sleepTime);
            serversRamData[0].freeRam -= slaveScriptRam * threads;
            return true;
        }
    }

    // we did not find enough RAM to run all remaining threads. Something went from in the RAM calculation
    ns.print("WARN missing " + slaveScriptRam * threads + " for " + script + " RAM for target " + target);
    return false;
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

function setInitialHackMoneyRatio(ns, homeRam) {
    let ratio = hackMoneyRatio
    if (homeRam >= 65536) {
        ratio = 0.99;
        ns.print("Increase hackMoneyRatio to " + ratio)
    }
    else if (homeRam >= 16384) {
        ratio = 0.9;
        ns.print("Increase hackMoneyRatio to " + ratio)
    }
    else if (homeRam > 8192) {
        ratio = 0.5;
        ns.print("Increase hackMoneyRatio to " + ratio)
    }
    else if (homeRam > 2048) {
        ratio = 0.2;
        ns.print("Increase hackMoneyRatio to " + ratio)
    }

    return ratio;
}
