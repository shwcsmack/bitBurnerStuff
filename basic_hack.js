/** @param {NS} ns **/
export async function main(ns) {
	const server = ns.args[0]

	const minSecurityLevel = ns.getServerMinSecurityLevel(server);
	let currentSecurityLevel = ns.getServerSecurityLevel(server);
	const maxMoney = ns.getServerMaxMoney(server);
	let currentMoneyAvailible = ns.getServerMoneyAvailable(server);

	ns.tprint(`Hacking server: ${server}`)

	if (!ns.hasRootAccess(server)) {
		ns.tprint("Getting root access")
		if (ns.getServerNumPortsRequired(server) > 0) {
			ns.brutessh(server);
		}
		ns.nuke(server);
	}

	while(true) {
		if (currentSecurityLevel > minSecurityLevel) {
			ns.tprint(`Current Security Level: ${currentSecurityLevel}, Min: ${minSecurityLevel}`)
			let timeToWeaken = ns.getWeakenTime(server);
			ns.tprint(`Weakening. This will take ${ns.tFormat(timeToWeaken)}`)
			await ns.weaken(server)
		} else if (currentMoneyAvailible < maxMoney) {
			ns.tprint(`Current Money Availible: ${currentMoneyAvailible}, Max: ${maxMoney}`)
			let timeToGrow = ns.tFormat(ns.getGrowTime(server));
			ns.tprint("Growing. This will take " + timeToGrow);
			await ns.grow(server)
		} else {
			let timeToHack = ns.tFormat(ns.timeToHack(server))
			ns.tprint("Hacking. This will take " + timeToHack)
			let earnedMoney = await ns.hack(server)
			ns.tprint(`Stole \$${earnedMoney.toLocaleString()}`)
		}
	}
	
}
