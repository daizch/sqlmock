var SQLMock = require('..');
var mockIns = new SQLMock({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'db_demo'
});

mockIns.loadMockData({
    table: 't_table',
    total: 32
}).then(function () {
    console.log('done')
});


mockIns.loadMockData({
    table: 't_filter_table',
    total: 32,
    dataFilter: function (data) {
        //do sth here
        return data;
    }
}).then(function () {
    console.log('done')
});
