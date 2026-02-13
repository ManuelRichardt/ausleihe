class AuthSessionService {
  async login(req, user) {
    if (!req || !req.session) {
      throw new Error('Session is not available');
    }
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          return reject(err);
        }
        req.session.userId = user.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            return reject(saveErr);
          }
          return resolve(true);
        });
      });
    });
  }

  async logout(req) {
    if (!req || !req.session) {
      return true;
    }
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          return reject(err);
        }
        return resolve(true);
      });
    });
  }

  getUserId(req) {
    if (!req || !req.session) {
      return null;
    }
    return req.session.userId || null;
  }
}

module.exports = AuthSessionService;
