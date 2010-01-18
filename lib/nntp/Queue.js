var sys = require("sys");
var tcp = require("tcp");
require("../utils");
var Client = require("./client").Client;

var Queue = function() {
}

Queue.prototype.connect = function(count, connSettings) {
    var self = this;
    var promise = new process.Promise();
    self.clients = [];
    var pendingClients = [];
    var anyFailed = false;

    function onStateChange() {
        if (pendingClients.length == 0) {
            if (anyFailed == true) {
                // failure - quit open connections and fail the promise
                for (var n = 0; n < self.clients.length; n++) {
                    var client = self.clients[n];
                    client.quit();
                }
                self.clients = [];
                promise.emitError();
            } else {
                // success - all clients connected
                promise.emitSuccess();
            }
        }
    }
    function onConnected(client) {
        self.clients.push(client);
        pendingClients.removeValue(client);
        onStateChange();
    }
    function onFailed(client) {
        client.quit();
        pendingClients.removeValue(client);
        anyFailed = true;
        onStateChange();
    }

    for (var n = 0; n < count; n++) {
        (function() {
            var client = new Client();
            client.debugName = n.toString();
            pendingClients.push(client);
            client.connect(connSettings.host, connSettings.port, connSettings.username, connSettings.password).addCallback(function() {
                onConnected(client);
            }).addErrback(function() {
                sys.puts("failed to connect");
                onFailed(client);
            });
        })();
    }

    return promise;
}

exports.Queue = Queue;
