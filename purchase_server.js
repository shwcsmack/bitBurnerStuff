/** @param {NS} ns **/
export async function main(ns) {
	// Disable default Logging
	ns.disableLog("ALL");

	const money_buffer = 0.5;
	const prefix = "pserv-";
	const script = ns.args[0];
	const target = ns.args[1];
	const minRam = 8;
	const ramLimit = ns.getPurchasedServerMaxRam();
	let notAllServersMaxed = true;

	let maxPurchaseableRam = ns.getServerMaxRam("home") / 2;  // set half home ram to start
	if (maxPurchaseableRam > ramLimit) {
		maxPurchaseableRam = ramLimit;
	}

	ns.print("Initial RAM tier: " + maxPurchaseableRam + " GB");

	while (notAllServersMaxed) {
		let ownedServers = ns.getPurchasedServers();
		ownedServers.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));
		// ns.print(`Purchased servers: ${ownedServers}`);

		if (ownedServers.length > 0) {
			// never buy for less than we already have
			maxPurchaseableRam = Math.max(maxPurchaseableRam, ns.getServerMaxRam(ownedServers[0]));
		}

		let homeMoney = ns.getServerMoneyAvailable("home");
		let budget = homeMoney * money_buffer;

		// see if we can afford a higher RAM tier than we already have
		while (maxPurchaseableRam < ramLimit) {
			// check for quadruple RAM for not too big jumps and buffer for another potential double RAM afterwards below
			var nextRamTier = maxPurchaseableRam * 4;
			var nextRamTierCost = ns.getPurchasedServerCost(nextRamTier);
			if (budget > nextRamTierCost) {
				// double RAM
				maxPurchaseableRam *= 2;
			}
			else {	// we found the max affordable ram tier
				break;
			}
		}
		let ramUpgradeCost = ns.getPurchasedServerCost(maxPurchaseableRam);
		ns.print(`maxPurchaseableRam:${maxPurchaseableRam}GB ramUpgradeCost:${ns.nFormat(ramUpgradeCost, '($0.00a)')} budget: ${ns.nFormat(budget, '($0.00a)')}`);

		
		const purchasedServerLimit = ns.getPurchasedServerLimit();
		const underServerLimit = ownedServers.length < purchasedServerLimit;
		const atServerLimit = ownedServers.length == purchasedServerLimit;
		const underBudget = ns.getPurchasedServerCost(maxPurchaseableRam) < budget;

		//fill up with servers first before we upgrade what we have
		if (underServerLimit && underBudget) {
			let hostname = prefix + "" + (ownedServers.length + 1);
			let threads = Math.floor(minRam / ns.getScriptRam(script));
			
			const newServer = ns.purchaseServer(hostname, maxPurchaseableRam);
			ns.print(`Purchased server ${newServer} with ${maxPurchaseableRam} RAM for ${ns.nFormat(ramUpgradeCost, '($ 0.00 a)')}`);

			await ns.scp(script, newServer);
			ns.exec(script, newServer, threads, target);
		} 
		//Upgrade exisitng servers
		else if (atServerLimit && underBudget) {
			//servers should be sorted so pop the low one off the end
			let serverToUpgrade = ownedServers.pop();
			let serverToUpgradeRAM = ns.getServerMaxRam(serverToUpgrade);

			//check if were at the max ram limit
			if (serverToUpgradeRAM >= ramLimit) {
				notAllServersMaxed = false;
				ns.print("All servers at max upgrade");
				ns.tprint("All servers at max upgrade");
				return;
			} 
			//If the bottom server is already at the max we can purchase theres nothing to do
			else if (serverToUpgradeRAM >= maxPurchaseableRam) {
				break;
			}
			else {
				ns.print(`Upgrading ${serverToUpgrade}'s RAM from ${serverToUpgradeRAM} to ${maxPurchaseableRam} for ${ns.nFormat(ramUpgradeCost, '($0.00a)')}`);
				ns.killall(serverToUpgrade);
				ns.deleteServer(serverToUpgrade);
				ns.purchaseServer(serverToUpgrade, maxPurchaseableRam);

				let threads = Math.floor(maxPurchaseableRam / ns.getScriptRam(script));
				await ns.scp(script, serverToUpgrade);
				ns.exec(script, serverToUpgrade, threads, target);
			}
		}


		await ns.sleep(1000 * 5);
	}
}
