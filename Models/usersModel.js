import db from "../config/db.js";

export const getAll = async () => {
  const query = "SELECT * FROM users ORDER BY nombre ASC, apellido ASC";
  const [rows] = await db.query(query);
  console.log(rows);
  return rows;
};

export const insertUsers = async (
  dni,
  pass,
  nombre,
  apellido,
  genero,
  edad,
  role_id
) => {
  const query =
    "INSERT INTO users (dni, password, nombre, apellido,genero, edad, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
  await db.query(query, [dni, pass, nombre, apellido, genero, edad, role_id]);
};

export const getByDni = async (pDni) => {
  const query = "SELECT * FROM users WHERE dni = ?";
  const [rows] = await db.query(query, [pDni]);
  return rows;
};

export const getByDniSinPass = async (pDni) => {
  const query =
    "SELECT id, dni, nombre, apellido, genero, edad, role_id FROM users WHERE dni = ?";
  const [rows] = await db.query(query, [pDni]);
  return rows;
};

export const getById = async (pId) => {
  const query = "SELECT * FROM users WHERE id = ?";
  const [rows] = await db.query(query, [pId]);
  return rows[0];
};

export const getAllRoles = async () => {
  const query = "SELECT * FROM roles";
  const [rows] = await db.query(query);
  return rows;
};

export const updateUserInDb = async (
  id,
  dni,
  nombre,
  apellido,
  genero,
  edad,
  role_id,
  firmaUrl = null
) => {
  let query, params;
  if (firmaUrl) {
    query =
      "UPDATE users SET dni = ?, nombre = ?, apellido = ?, genero = ?, edad = ?, role_id = ?, firma = ? WHERE id = ?";
    params = [dni, nombre, apellido, genero, edad, role_id, firmaUrl, id];
  } else {
    query =
      "UPDATE users SET dni = ?, nombre = ?, apellido = ?, genero = ? , edad = ? , role_id = ? WHERE id = ?";
    params = [dni, nombre, apellido, genero, edad, role_id, id];
  }
  await db.query(query, params);
};

// Actualizar contraseña de un usuario por DNI
export const updatePasswordByDNI = async (dni, newPassword) => {
  const query = `
        UPDATE users 
        SET password = ? 
        WHERE dni = ?
    `;
  await db.query(query, [newPassword, dni]);
};
