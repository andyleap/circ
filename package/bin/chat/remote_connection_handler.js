// Generated by CoffeeScript 1.4.0
(function() {
  "use strict";
  var RemoteConnectionHandler, exports, _ref,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  var exports = (_ref = window.chat) != null ? _ref : window.chat = {};

  /*
   * Handles sharing an IRC connections between multiple devices.
  */


  RemoteConnectionHandler = (function() {
    /*
       * Number of ms to wait for a connection to be established to a server device
       * before using our own IRC connection.
    */

    RemoteConnectionHandler.SERVER_DEVICE_CONNECTION_WAIT = 650;

    /*
       * If this many milliseconds go by after the user has connected to their own
       * IRC connection, we will notify them before switching to a remote server
       * connection.
    */


    RemoteConnectionHandler.NOTIFY_BEFORE_CONNECTING = 1500;

    /*
       * Number of ms to wait before trying to reconnect to the server device.
    */


    RemoteConnectionHandler.SERVER_DEVICE_RECONNECTION_WAIT = 500;

    RemoteConnectionHandler.SERVER_DEVICE_RECONNECTION_MAX_WAIT = 5 * 1000;

    function RemoteConnectionHandler(chat) {
      this._useOwnConnectionWhileWaitingForServer = __bind(this._useOwnConnectionWhileWaitingForServer, this);

      this._reconnect = __bind(this._reconnect, this);

      this._onOffline = __bind(this._onOffline, this);

      this._onOnline = __bind(this._onOnline, this);

      this._tearDown = __bind(this._tearDown, this);
      this._log = getLogger(this);
      this._timer = new Timer();
      this._chat = chat;
      this._addConnectionChangeListeners();
      chat.on('tear_down', this._tearDown);
      if (!isOnline()) {
        this._chat.notice.prompt("No internet connection found. You will be unable to connect to IRC.");
      }
    }

    RemoteConnectionHandler.prototype._tearDown = function() {
      return this._removeConnectionChangeListeners();
    };

    RemoteConnectionHandler.prototype._addConnectionChangeListeners = function() {
      $(window).on('online', this._onOnline);
      return $(window).on('offline', this._onOffline);
    };

    RemoteConnectionHandler.prototype._removeConnectionChangeListeners = function() {
      $(window).off('online', this._onOnline);
      return $(window).off('offline', this._onOffline);
    };

    /*
       * Set the storage handler which is used to store IRC states and which device
       * is acting as the server
       * @param {Storage} storage
    */


    RemoteConnectionHandler.prototype.setStorageHandler = function(storage) {
      var _this = this;
      this._storage = storage;
      this._remoteConnection.setIRCStateFetcher(function() {
        return _this._storage.getState();
      });
      return this._remoteConnection.setChatLogFetcher(function() {
        return _this._chat.messageHandler.getChatLog();
      });
    };

    /*
       * Set the remote connection which handles sending and receiving data from
       * connected devices.
       * @param {RemoteConnection} remoteConnection
    */


    RemoteConnectionHandler.prototype.setRemoteConnection = function(remoteConnection) {
      this._remoteConnection = remoteConnection;
      return this._listenToRemoteConnectionEvents();
    };

    RemoteConnectionHandler.prototype._onOnline = function() {
      this._chat.notice.close();
      this._timer.start('started_connection');
      return this.determineConnection();
    };

    RemoteConnectionHandler.prototype._onOffline = function() {
      this._chat.notice.prompt("You lost connection to the internet. You will be unable to connect to IRC.");
      return this._chat.remoteConnection.disconnectDevices();
    };

    RemoteConnectionHandler.prototype._listenToRemoteConnectionEvents = function() {
      var _this = this;
      this._chat.userCommands.listenTo(this._remoteConnection);
      this._remoteConnection.on('found_addr', function() {
        return _this.determineConnection();
      });
      this._remoteConnection.on('no_addr', function() {
        return _this.useOwnConnection();
      });
      this._remoteConnection.on('no_port', function() {
        return _this.useOwnConnection();
      });
      this._remoteConnection.on('server_found', function() {
        var abruptSwitch;
        _this._chat.notice.close();
        abruptSwitch = _this._timer.elapsed('started_connection') > chat.RemoteConnectionHandler.NOTIFY_BEFORE_CONNECTING;
        if (abruptSwitch) {
          return _this._notifyConnectionAvailable();
        } else {
          return _this._remoteConnection.finalizeConnection();
        }
      });
      this._remoteConnection.on('invalid_server', function(connectInfo) {
        if (_this._chat.remoteConnection.isInitializing()) {
          _this._onConnected = function() {
            return _this._displayFailedToConnect(connectInfo);
          };
        } else if (!_this._reconnectionAttempt) {
          _this._displayFailedToConnect(connectInfo);
        }
        _this._reconnectionAttempt = false;
        _this.useOwnConnection();
        return _this._tryToReconnectToServerDevice();
      });
      this._remoteConnection.on('irc_state', function(state) {
        _this._timer.start('started_connection');
        _this._reconnectionAttempt = false;
        _this._storage.pause();
        _this._chat.closeAllConnections();
        _this._stopServerReconnectAttempts();
        return _this._storage.loadState(state);
      });
      this._remoteConnection.on('chat_log', function(chatLog) {
        var connInfo;
        _this._chat.messageHandler.replayChatLog(chatLog);
        connInfo = _this._remoteConnection.serverDevice;
        if (!connInfo) {
          return;
        }
        return _this._chat.displayMessage('notice', _this._chat.getCurrentContext(), "Connected through " + ("server device " + (connInfo.toString())));
      });
      this._remoteConnection.on('server_disconnected', function() {
        _this._timer.start('started_connection');
        if (!_this.manuallyDisconnected) {
          _this._onConnected = function() {
            return _this._displayLostConnectionMessage();
          };
        }
        return _this.determineConnection();
      });
      this._remoteConnection.on('client_joined', function(client) {
        _this._chat.displayMessage('notice', _this._chat.getCurrentContext(), client.addr + ' connected to this device');
        return _this._chat.updateStatus();
      });
      return this._remoteConnection.on('client_parted', function(client) {
        _this._chat.displayMessage('notice', _this._chat.getCurrentContext(), client.addr + ' disconnected from this device');
        return _this._chat.updateStatus();
      });
    };

    RemoteConnectionHandler.prototype.isManuallyConnecting = function() {
      return this._timer.start('started_connection');
    };

    RemoteConnectionHandler.prototype._notifyConnectionAvailable = function() {
      var message,
        _this = this;
      message = "Device discovered. Would you like to connect and use its IRC " + "connection? [connect]";
      return this._chat.notice.prompt(message, function() {
        _this._reconnectionAttempt = false;
        return _this._chat.remoteConnection.finalizeConnection();
      });
    };

    RemoteConnectionHandler.prototype._displayFailedToConnect = function(connectInfo) {
      if (!connectInfo) {
        return;
      }
      return this._chat.displayMessage('notice', this._chat.getCurrentContext(), "Unable to connect to " + ("server device " + connectInfo.addr + " on port " + connectInfo.port));
    };

    RemoteConnectionHandler.prototype._displayLostConnectionMessage = function() {
      return this._chat.displayMessage('notice', this._chat.getCurrentContext(), "Lost connection to " + "server device. Attempting to reconnect...");
    };

    /*
       * Determine if we should connect directly to IRC or connect through another
       * device's IRC connection.
    */


    RemoteConnectionHandler.prototype.determineConnection = function() {
      if (!isOnline()) {
        return;
      }
      this._log('determining connection...', this._remoteConnection.getConnectionInfo().addr, this._storage.loadedServerDevice, this._storage.password);
      if (!(this._remoteConnection.getConnectionInfo().addr && this._storage.loadedServerDevice && this._storage.password)) {
        return;
      }
      this._log('can make a connection - device:', this._storage.serverDevice, '- is server?', this.shouldBeServerDevice());
      if (this._storage.serverDevice && !this.shouldBeServerDevice()) {
        return this._useServerDeviceConnection();
      } else {
        return this.useOwnConnection();
      }
    };

    RemoteConnectionHandler.prototype._useServerDeviceConnection = function() {
      clearTimeout(this._useOwnConnectionTimeout);
      if (this._alreadyConnectedToServerDevice()) {
        return;
      }
      this._log('automatically connecting to', this._storage.serverDevice);
      if (this._remoteConnection.isInitializing()) {
        this._useOwnConnectionIfServerTakesTooLong();
      }
      return this._remoteConnection.connectToServer(this._storage.serverDevice);
    };

    RemoteConnectionHandler.prototype._alreadyConnectedToServerDevice = function() {
      var isCurrentServerDevice, usingServerDeviceConnection, _ref1, _ref2;
      usingServerDeviceConnection = (_ref1 = this._remoteConnection.getState()) === 'connected' || _ref1 === 'connecting';
      isCurrentServerDevice = (_ref2 = this._remoteConnection.serverDevice) != null ? _ref2.usesConnection(this._storage.serverDevice) : void 0;
      return usingServerDeviceConnection && isCurrentServerDevice;
    };

    RemoteConnectionHandler.prototype._useOwnConnectionIfServerTakesTooLong = function() {
      var _this = this;
      return this._useOwnConnectionTimeout = setTimeout(function() {
        return _this._useOwnConnectionWhileWaitingForServer();
      }, RemoteConnectionHandler.SERVER_DEVICE_CONNECTION_WAIT);
    };

    RemoteConnectionHandler.prototype._tryToReconnectToServerDevice = function() {
      var _ref1,
        _this = this;
      clearTimeout(this._serverDeviceReconnectTimeout);
      if ((_ref1 = this._serverDeviceReconnectBackoff) == null) {
        this._serverDeviceReconnectBackoff = RemoteConnectionHandler.SERVER_DEVICE_RECONNECTION_WAIT;
      }
      return this._serverDeviceReconnectTimeout = setTimeout(function() {
        return _this._reconnect();
      }, this._serverDeviceReconnectBackoff);
    };

    RemoteConnectionHandler.prototype._reconnect = function() {
      var _ref1;
      this._reconnectionAttempt = true;
      this._serverDeviceReconnectBackoff *= 1.2;
      if (this._serverDeviceReconnectBackoff > RemoteConnectionHandler.SERVER_DEVICE_RECONNECTION_MAX_WAIT) {
        this._serverDeviceReconnectBackoff = RemoteConnectionHandler.SERVER_DEVICE_RECONNECTION_MAX_WAIT;
      }
      if (!((_ref1 = this._remoteConnection.getState()) === 'connecting' || _ref1 === 'connected')) {
        return this.determineConnection();
      }
    };

    RemoteConnectionHandler.prototype._stopServerReconnectAttempts = function() {
      clearTimeout(this._serverDeviceReconnectTimeout);
      return this._serverDeviceReconnectBackoff = RemoteConnectionHandler.SERVER_DEVICE_RECONNECTION_WAIT;
    };

    RemoteConnectionHandler.prototype._useOwnConnectionWhileWaitingForServer = function() {
      var connectInfo,
        _this = this;
      if (!this._remoteConnection.isInitializing()) {
        return;
      }
      this._remoteConnection.becomeIdle();
      connectInfo = this._storage.serverDevice;
      this._onConnected = function() {
        return _this._displayFailedToConnect(connectInfo);
      };
      return this._resumeIRCConnection();
    };

    RemoteConnectionHandler.prototype.useOwnConnection = function() {
      var shouldResumeIRCConn, usingServerDeviceConnection, _ref1;
      clearTimeout(this._useOwnConnectionTimeout);
      usingServerDeviceConnection = (_ref1 = this._remoteConnection.getState()) === 'connected';
      if (usingServerDeviceConnection) {
        this.manuallyDisconnected = true;
        this._remoteConnection.disconnectFromServer();
        this.manuallyDisconnected = false;
        return;
      }
      if (this.shouldBeServerDevice()) {
        this._chat.notice.close();
        this._stopServerReconnectAttempts();
        this._tryToBecomeServerDevice();
        return;
      }
      shouldResumeIRCConn = this._notUsingOwnIRCConnection();
      if (this._remoteConnection.isIdle()) {
        return;
      }
      this._stopBeingServerDevice();
      if (shouldResumeIRCConn) {
        return this._resumeIRCConnection();
      }
    };

    RemoteConnectionHandler.prototype._tryToBecomeServerDevice = function() {
      var shouldResumeIRCConn,
        _this = this;
      shouldResumeIRCConn = this._notUsingOwnIRCConnection();
      if (this._remoteConnection.getState() === 'finding_port') {
        this._remoteConnection.waitForPort(function() {
          return _this.determineConnection();
        });
        this._log('should be server, but havent found port yet...');
        return;
      }
      if (this._remoteConnection.getState() === 'no_port') {
        if (this._remoteConnection.isServer()) {
          this._stopBeingServerDevice();
        }
      } else if (!this._remoteConnection.isServer() || this._storage.serverDevice.port !== this._remoteConnection.getConnectionInfo().port) {
        this._becomeServerDevice();
      } else {
        return;
      }
      if (shouldResumeIRCConn) {
        return this._resumeIRCConnection();
      }
    };

    RemoteConnectionHandler.prototype._notUsingOwnIRCConnection = function() {
      return this._remoteConnection.isInitializing() || this._remoteConnection.isClient();
    };

    RemoteConnectionHandler.prototype._stopBeingServerDevice = function() {
      if (this._remoteConnection.isServer()) {
        this._log('stopped being a server device');
        return this._remoteConnection.disconnectDevices();
      } else {
        return this._remoteConnection.becomeIdle();
      }
    };

    RemoteConnectionHandler.prototype.shouldBeServerDevice = function() {
      /*
           * TODO check something stored in local storage, not IP addr which can change
      */

      var _ref1, _ref2;
      return _ref1 = (_ref2 = this._storage.serverDevice) != null ? _ref2.addr : void 0, __indexOf.call(this._remoteConnection.getConnectionInfo().possibleAddrs, _ref1) >= 0;
    };

    RemoteConnectionHandler.prototype._becomeServerDevice = function() {
      this._log('becoming server device');
      if (!this._remoteConnection.isInitializing()) {
        this._chat.displayMessage('notice', this._chat.getCurrentContext(), 'Now accepting ' + 'connections from other devices');
      }
      this._remoteConnection.becomeServer();
      return this._storage.becomeServerDevice(this._remoteConnection.getConnectionInfo());
    };

    RemoteConnectionHandler.prototype._resumeIRCConnection = function() {
      var _this = this;
      this._timer.start('started_connection');
      this._log('resuming IRC conn');
      this._chat.closeAllConnections();
      return this._storage.restoreSavedState(function() {
        return _this._onUsingOwnConnection();
      });
    };

    RemoteConnectionHandler.prototype._onUsingOwnConnection = function() {
      this._selectFirstRoom();
      this._chat.messageHandler.replayChatLog();
      this._storage.resume();
      if (typeof this._onConnected === "function") {
        this._onConnected();
      }
      this._onConnected = void 0;
      if (!this._storage.completedWalkthrough) {
        return this._chat.startWalkthrough();
      }
    };

    RemoteConnectionHandler.prototype._selectFirstRoom = function() {
      if (this._chat.winList.length > 1) {
        return this._chat.switchToWindow(this._chat.winList.get(0));
      }
    };

    return RemoteConnectionHandler;

  })();

  exports.RemoteConnectionHandler = RemoteConnectionHandler;

}).call(this);
