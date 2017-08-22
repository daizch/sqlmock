var mysql = require('mysql');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
const debug = require('debug')('sqlmock');

function getRandomString(params) {
    var size = params.size || 255;
    size = Math.max(Math.floor(Math.random() * size), 1);
    var val = '';
    var index;

    for (var i = 0; i < size; i++) {
        index = Math.floor(Math.random() * 93) + 32;
        //避免插入数据库时出现语法错误
        if (['"', "'", '\\'].indexOf(String.fromCharCode(index)) > -1) {
            i--;
        } else {
            val += String.fromCharCode(index);
        }
    }

    return val;
}

function getRandomInt(params) {
    var positive = Math.floor(Math.random() * params.min);
    var nagative = Math.ceil(Math.random() * params.max);
    var val = (Math.random() > 0.5) ? positive : nagative;
    return parseInt(Math.random() * params.size);
}

function getRandomDate(params) {
    var date = moment();
    var units = ['y', 'M', 'd', 'h', 'm', 's'];
    var interval = Math.ceil(Math.random() * 1e2);
    var unit;

    for (var i = 0; i < 1e5; i++) {
        unit = units[Math.floor(Math.random() * units.length)];
        var reg = new RegExp(unit, 'i');
        if (reg.test(params.format)) {
            break;
        }
    }

    date.subtract(interval, unit);
    return date.format(params.format);
}


function getRandomEnum(params) {
    var enums = params.size.split(/\s*,\s/g);
    var index = Math.floor(Math.random() * enums.length);

    return enums[index] || '';
}


function getRandomFloat(params) {
    var val = Math.random() * Math.pow(10, params.decimalBit || 1);

    return val.toFixed(params.pointBit);
}

function getDataType(type) {
    const typeReg = /(\w+)(?:\((.+)\))?/;
    var match = typeReg.exec(type);
    var size = match[2] || '';
    var dataType = match[1] || '';
    return {
        type: dataType.trim().toLowerCase(),
        size: size.trim()
    };
}


function randomMock(row) {
    var dataType = getDataType(row.Type);
    var val;
    var args;
    const DateFormat = {
        'date': 'YYYY-MM-DD',
        'datetime': 'YYYY-MM-DD HH:mm:ss',
        'timestamp': 'YYYY-MM-DD HH:mm:ss',
        'time': 'HH:mm:ss',
        'year': 'YYYY'
    };

    const StringSize = {
        tinytext: 255,
        text: 255,
        char: 255,
        varchar: 255,
        mediumtext: 16777215,
        longtext: 4294967295
    };

    const IntSize = {
        'tinyint': {min: -128, max: 127},
        'smallint': {min: -32768, max: 32767},
        'mediumint': {min: -8388608, max: 8388607},
        'int': {min: -2147483648, max: 2147483647},
        'bigint': {min: -9223372036854775808, max: 9223372036854775807}
    };

    /**
     * DECIMAL,LONGBLOB,BLOB not support
     */

    debug(dataType)
    switch (dataType.type) {
        case 'tinytext':
        case 'text':
        case 'char':
        case 'varchar':
        case 'mediumtext':
        case 'longtext':
            dataType.size = dataType.size || StringSize[dataType.type]; //存放最大长度为 4,294,967,295 个字符的字符串
            val = getRandomString(dataType);
            break;
        case 'enum':
            val = getRandomEnum(dataType);
            break;

        case 'tinyint':
        case 'smallint':
        case 'mediumint':
        case 'int':
        case 'bigint':
            Object.assign(dataType, IntSize[dataType.type]);
            val = getRandomInt(dataType);
            break;

        case 'float':
        case 'double':
            args = dataType.size.split(/\s*,\s*/);
            dataType.pointBit = args[1] || 0;
            dataType.decimalBit = args[0];
            val = getRandomFloat(dataType);
            break;

        case 'date':
        case 'datetime':
        case 'timestamp':
        case 'time':
        case 'year':
            dataType.format = DateFormat[dataType.type];
            val = getRandomDate(dataType);
            break;
    }

    return val;
}

function mock(rows) {
    var data = {};
    rows.forEach(function (row) {
        if (!row.Key) {
            data[row.Field] = randomMock(row);
        }
    });

    return data;
}

class SQLMock {
    constructor(opts) {
        var DEFAULT_DB_CONFIG = {
            host: 'localhost',
            user: 'root',
            password: '',
            database: ''
        };
        var dbConfig = Object.assign(DEFAULT_DB_CONFIG, opts);
        this.connection = mysql.createConnection(dbConfig);
        this.connection.connect();
    }

    generate(opts) {
        var self = this;
        var table = opts.table;
        const total = opts.total || 1e2;
        return new Promise((resolve, reject)=> {
            self.connection.query(`desc ${table}`, function (err, result) {
                var cnt = total;
                var rows = [];

                if (err) {
                    return reject(err);
                }

                while (cnt--) {
                    var row = mock(result);
                    rows.push(row);
                }

                resolve(rows);
            });
        });
    }

    run(opts) {
        var self = this;
        var table = opts.table;
        return new Promise(function (resolve, reject) {
            self.generate(opts)
                .then((rows)=> {
                    var index = 0;
                    rows.forEach((row)=> {
                        var cols = Object.keys(row);
                        var dataStr = '';

                        cols.forEach((col, i)=> {
                            var val = row[col];
                            if (i > 0) {
                                dataStr += ',';
                            }

                            if (typeof val != 'string') {
                                dataStr += val;
                            } else {
                                dataStr += "'" + val + "'";
                            }
                        });
                        var fields = cols.join(',');
                        var sql = `insert into ${table} (${fields}) values (${dataStr})`;
                        debug(sql);
                        self.connection.query(sql, (err, result)=> {
                            if (err) {
                                reject(err);
                            }
                            resolve();

                            index++;
                            if (index == rows.length) {
                                resolve();
                            }
                        })
                    })
                });
        })
    }

    loadMockData(config) {
        var self = this;
        return this.run(config).then(function () {
            self.connection.end();
        }).catch((err)=> {
            debug(err);
            self.connection.end();
        });

    }
}

module.exports = SQLMock;