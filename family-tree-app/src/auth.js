const crypto = require('crypto');
const db = require('./database');

const COOKIE_NAME = 'family_tree_auth';
const SESSION_DAYS = 7;
const SECRET = process.env.SESSION_SECRET || 'change-this-secret-for-production';

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
    if (!storedHash || !storedHash.includes(':')) {
        return false;
    }

    const [salt, hash] = storedHash.split(':');
    const attemptedHash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    const storedBuffer = Buffer.from(hash, 'hex');
    const attemptedBuffer = Buffer.from(attemptedHash, 'hex');
    return storedBuffer.length === attemptedBuffer.length && crypto.timingSafeEqual(storedBuffer, attemptedBuffer);
};

const sign = (value) => {
    return crypto.createHmac('sha256', SECRET).update(value).digest('hex');
};

const createToken = (userId) => {
    const payload = Buffer.from(JSON.stringify({
        userId,
        expiresAt: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
    })).toString('base64url');

    return `${payload}.${sign(payload)}`;
};

const readCookie = (req, name) => {
    const cookies = (req.headers.cookie || '').split(';').map((cookie) => cookie.trim());
    const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
};

const verifyToken = (token) => {
    if (!token || !token.includes('.')) {
        return null;
    }

    const [payload, signature] = token.split('.');
    const expectedSignature = sign(payload);

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
    }

    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!session.userId || session.expiresAt < Date.now()) {
            return null;
        }
        return session;
    } catch (error) {
        return null;
    }
};

const splitDisplayName = (name) => {
    const parts = name.trim().split(/\s+/);
    const firstName = parts.shift() || 'Me';
    const lastName = parts.join(' ') || 'Profile';
    return { firstName, lastName };
};

const ensureSelfMember = async (user) => {
    if (!user) {
        return null;
    }

    if (user.self_member_id) {
        const existingSelf = await db.get(
            'SELECT id FROM family_members WHERE id = ? AND user_id = ?',
            [user.self_member_id, user.id]
        );

        if (existingSelf) {
            return user;
        }
    }

    const { firstName, lastName } = splitDisplayName(user.name);
    const result = await db.run(
        `INSERT INTO family_members (user_id, first_name, last_name)
        VALUES (?, ?, ?)`,
        [user.id, firstName, lastName]
    );

    await db.run(
        'UPDATE users SET self_member_id = ? WHERE id = ?',
        [result.lastID, user.id]
    );

    return {
        ...user,
        self_member_id: result.lastID
    };
};

const attachCurrentUser = async (req, res, next) => {
    try {
        const token = readCookie(req, COOKIE_NAME);
        const session = verifyToken(token);

        req.currentUser = null;
        res.locals.currentUser = null;

        if (session) {
            req.currentUser = await db.get('SELECT id, name, email, self_member_id FROM users WHERE id = ?', [session.userId]);
            req.currentUser = await ensureSelfMember(req.currentUser);
            res.locals.currentUser = req.currentUser;
        }

        next();
    } catch (error) {
        next(error);
    }
};

const requireAuth = (req, res, next) => {
    if (!req.currentUser) {
        return res.redirect('/login');
    }

    next();
};

const redirectIfAuthenticated = (req, res, next) => {
    if (req.currentUser) {
        return res.redirect('/');
    }

    next();
};

const loginUser = (res, userId) => {
    const token = createToken(userId);
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
    });
};

const logoutUser = (res) => {
    res.clearCookie(COOKIE_NAME);
};

module.exports = {
    hashPassword,
    verifyPassword,
    ensureSelfMember,
    attachCurrentUser,
    requireAuth,
    redirectIfAuthenticated,
    loginUser,
    logoutUser
};
