var sys = require("sys");
var path = require("path");
var posix = require("posix");
var nntp = require("../lib/node-nntp");
var exconfig = require("./example-config");

var BatchTask = function(path, nzbFile) {
}

var queue = new nntp.Queue();
queue.connect(2, {
    host: exconfig.host,
    port: exconfig.port,
    username: exconfig.username,
    password: exconfig.password
}).addCallback(function() {
    onReady();
}).addErrback(function() {
    sys.puts("failed to connect");
});

function onReady() {
    sys.puts("all connected and ready");
    var nzbFiles = [
        "sample.nzb"
    ];
    for (var n = 0; n < nzbFiles.length; n++) {
        var filePath = nzbFiles[n];
        var fileName = path.basename(filePath, path.extname(filePath));
        sys.puts("queueing " + filePath + " -> " + fileName + "/");
        posix.mkdir(fileName, 0644).addCallback(function() {
            var nzbFile = new nntp.NZBFile();
            nzbFile.loadFile(filePath).addCallback(function() {
                var task = new BatchTask(fileName, nzbFile);
            });
        });
    }
}
