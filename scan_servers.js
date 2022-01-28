/** @param {NS} ns **/
export async function main(ns) {
	let depth = arguments[0];

	let servers = ns.scan();

	servers.forEach(server => ns.tprint(`${server}: \$${ns.getServerMaxMoney(server).toLocaleString()}`))
}
