var fs = require('fs');
var path = require('path');
var xpush = require('xpush');
var async = require('async');
var utils = require('../utils');
var CONS = require('../constants');

var envType = process.env.X_TYPE; // SESSION, CHANNEL
var envPid = process.env.X_PID;   // Process Id
var envPath = process.env.X_PATH; // home dir path
var envHost = process.env.X_HOST;
var envPort = process.env.X_PORT;
var envConfig = process.env.X_CONFIG;

var serverName;

var config = {};

if (envConfig) {

  envConfig = path.resolve(envConfig);

  try {
    var data = fs.readFileSync(envConfig);
    config = JSON.parse(data.toString());
  } catch (ex) {
    console.error('Error starting daemon process: ' + ex);
    process.exit(1);
  }
}

var pidFilePath = utils.getPidFilePath(envPath, envType, envPort);

console.log('\n [ Daemon Process got started. ]');

console.log(' - TYPE : ' + envType);
console.log(' - PID : ' + envPid + ' (' + pidFilePath + ')');
console.log(' - PATH : ' + envPath);
console.log(' - HOST : ' + envHost);
console.log(' - PORT : ' + envPort);
console.log(' - CONFIG : ' + envConfig);

function exit() {
  console.warn('What the hell ... ? By the way, bye ... :) ');
  process.exit(0);
}

process.on('SIGINT', exit);
process.on('SIGTERM', exit);


var afterProcess = function () {

  var zkClient;
  var redisClient;

  async.series([

    function (callback) {

      zkClient = xpush.createZookeeperClient(config);
      zkClient.once('connected', function () {

        zkClient.getChildren(
          '/xpush/servers',
          function (error, nodes, stats) {
            if (error) {
              console.error(error.stack);
              callback(error);
              return;
            }

            var server = envHost + ':' + envPort;
            var isExisted = false;

            for (var i = 0; i < nodes.length; i++) {

              var ninfo = nodes[i].split('^'); // 0: name, 1:ip&Port, 2: replicas

              if (server == ninfo[1]) { // address (1)

                isExisted = true;

                // 1. ServerName
                serverName = ninfo[0];

                // 2. Remove ZNode
                zkClient.remove(
                  '/xpush/servers/' + nodes[i],
                  -1,
                  function (err) {
                    if (err) {
                      console.log('Failed to remove node due to: %s.', err);
                      callback(err);
                    } else {
                      callback(null);
                    }
                  }
                );

                break;
              }

            }

            if (!isExisted) { // 존재하지 않으면 다음을 진행 할 수 없음
              callback('Zookeeper node was not existed.');
            }

          }
        );

      });

      zkClient.connect();
    },
    function (callback) {

      console.info('"ServerName" on terminating : [' + serverName + ']');

      if (serverName) {
        redisClient = xpush.createRedisManager(config);
        redisClient.once("connect", function () {

          redisClient.hgetall(CONS.XC_S + ':' + serverName, function (err, res) {

            if (err) {
              console.error(err);
            } else {

              for (var _key in res) {

                var sinfo = _key.split('^'); // 0: app(A), 1:user(U), 2: device(D)
                redisClient.hdel(CONS.XC_U + ':' + sinfo[0] + ':' + sinfo[1], sinfo[2]);
                redisClient.hdel(CONS.XC_A + ':' + sinfo[0], sinfo[1] + '^' + serverName);

              }
            }

            redisClient.del(CONS.XC_S + ':' + serverName);

            callback(null, res);
          });

        });
      } else {
        callback('"ServerName" is not existed.');
      }


    },
    function (callback) {

      callback(null);
    }
  ], function (err, results) {

    if (err) {
      console.error(err, results);
    }

    process.nextTick(function () {

      zkClient.close();

      //redisClient.close();

      console.log('Bye ... :) ');

      process.exit(0);

    });

  });


};

var checkProcess = function () {

  var isRunning = utils.checkProcess(envPid);

  if (isRunning) {

    process.stdout.write('.');

    //console.info('PID: %s, TYPE: %s, PORT: %s', envPid, envType, envPort);

    setTimeout(checkProcess, 700);

  } else {

    process.stdout.write('\n');
    //console.info('DO SOMETHING AFTER SHUTDOWN.');
    afterProcess();

  }

};

var pid = require('./../pid').create(pidFilePath);
pid.removeOnExit();

console.log('\n' + new Date());
checkProcess();
