const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

module.exports = function loadModels(sequelize) {
  const db = {};
  const basename = 'index.js';
  const modelsDir = path.join(__dirname, '..', 'models');

  fs.readdirSync(modelsDir)
    .filter((file) => {
      return (
        file.indexOf('.') !== 0 &&
        file !== basename &&
        file.slice(-3) === '.js'
      );
    })
    .forEach((file) => {
      const model = require(path.join(modelsDir, file))(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
    });

  Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
  return db;
};
