dotenv = require('dotenv');
dotenv.config();

module.exports = {
    HUE_KEY: dotenv.HUE_KEY || process.env.HUE_KEY,
    NODE_ENV: dotenv.NODE_ENV || process.env.NODE_ENV,
}