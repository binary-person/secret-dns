const execSync = require('child_process').execSync;

const chainName = 'secret-dns-chain';

module.exports = class Iptables {
    constructor(port, noSetup = false) {
        this.port = port;
        this.checkIptables();
        if (!noSetup && !this.chainExists()) {
            this.setupChain();
        }
    }

    chainExists() {
        try {
            execSync('iptables -t nat -nL ' + chainName);
            return true;
        }
        catch (e) {
            const stderr = e.stderr.toString('utf8');
            if (!stderr.includes('iptables: No chain/target/match by that name.')) {
                throw new Error('Unexpected error from iptables: ' + stderr);
            }
            return false;
        }
    }
    getWhitelist() {
        return (execSync('iptables -t nat -nL ' + chainName).toString('utf8').match(/(?<=ACCEPT     udp  --  )[^ ]+/g) || []);
    }

    checkIptables() {
        try {
            const version = execSync('iptables --version');
            if(!version.toString('utf8').startsWith('iptables v')) {
                console.error('Unexpected output for running iptables --version. Received ' + version);
                process.exit(1);
            }
        }
        catch (e) {
            console.error('There is an issue with getting the iptables version. Please check your system to see if iptables is installed.');
            process.exit(1);
        }
    }
    setupChain() {
        if (!this.chainExists()) {
            execSync('iptables -t nat -N ' + chainName); // create new chain
            execSync(`iptables -t nat -A ${chainName} -p udp --dport 53 -j REDIRECT --to-port ${this.port}`); // redirect all udp dns queries to the node dns server
            execSync(`iptables -t nat -A ${chainName} -p tcp --dport 53 -j REDIRECT --to-port ${this.port}`); // redirect all tcp connections to a closed port (this port, which isn't running a tcp dns server)
            execSync('iptables -t nat -I PREROUTING 1 -j ' + chainName); // add chain to the top of the PREROUTING chain so that it gets processed first
            this.whitelist('127.0.0.1');
        }
    }

    cleanup() {
        if (this.chainExists()) {
            execSync('iptables -t nat -F ' + chainName); // delete all rules in the chain
            execSync('iptables -t nat -D PREROUTING -j ' + chainName); // delete rule enabling the processing of chain in PREROUTING
            execSync('iptables -t nat -X ' + chainName); // delete the chain
            return true;
        }
        return false;
    }
    whitelist(ipv4) {
        execSync(`iptables -t nat -I ${chainName} 1 -p tcp --dport 53 -s ${ipv4} -j ACCEPT`); // accept tcp connections so they don't get rejected later by a closed port
        execSync(`iptables -t nat -I ${chainName} 1 -p udp --dport 53 -s ${ipv4} -j ACCEPT`); // accept udp connections so they don't get redirect to the node dns server
    }
    removeWhitelist(ipv4) { // unused
        execSync(`iptables -t nat -D ${chainName} -p tcp --dport 53 -s ${ipv4} -j ACCEPT`);
        execSync(`iptables -t nat -D ${chainName} -p udp --dport 53 -s ${ipv4} -j ACCEPT`);
    }
};
