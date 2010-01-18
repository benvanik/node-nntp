var sys = require("sys");
var path = require("path");
var posix = require("posix");
var file = require("file");
var nntp = require("../lib/node-nntp")

var filePath = "sample.nzb";
var fileName = path.basename(filePath, path.extname(filePath));

sys.puts("NZB: " + filePath + " -> " + fileName);

var nzb = new nntp.NZBFile(fileName);
nzb.loadFile(filePath).addCallback(function() {
    sys.puts(sys.inspect(nzb));
});
