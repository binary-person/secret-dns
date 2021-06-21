# secret-dns

> Undiscoverable publicly accessible "password-protected" DNS

## Brief

This package is for people who
- want to access their DNS server using a public IP without using a VPN or wireguard
- do not want their DNS server to be used in DNS amplification attacks
- do not want their DNS server to be discovered by some script kiddie running a DNS scanner
- do not want to manually add IPs to a whitelist
- do not want the hassle of creating a whitelist/blacklist system
- want a package that does all the above that is plug-and-play

The client is required to query a secret "password" domain to the DNS server to be whitelisted and be able to use the actual DNS server on port 53.
If the client is not whitelisted, the DNS query request to port 53 will be redirected port 5334.
The client is required to query a secret DNS domain in order to access the real DNS server. If this password is incorrect, (lets say the client queries google.com), the node DNS server does not respond back, giving the client the impression there is no DNS server.
If the client queries the correct secret DNS domain, (lets say the secret password domain is verysecretdomain.com and the client queries verysecretdomain.com), the node DNS server will add the client IP to the iptables chain whitelist, enabling the client to communicate with the actual DNS server.

## Install

```bash
# Install node and git if you don't have it already
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs git

# clone this repository and install dependencies
git clone https://github.com/binary-person/secret-dns
cd secret-dns
npm install
```

## Usage

```bash
sudo node src/index.js very_secret_nonexistent_domain_here.com

# return 1.1.1.1 upon querying the password domain
sudo node src/index.js very_secret_nonexistent_domain_here.com 1.1.1.1

# clear all iptables chains and rules created by secret-dns
sudo node src/index.js cleanup
```

## Running it on startup

```bash
sudo su

# Get pm2 if you don't have it already
npm install -g pm2

# enable pm2 startup if you haven't done so already
pm2 startup

# run secret-dns under pm2
pm2 start --name 'secret-dns' 'node src/index.js very_secret_nonexistent_domain_here.com 1.1.1.1'

# save pm2 configuration
pm2 save
```

## Useful iptables commands

```bash
sudo su

# Viewing the whitelist (The last two entries are responsible for redirecting any leftover un-whitelisted IP addresses to port 5334)
iptables -t nat -nL secret-dns-chain

# Adding an IP to the whitelist
iptables -t nat -I secret-dns-chain 1 -p udp --dport 53 -s your.ip.address.here -j ACCEPT
iptables -t nat -I secret-dns-chain 1 -p tcp --dport 53 -s your.ip.address.here -j ACCEPT

# Removing an IP from the whitelist
iptables -t nat -D secret-dns-chain -p udp --dport 53 -s your.ip.address.here -j ACCEPT
iptables -t nat -D secret-dns-chain -p tcp --dport 53 -s your.ip.address.here -j ACCEPT
```

## How it works

(Note that since the node server only runs a UDP DNS server, all TCP DNS requests will result in being closed)

![diagram of how secret-dns works](diagram.png)
