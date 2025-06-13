const today =new Date().toISOString().replace('T', ' ').split('.')[0];  // Formato: YYYY-MM-DD HH:MM:SS

console.log(today);