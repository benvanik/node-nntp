var sys = require("sys");
var tcp = require("tcp");

var Client = function() {
    var self = this;

    this.socket = null;
    this.timeout = 2 * 60 * 1000;
    this.readBuffer = "";
    this.newline = new RegExp("\r\n");

    this.state = "disconnected";

    this.pendingCommands = [];

    this.pendingReadBlock = null;
}

Client.prototype.connect = function(host, port) {
    var self = this;
    var promise = new process.Promise();

    self.host = host;
    self.port = port || 119;

    self.socket = new tcp.createConnection(self.port, self.host);
    self.socket.setEncoding("ascii");

    var hasConnected = false;

    self.socket.addListener("connect", function() {
        // Server sends a line immediately on connect, so queue up a dummy command to watch for it
        // S> 200 hello!
        // C> MODE READER
        // S> 200 reading enabled
        hasConnected = true;
        var c1 = self._sendCommand(undefined);
        c1.addCallback(function(responseCode, responseLine) {
            switch (responseCode) {
                case 200:
                    var c2 = self._sendCommand("MODE READER");
                    c2.addCallback(function(responseCode, responseLine) {
                        switch (responseCode) {
                            case 200: // Posting allowed
                            case 201: // Posting prohibited
                                self.state = "connected";
                                promise.emitSuccess();
                                break;
                            default:
                                // TODO: error code/text
                                promise.emitError(responseCode, responseLine);
                                break;
                        }
                    });
                    c2.addErrback(function() { promise.emitError(); });
                    break;
                default:
                    // TODO: error code/text
                    promise.emitError(responseCode, responseLine);
                    break;
            }
        });
        c1.addErrback(function() { promise.emitError(); });
    });
    self.socket.addListener("receive", function() {
        self._socketReceive.apply(self, arguments);
    });
    self.socket.addListener("eof", function() {
        self.state = "disconnected";
        if (self.socket) {
            self.socket.close();
            self.socket = null;
        }
    });
    self.socket.addListener("timeout", function() {
        self.state = "disconnected";
        self._socketDisconnect.apply(self, arguments);
    });
    self.socket.addListener("close", function() {
        if (hasConnected) {
            self._socketDisconnect.apply(self, arguments);
        } else {
            promise.emitError();
        }
    });

    return promise;
}

Client.prototype.readLine = function() {
    var firstNewline = this.readBuffer.indexOf("\r\n");
    if (firstNewline >= 0) {
        var line = this.readBuffer.substr(0, firstNewline);
        this.readBuffer = this.readBuffer.substr(firstNewline + 2);
        return line;
    } else {
        return null;
    }
}

Client.prototype.writeLine = function(line) {
    sys.puts("C> " + line);
    // assumes no trailing linefeed passed in
    this.socket.send(line + "\r\n");
}

Client.prototype._parseLine = function(line) {
    // should be of the format 'CODE message'
    var firstSpace = line.indexOf(" ");
    if (firstSpace <= 0) {
        return null;
    }
    var codeSegment = line.substr(0, firstSpace);
    var message = line.substr(firstSpace + 1);
    return {
        code: parseInt(codeSegment, 10),
        message: message
    };
}

Client.prototype._beginReadBlock = function(pattern) {
    var promise = new process.Promise();
    this.pendingReadBlock = {
        pattern: pattern,
        promise: promise
    };
    return promise;
}

Client.prototype._socketReceive = function(data) {
    this.readBuffer += data;
    while (true) {
        // check to see if we have a block read request - must do each loop as the previous command may have requested one
        if (this.pendingReadBlock) {
            var readBlock = this.pendingReadBlock;
            var patternIndex = this.readBuffer.indexOf(readBlock.pattern);
            if (patternIndex >= 0) {
                // pattern found - split out the data we want and reset for normal command parsing
                this.pendingReadBlock = null; // must be cleared here as the promise may set up another block
                var blockData = this.readBuffer.substr(0, patternIndex);
                this.readBuffer = this.readBuffer.substr(patternIndex + readBlock.pattern.length);
                readBlock.promise.emitSuccess(blockData);
            } else {
                // pattern not found, so wait until more data comes in
                break;
            }
        } else {
            var line = this.readLine();
            if (!line) {
                break;
            }

            sys.puts("S> " + line);

            var command = this.pendingCommands.shift();
            if (!command) {
                throw new Error("mismatched response/command");
            }

            var lineData = this._parseLine(line);
            if (!lineData) {
                throw new Error("unrecognized line: " + line);
            }

            command.promise.emitSuccess(lineData.code, lineData.message);
        }
    }
}

