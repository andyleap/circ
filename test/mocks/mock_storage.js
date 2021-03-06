// Generated by CoffeeScript 1.4.0
(function() {
  "use strict";
  var Storage, exports, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  var exports = (_ref = window.mocks) != null ? _ref : window.mocks = {};

  Storage = (function() {

    Storage.useMock = function() {
      var _base, _ref1, _ref2;
      if ((_ref1 = (_base = ((_ref2 = window.chrome) != null ? _ref2 : window.chrome = {})).storage) == null) {
        _base.storage = {};
      }
      window.chrome.storage.sync = new Storage;
      window.chrome.storage.local = new Storage;
      return window.chrome.storage.onChanged = {
        addListener: function(update) {
          return window.chrome.storage.update = update;
        }
      };
    };

    function Storage() {
      this._storageMap = {};
    }

    Storage.prototype.set = function(obj) {
      var k, v, _results;
      _results = [];
      for (k in obj) {
        v = obj[k];
        _results.push(this._storageMap[k] = v);
      }
      return _results;
    };

    Storage.prototype.get = function(keys, callback) {
      var k, result, v, _ref1;
      if (typeof keys === 'string') {
        keys = [keys];
      }
      result = {};
      _ref1 = this._storageMap;
      for (k in _ref1) {
        v = _ref1[k];
        if (__indexOf.call(keys, k) >= 0) {
          result[k] = v;
        }
      }
      return callback(result);
    };

    Storage.prototype.remove = function(keys) {
      var k, _i, _len, _results;
      if (typeof keys === 'string') {
        keys = [keys];
      }
      _results = [];
      for (_i = 0, _len = keys.length; _i < _len; _i++) {
        k = keys[_i];
        _results.push(delete this._storageMap[k]);
      }
      return _results;
    };

    Storage.prototype.clear = function() {
      return this._storageMap = {};
    };

    return Storage;

  })();

  exports.storage = Storage;

}).call(this);
