var SQLMock = require('..');
var mockIns = new SQLMock({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'db_fmp_article'
});

mockIns.loadMockData({
    table: 't_article_label',
    total: 10
}).then(function () {
    console.log('done')
});