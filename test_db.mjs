import sqlite3 from 'sqlite3';
const db = new sqlite3.Database(process.env.HOME + '/Library/Application Support/care.ayoo.haven/haven.db');
db.all("SELECT * FROM files LIMIT 1", (err, rows) => {
  if (err) console.error(err);
  console.log(typeof rows[0].data);
  console.log(rows[0].data.toString().substring(0, 50));
});
