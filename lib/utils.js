Array.prototype.removeValue = function(value) {
    for (var n = 0; n < this.length; n++) {
        if (this[n] == value) {
            this.splice(n, 1);
            break;
        }
    }
}
