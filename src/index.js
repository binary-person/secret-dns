const dns2 = require('dns2');
const Iptables = require('./Iptables');

if (!(process.getuid && process.getuid() === 0)) {
    console.error('Must be run as root for iptables configuration.');
    process.exit(1);
}

const port = 5334;
const secretDomainName = process.argv[2];
const ipToReturn = process.argv[3]; // optional param

if (!secretDomainName) {
    console.error('Usage: sudo node src/index.js very_secret_nonexistent_domain_here.com (ip.to.return.here)\n\nRun "node src/index.js cleanup" to cleanup changes to iptables made by secret-dns');
    process.exit(1);
}
if (secretDomainName === 'cleanup') {
    const iptables = new Iptables(port, true);
    if (iptables.cleanup()) {
        console.log('Cleanup successful');
        process.exit(0);
    }
    else {
        console.log('Did not cleanup anything. Does the chain made by secret-dns exist?');
        process.exit(1);
    }
}

const server = dns2.createUDPServer();
const iptables = new Iptables(port);

server.on('request', (req, res, rinfo) => {
    if (!req.questions || req.questions.length > 100) return;
    for (const question of req.questions) {
        if (question.name === secretDomainName) {
            if (rinfo.family === 'IPv4') { // ipv6 unsupported at the moment
                const response = dns2.Packet.createResponseFromRequest(req);
                response.answers.push({
                    secretDomainName,
                    type: dns2.Packet.TYPE.A,
                    class: dns2.Packet.CLASS.IN,
                    ttl: 10,
                    address: ipToReturn || ''
                });
                res(response);
                iptables.whitelist(rinfo.address);
                console.log('Whitelisted ' + rinfo.address);
            }
            return;
        }
    }
    // if we ghost the client running the dns query, they will never even know there was a dns server running here >:)
});

server.listen(port).then(() => console.log('Secret DNS server is up'));
