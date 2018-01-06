var socket = require('socket.io-client')('https://insight.bitpay.com');
var request = require('request');
var Sequelize = require('sequelize');
var __ = require('underscore');

var addressArray = [
    '2Mxs1sYMGh2dR5tHBLCMnhdjMim8Kvn88wW',
    '2MvVK98nuCj9TsPWJ855njDT733CKwpVdCw',
    '2N3xPEq3AiWXgW6QnyN15efaMqVPC1SBsTd',
    '2N5xZUhG3mTpUhRd6FCFuFXUhwA1TQ9Zy4z',
    '2MvVPENNKb2gLHvnR7WRWjSB3F7HpnfD2ZV'
];

var dataToProcess = [];

var sequelize = new Sequelize('bitcoins', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    operatorsAliases: false
});


var ADDRESS_MODEL = sequelize.define('addresses', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    address: {
        type: Sequelize.STRING(255),
        unique: true
    }
});

var insertData = function(dataArray, callback) {

    var records = [];
    for (var i = 0; i < dataArray.length; i += 1) {
        records.push({ address: dataArray[i] });
    }

    ADDRESS_MODEL.bulkCreate(records).then(data => {
        callback(null, data);
    })
};

var connectToSocketNow = function() {
    socket.on('connect', function() {
        console.log('Connected to websocket');
        socket.emit('subscribe', 'inv');
    });

    var senttx;
    socket.on('tx', function(data) {
        console.log(data);
        request.get('https://insight.bitpay.com/api/tx/' + data.txid, function(err, head, body) {
            if (err || !body || body === "Not found") {
                console.log("ERR or NOT FOUND ..........", err, body);
            } else {
                var json = JSON.parse(body);
                if (json.vout && json.vout.length > 0) {
                    json.vout.forEach(function(vout) {
                        if (vout.scriptPubKey && vout.scriptPubKey.addresses) {
                            vout.scriptPubKey.addresses.forEach(function(a) {
                                if (dataToProcess.indexOf(a) > -1) {
                                    senttx = data.txid;
                                    console.log(vout);
                                }
                            });
                        }
                    });
                }

                if (json.vin && json.vin.length > 0) {
                    json.vin.forEach(function(vin) {
                        if (dataToProcess.indexOf(vin.addr) > -1 && senttx != data.txid) {
                            console.log(vin);
                        }
                    });
                }
            }
        });
    });

    socket.on('disconnect', function() {
        console.log('Disconnected!');
    });
}

var start = function() {
    ADDRESS_MODEL.sequelize.sync().then(function() {

        ADDRESS_MODEL.findAll({ where: { address: addressArray } }).then(data => {
            if (data.length <= 0) {
                insertData(addressArray, function(err, data) {
                    if (err) return err;
                    dataToProcess = JSON.parse(JSON.stringify(data));
                    dataToProcess = __.pluck(dataToProcess, 'address');
                    connectToSocketNow();
                });
            } else {
                dataToProcess = JSON.parse(JSON.stringify(data));
                dataToProcess = __.pluck(dataToProcess, 'address');
                connectToSocketNow();
            }
        });
    });
}

start();
