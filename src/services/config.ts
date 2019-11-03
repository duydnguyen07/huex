import dotenv from "dotenv";

dotenv.config();

export const config = {
    HUE_KEY: process.env.HUE_KEY,
    NODE_ENV: process.env.NODE_ENV,
    DATA_COLLECTION_INTERVAL: process.env.DATA_COLLECTION_INTERVAL
};
