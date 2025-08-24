// database/fluxoRepository.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'fluxo.db');
const db = new sqlite3.Database(dbPath);

// Cria a tabela se não existir
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS fluxo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      json_data TEXT NOT NULL
    )
  `);
});

// Funções de acesso
// database/fluxoRepository.js
module.exports = {
  getFluxo: (callback) => {
    db.get("SELECT json_data FROM fluxo WHERE id = 1", [], (err, row) => {
      if (err) return callback(err);
      callback(null, row ? JSON.parse(row.json_data) : null);
    });
  },

  getFluxoAsync: () => {
    return new Promise((resolve, reject) => {
      db.get("SELECT json_data FROM fluxo WHERE id = 1", [], (err, row) => {
        if (err) return reject(err);
        resolve(row ? JSON.parse(row.json_data) : null);
      });
    });
  },

  saveFluxo: (fluxoObj, callback) => {
    const jsonData = JSON.stringify(fluxoObj, null, 2);
    db.run(
      `INSERT INTO fluxo (id, titulo, json_data)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET titulo = excluded.titulo, json_data = excluded.json_data`,
      [fluxoObj.titulo || 'Fluxo principal', jsonData],
      callback
    );
  },

  saveFluxoAsync: (fluxoObj) => {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(fluxoObj, null, 2);
      db.run(
        `INSERT INTO fluxo (id, titulo, json_data)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET titulo = excluded.titulo, json_data = excluded.json_data`,
        [fluxoObj.titulo || 'Fluxo principal', jsonData],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }
};

