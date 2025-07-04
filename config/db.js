import mysql from 'mysql2/promise';
import dotenv from "dotenv";

dotenv.config();

const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: "root",
    password: process.env.DB_PASSW,
    database: process.env.DB_NAME
});

export default db;
