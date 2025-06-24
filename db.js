const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

async function openDatabase( ) {
    return sqlite.open({
        filename: './dados/seraphina.db',
        driver: sqlite3.Database
    })
}

module.exports = openDatabase