Client.prototype._socketDisconnect = function() {
}

Client.prototype._sendCommand = function(line) {
    var promise = new process.Promise();
    this.pendingCommands.push({
        line: line,
        promise: promise
    });
    if (line) {
        this.writeLine(line);
    }
    return promise;
}

Client.prototype.authenticate = function(user, pass) {
    var self = this;
    if (self.state != "connected") {
        throw new Error("Attempting to send command on an unconnected client");
    }
    var promise = new process.Promise();
    var c1 = self._sendCommand("AUTHINFO USER " + user);
    c1.addCallback(function(responseCode, responseLine) {
        switch (responseCode) {
            case 281: // Authentication accepted
                promise.emitSuccess();
                break;
            case 381: // Password required
                var c2 = self._sendCommand("AUTHINFO PASS " + pass);
                c2.addCallback(function(responseCode, responseLine) {
                    switch (responseCode) {
                        case 281: // Authentication accepted
                            promise.emitSuccess();
                            break;
                        default:
                            // TODO: error code/text
                            promise.emitError(responseCode, responseLine);
                            break;
                    }
                });
                c2.addErrback(function() { promise.emitError(); });
                break;
            default:
                // TODO: error code/text
                promise.emitError(responseCode, responseLine);
                break;
        }

    });
    c1.addErrback(function() { promise.emitError(); });
    return promise;
}

Client.prototype.quit = function() {
    var self = this;
    if (self.state != "connected") {
        throw new Error("Attempting to send command on an unconnected client");
    }
    var promise = new process.Promise();
    var c1 = self._sendCommand("QUIT");
    c1.addCallback(function(responseCode, responseLine) {
        if (self.socket) {
            self.state = "disconnected";
            self.socket.close();
            self.socket = null;
        }
        promise.emitSuccess();
    });
    c1.addErrback(function() { promise.emitError(); });
    return promise;
}

Client.prototype._readHeaders = function() {
    var self = this;
    var promise = new process.Promise();
    var c1 = self._beginReadBlock("\r\n\r\n");
    c1.addCallback(function(lines) {
        // split into lines
        // TODO: see if collapsing is required (have yet to see it in the wild)
        var headers = {};
        var headerLines = lines.split(self.newline);
        for (var n = 0; n < headerLines.length; n++) {
            var firstColon = headerLines[n].indexOf(": ");
            var key = headerLines[n].substr(0, firstColon);
            var value = headerLines[n].substr(firstColon + 2);
            // could automate this, but I'm lazy
            switch (key) {
                case "Lines":
                case "Bytes":
                    value = parseInt(value, 10);
                    break;
                case "Newsgroups":
                    value = value.split(",");
                    break;
            }
            headers[key] = value;
        }
        promise.emitSuccess(headers);
    });
    c1.addErrback(function() { promise.emitError(); });
    return promise;
}

Client.prototype._readBody = function() {
    // beginReadBlock success is the body as a single string, so just piggyback that promise
    // note that this will eat the last newline of the body
    return this._beginReadBlock("\r\n.\r\n");
}

Client.prototype.getArticle = function(messageId) {
    var self = this;
    if (self.state != "connected") {
        throw new Error("Attempting to send command on an unconnected client");
    }
    var promise = new process.Promise();
    var c1 = self._sendCommand("ARTICLE " + messageId);
    c1.addCallback(function(responseCode, responseLine) {
        switch (responseCode) {
            case 220: // Article follows (multi-line)
                // [headers] + \r\n \r\n + [body] + \r\n.\r\n
                var c2 = self._readHeaders();
                c2.addCallback(function(headers) {
                    if (!headers) {
                        promise.emitError();
                    }
                    var c3 = self._readBody();
                    c3.addCallback(function(body) {
                        if (!body) {
                            promise.emitError();
                        }
                        promise.emitSuccess(responseCode, responseLine, headers, body);
                    });
                    c3.addErrback(function() { promise.emitError(); });
                });
                c2.addErrback(function() { promise.emitError(); });
                break;
            case 430: // No article with that message-id
            default:
                // TODO: error code/text
                promise.emitError(responseCode, responseLine);
                break;
        }
    });
    c1.addErrback(function() { promise.emitError(); });
    return promise;
}

exports.Client = Client;
