/** @param {NS} ns **/
export async function main(ns) {
	const server = ns.args[0]
	const host = ns.getHostname();

	const minSecurityLevel = ns.getServerMinSecurityLevel(server);
	const maxMoney = ns.getServerMaxMoney(server);

	ns.tprint(`${host}: Hacking server: ${server}`)

	if (!ns.hasRootAccess(server)) {
		ns.print("Getting root access")
		if (ns.getServerNumPortsRequired(server) > 0) {
			ns.brutessh(server);
		}
		ns.nuke(server);
	}

	while(true) {
		let currentSecurityLevel = ns.getServerSecurityLevel(server);
		let currentMoneyAvailible = ns.getServerMoneyAvailable(server);

		if (currentSecurityLevel > minSecurityLevel) {
			let timeToWeaken = ns.getWeakenTime(server);
			ns.tprint(`${host}: Weakening. This will take ${ns.tFormat(timeToWeaken)}`)
			await ns.weaken(server)
		} else if (currentMoneyAvailible < maxMoney) {
			let timeToGrow = ns.tFormat(ns.getGrowTime(server));
			ns.tprint(`${host}: Growing. This will take ${timeToGrow}`);
			await ns.grow(server)
		} else {
			let timeToHack = ns.tFormat(ns.getHackTime(server))
			ns.tprint(`${host}: Hacking. This will take ${timeToHack}`)
			let earnedMoney = await ns.hack(server)
			ns.tprint(`${host}: Stole \$${earnedMoney.toLocaleString()}`)
		}
	}
	
}
