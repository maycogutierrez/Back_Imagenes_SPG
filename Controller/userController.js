import moment from "moment";
import { getAll, getAllRoles, getByDni, getById, insertUsers, updatePasswordByDNI, updateUserInDb } from "../Models/usersModel.js";
import bcrypt from "bcrypt";
import jwt from "jwt-simple"

const createToken = (user) => {
    let payload = {
        userId: user.id,
        createdAt: moment().unix(),
        expiresAt: moment().add(1, 'day').unix()
    }
    return jwt.encode(payload, process.env.TOKEN_KEY)
}

export const todosLosUsuarios = async (req, res) => {
    const users = await getAll();
    res.status(200).json({ users: users })
};


export const registerUser = async (req, res) => {
    const { dni, password, nombre, apellido, genero, edad,role_id } = req.body;

    console.log("Received data:", { dni, password, nombre, apellido, genero, edad,role_id });


    if (!dni || !password || !nombre || !apellido || !genero || !edad || !role_id) {
        return res.status(400).json({
            error: "Todos los campos son requeridos"
        });
    }

    const existingUser = await getByDni(dni);
    if (existingUser.length > 0) {
        return res.status(400).json({
            error: "Ya existe un usuario con este DNI"
        });
    }

    const hashedPass = bcrypt.hashSync(password, 10);
    await insertUsers(dni, hashedPass, nombre, apellido, genero, edad,role_id);
    res.status(200).json({
        message: "Usuario creado con éxito"
    });
};


export const loginUser = async (req, res) => {
    const { dni, password } = req.body;

    if (dni === undefined || password === undefined) {
        return res.status(404).json({
            error: "Todos los campos son requeridos"
        });
    }

    const result = await getByDni(dni);

    if (!result || result.length === 0) {
        return res.status(400).json({
            error: "DNI no encontrado"
        });
    }

    const pass = bcrypt.compareSync(password, result[0].password);

    if (!pass) {
        return res.status(400).json({
            error: "Error, DNI o contraseña incorrectas"
        });
    } else {
        const token = createToken(result[0]);
        res.status(200).json({
            success: token,
            done: 'Login correcto',
            id: result[0].id,
            nombre: result[0].nombre,
            apellido: result[0].apellido,
            genero: result[0].genero,
            edad: result[0].edad,
            dni: result[0].dni,
            role_id: result[0].role_id
        });

    }
};



export const checkToken = (req, res, next) => {
    const token = req.headers['user_token'];
    if (!token) {
        return res.status(403).json({
            error: "Necesitas incluir un header"
        });
    }

    let payload;
    try {
        payload = jwt.decode(token, process.env.TOKEN_KEY);
        console.log('Payload:', payload);

    } catch (err) {
        console.log('Payload:', payload);
        return res.status(401).json({
            error: 'Token inválido'
        });
    }

    if (moment().unix() > payload.expiresAt) {
        return res.status(401).json({ error: "Token expirado" });
    }

    req.userId = payload.userId;
    console.log('Payload:', payload);

    next();
};

export const getRoles = async (req, res) => {
    try {
        const roles = await getAllRoles();
        res.status(200).json({ roles });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener roles' });
    }
};


export const updateUser = async (req, res) => {
    const { dni, nombre, apellido, genero, edad, role_id } = req.body;
    console.log(dni, nombre, apellido, genero, edad, role_id )
    const userId = req.params.id; 

    if (!dni || !nombre || !apellido || !genero || !edad || !role_id) {
        return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    try {
        await updateUserInDb(userId, dni, nombre, apellido, genero, edad, role_id);
        res.status(200).json({ message: "Usuario actualizado con éxito" });
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar el usuario" });
    }
};


export const usuarioPorId = async (req, res) => {
    const { id } = req.params;
    const users = await getById(id);
    res.status(200).json({ users: users });
};



export const changePassword = async (req, res) => {
    const { dni, newPassword } = req.body;
    console.log(dni, newPassword)

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await updatePasswordByDNI(dni, hashedPassword);

        res.status(200).json({ message: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña.' });
    }
};
