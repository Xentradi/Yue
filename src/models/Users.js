const {sequelize} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'users',
    {
      user_id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      balance: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      experience: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
    },
    {
      timestamps: false,
    }
  );
};
