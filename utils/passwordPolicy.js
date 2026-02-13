function validatePasswordPolicy(password) {
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10);
  if (!password || typeof password !== 'string') {
    throw new Error('Passwort ist erforderlich');
  }
  if (password.length < minLength) {
    throw new Error(`Passwort muss mindestens ${minLength} Zeichen lang sein`);
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Passwort muss mindestens einen Kleinbuchstaben enthalten');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Passwort muss mindestens einen Großbuchstaben enthalten');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Passwort muss mindestens eine Zahl enthalten');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Passwort muss mindestens ein Sonderzeichen enthalten');
  }
  return true;
}

module.exports = {
  validatePasswordPolicy,
};
