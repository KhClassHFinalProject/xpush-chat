var io = require('socket.io-client');
var util = require('../test/utils');
var faker = require('faker');
var async = require('async');
var argv     = require('optimist').argv;

var device = argv.device || 'dev1';
var address = argv.address || '127.0.0.1:8000';
var _app = argv.app || 'LINK:STALK_IO';

var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

console.log('\n --------------------------------- ');
console.log(' - address : '+address);
console.log(' - device : '+device);
console.log(' - app : '+_app);
console.log(' --------------------------------- \n');

var user = {
  'A': _app,
  'D': device,
  'U': 'john',
  'PW': 'password',
  'DT': {'name': 'John Kim', 'tel': '010-1234-5678'}
};

var isConnected = false;

var GLOBAL_SOCKET = {};

async.series([

  function (callback) { // 사용자 정보 UPDATE

    util.post(_host, _port, '/user/update', user, function (err, data) {

      if (data.status == 'ok') {
        callback(null, data);
      } else {

        util.post(_host, _port, '/user/register', user, function (err, data) {
          if (data.status == 'ok') {
            callback(null, data);
          } else {
            callback(data.status, data.message);
          }
        });

      }
    });

  },
  function (callback) {

    util.post(_host, _port, '/user/list/active', {A: _app}, function (err, data) {

      if (data.status == 'ok') {
        console.log(data);
        callback(null, data);
      } else {
        callback(data.status, data);
      }
    });

  },
  function (callback) { // Global Socket 연결

    util.get(_host, _port, '/node/' + _app + '/' + user.U, function (err, data) {

      var query = 'A=' + user.A + '&U=' + user.U + '&D=' + user.D;
      GLOBAL_SOCKET = io.connect(data.result.server.url + '/global?' + query, util.socketOptions);
      GLOBAL_SOCKET.on('connect', function (data) {

        if (!isConnected) { // 재연결 되는 경우를 고려함 !
          isConnected = true;
          callback(null);
        }

      });
      GLOBAL_SOCKET.on('message', function (data) {
        console.info(' ** MESSAGE (GS) ** ', data);
      });
    });
  },
  function (callback) {
    callback(null, 'ENBD');
  }
], function (err, results) {

  console.log(err, results);

});
