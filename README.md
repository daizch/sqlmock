# SQLMock
quickly generating mock data by the fields description of thedatabase table.

## install

```sh
$ npm i sqlmock --save-dev
```

## usage

```javascript
var SQLMock = require('sqlmock');
var mockIns = new SQLMock({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'db_test'
});

mockIns.loadMockData({
    table: 't_test_table',
    total: 10
}).then(function () {
    console.log('done')
});
```
