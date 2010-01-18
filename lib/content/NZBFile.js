var sys = require("sys");
var xml = require("../ext/node-xml/lib/node-xml");

var NZBFile = function() {
    this.files = [];
}

NZBFile.prototype.loadFile = function(filePath) {
    var self = this;
    var promise = new process.Promise();

    self.sourceFile = filePath;

    var parser = new xml.SaxParser(function(cb) {
        var currentFile = null;
        var currentSegment = null;
        var charBuffer = null;
        cb.onStartDocument(function() {
        });
        cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces) {
            charBuffer = null;
            switch (elem) {
                case "file":
                    currentFile = {
                        groups: [],
                        segments: [],
                        totalSize: 0,
                        totalSegments: 0,
                        missingSegments: false
                    };
                    for (var n = 0; n < attrs.length; n++) {
                        var attr = attrs[n];
                        switch (attr[0]) {
                            case "subject":
                                currentFile.subject = attr[1];
                                break;
                            case "poster":
                                currentFile.poster = attr[1];
                                break;
                            case "date":
                                currentFile.date = new Date();
                                currentFile.date.setTime(parseInt(attr[1], 10) * 1000);
                                break;
                        }
                    }
                    break;
                case "group":
                    charBuffer = "";
                    break;
                case "segment":
                    currentSegment = {};
                    for (var n = 0; n < attrs.length; n++) {
                        var attr = attrs[n];
                        switch (attr[0]) {
                            case "bytes":
                                currentSegment.bytes = parseInt(attr[1], 10);
                                break;
                            case "number":
                                currentSegment.number = parseInt(attr[1], 10);
                                break;
                        }
                    }
                    currentFile.totalSize += currentSegment.bytes;
                    currentFile.segments[currentSegment.number - 1] = currentSegment;
                    charBuffer = "";
                    break;
            }
        });
        cb.onEndElementNS(function(elem, prefix, uri) {
            switch (elem) {
                case "file":
                    // check subject end (1/N) to get total segment count, check file.segments.length to see if missing some
                    currentFile.totalSegments = parseInt(currentFile.subject.match(/\(1\/(\d+)\)/e)[1], 10);
                    currentFile.missingSegments = (currentFile.segments.length < currentFile.totalSegments);
                    self.files.push(currentFile);
                    currentFile = null;
                    break;
                case "group":
                    currentFile.groups.push(charBuffer); // TODO: trim
                    break;
                case "segment":
                    currentSegment.messageID = "<" + charBuffer + ">"; // TODO: trim
                    currentSegment = null;
                    break;
            }
            charBuffer = null;
        });
        cb.onCharacters(function(chars) {
            if (charBuffer != null) {
                charBuffer += chars;
            }
        });
        cb.onEndDocument(function() {
            promise.emitSuccess();
        });
        cb.onError(function(msg) {
            sys.puts('<ERROR>' + JSON.stringify(msg) + "</ERROR>");
            promise.emitError();
        });
    });

    parser.parseFile(filePath);

    return promise;
}

exports.NZBFile = NZBFile;
