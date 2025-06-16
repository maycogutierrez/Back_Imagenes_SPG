import express from 'express';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from "dotenv";
import { fileURLToPath } from 'url'; 
import userRoutes from './Routes/usersRoutes.js';
import estudiosRoutes from './Routes/estudiosRoutes.js';
//import updateImages from './scriptImgJpg.js';
import updateImagesDicom from './scriptImgDicom.js';

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT;

app.use(morgan('dev'));
app.use(express.json());

app.use(cors({
    origin: '*', // o el dominio de tu frontend
    allowedHeaders: ['Content-Type', 'user_token'],
}));




app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/imgs', express.static(path.join(__dirname, 'imgs')));

app.use('/api/users', userRoutes);
app.use('/api/estudios', estudiosRoutes);

app.get("/", (req, res) => {
    res.send("Server funcionando");
});

//updateImages();
updateImagesDicom();

app.listen(port, () => {
    console.log("Server en puerto", port);
});
