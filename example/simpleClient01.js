var io = require('socket.io-client');
var util = require('../test/utils');
var faker = require('faker');
var async = require('async');

var address = process.argv[2] || '127.0.0.1:8888';

var _host = address.substr(0, address.indexOf(':'));
var _port = Number(address.substr(address.indexOf(':') + 1));

var _app = 'link_stalk.io';

var user = {
  'A': _app,
  'D': 'dev1',
  'U': 'johnkim',
  'PW': 'password',
  'DT': {'name': 'John Kim', 'tel': '010-1234-5678'}
};

var GLOBAL_SOCKET;

async.series([

  function (callback) { // 사용자 정보 UPDATE

    util.post(_host, _port, '/user/update', user, function (err, data) {

      if (data.status == 'ok'){
        callback(null, data);
      } else{

        util.post(_host, _port, '/user/register', user, function (err, data) {
          if (data.status == 'ok'){
            callback(null, data);
          } else{
            callback(data.status, data.message);
          }
        });

      }
    });


  },
  function (callback) { // Global Socket 연결
    util.get(_host, _port, '/node/' + _app + '/' + user.U, function (err, data) {
      var query = 'A=' + user.A + '&U=' + user.U + '&D=' + user.D;
      GLOBAL_SOCKET = io.connect(data.result.server.url + '/global?' + query, util.socketOptions);
      GLOBAL_SOCKET.on('connect', function (data) {
        console.log(data);
        callback(null, data);
      });
    });
  },
  function (callback) {
    callback(null, 'ENBD');
  }
], function (err, results) {

  console.log(err, results);

});