/** @param {NS} ns **/
export async function main(ns) {
	let purchased_servers = ns.getPurchasedServers();

	purchased_servers.forEach(server => ns.deleteServer(server));

}
