var sys = require("sys");
var nntp = require("../lib/node-nntp")
var exconfig = require("./example-config")

var queue = new nntp.Queue();
queue.connect({
    host: exconfig.host,
    port: exconfig.port,
    username: exconfig.username,
    password: exconfig.password,
    connectionCount: 4
}).addCallback(function() {
    onReady();
}).addErrback(function() {
    sys.puts("failed to connect");
});

function onReady() {
    
}
