var sys = require("sys");
var nntp = require("../lib/node-nntp")
var exconfig = require("./example-config")

var client = new nntp.Client();
client.connect(exconfig.host, exconfig.port).addCallback(function() {
    // if username provided, attempt to authenticate
    if (exconfig.username) {
        client.authenticate(
            exconfig.username, exconfig.password
        ).addCallback(function(responseCode, responseLine) {
            onReady();
        }).addErrback(function() {
            sys.puts("failed to authenticate");
            client.quit().wait();
        });
    } else {
        onReady();
    }
}).addErrback(function() {
    sys.puts("failed to connect");
});

function onReady() {
    sys.puts("connected!");
    // pipeline request of the given articles
    var messageIDs = [
        "<hith8d$go$1@newshub.netvisao.pt>",
        "<06BTm.317446$BL3.253161@en-nntp-08.dc1.easynews.com>",
        "<26BTm.317447$BL3.300217@en-nntp-08.dc1.easynews.com>"
    ];
    var outstanding = messageIDs.length;
    for (var n = 0; n < messageIDs.length; n++) {
        client.getArticle(
            messageIDs[n]
        ).addCallback(function(responseCode, responseLine, headers, message) {
            sys.puts("message received!");
            // TODO: do something meaningful here
            outstanding--;
            if (outstanding == 0) {
                // done
                client.quit().wait();
            }
        });
    }
}
