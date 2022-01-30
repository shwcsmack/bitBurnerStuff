/** @param {NS} ns **/
export async function main(ns) {

	if (ns.args.length >= 2) {
		const sleeptime = ns.args[1];
		await ns.sleep(sleeptime);
	}

	const server = ns.args[0];
	let moneyStolen = 0;

	if (ns.args.length >= 3) {
		moneyStolen += await ns.hack(server, { stock: ns.args[2] });
	}
	else {
		moneyStolen += await ns.hack(server);
	}

	ns.tprint(`${ns.getHostname()} stole ${ns.nFormat(moneyStolen, '$0,0.00')}`)

}
