var Module = require("module");

function CustomRequire(callback) {
    this.callback = callback;
}
CustomRequire.prototype.require = function(path) {
    var requiredFilename = Module._resolveFilename(path, this, false);
    var res = require(path);
    var cachedModule = Module._cache[requiredFilename];
    cachedModule.__addCustomRequire(this);
    return res;
}

Module.prototype.__require = Module.prototype.require;
Module.prototype.__addCustomRequire = function(customRequire) {
    if (this.__customRequires.indexOf(customRequire) < 0) {
        this.__customRequires.push(customRequire);
    }
    if (customRequire.callback) {
        this.__callChildRequires(customRequire);
    }
}
Module.prototype.__callChildRequires = function(customRequire, called) {
    if (!called) {
        called = [];
    }
    if (called.indexOf(this) < 0) {
        called.push(this);
        customRequire.callback(this.filename);
        for (var i = 0; i < this.__childModules.length; i++) {
            var childModule = this.__childModules[i];
            childModule.__callChildRequires(customRequire, called);
        }
    }
}
Module.prototype.__callRequires = function(mod) {
    for (var i = 0; i < this.__customRequires.length; i++) {
        var customRequire = this.__customRequires[i];
        if (customRequire.callback) {
            mod.__callChildRequires(customRequire);
        }
    }
}
Module.prototype.__initialize = function() {
    if (!this.__childModules) {
        this.__childModules = [];
        this.__customRequires = [];
        this.__parentModules = [];
    }
}
Module.prototype.__callParentRequires = function(mod) {
    this.__callRequires(mod);
    for (var i = 0; i < this.__parentModules.length; i++) {
        var parentModule = this.__parentModules[i];
        parentModule.__callParentRequires(mod);
    }
}
Module.prototype.require = function(path) {
    this.__initialize();
    var requiredFilename = Module._resolveFilename(path, this, false);
    var res = this.__require(path);
    var cachedModule = Module._cache[requiredFilename];
    if (this.__childModules.indexOf(cachedModule) < 0) {
        cachedModule.__initialize();
        this.__childModules.push(cachedModule);
        cachedModule.__parentModules.push(this);
        this.__callParentRequires(cachedModule);
    }
    return res;
}

module.exports = CustomRequire;