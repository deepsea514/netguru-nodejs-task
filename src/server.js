const express = require("express");
const mongoose = require('mongoose');
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const { authFactory, AuthError, users } = require("./auth");
const Movie = require('./model/movie');

const PORT = 3000;
const {
    JWT_SECRET,
    DB_USER,
    DB_PASSWORD,
    DB_HOST,
    DB_PORT,
    DB_NAME,
    OMDB_API_KEY
} = process.env;

if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET env var. Set it and restart the server");
}

const auth = authFactory(JWT_SECRET);
const app = express();

app.use(bodyParser.json());

mongoose.Promise = global.Promise;
mongoose.connect(`mongodb://${DB_HOST}:${DB_PORT}/${DB_NAME}`, {
    authSource: 'admin', user: DB_USER, pass: DB_PASSWORD
}).then(async () => {
    console.info('Using database:', DB_NAME);
}).catch(console.error);

app.post("/auth", (req, res, next) => {
    if (!req.body) {
        return res.status(400).json({ error: "invalid payload" });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "invalid payload" });
    }

    try {
        const token = auth(username, password);

        return res.status(200).json({ token });
    } catch (error) {
        if (error instanceof AuthError) {
            return res.status(401).json({ error: error.message });
        }

        next(error);
    }
});

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split('Bearer ')[1];
        jwt.verify(token, JWT_SECRET, async (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            const _user = users.find(_user => _user.id == user.userId);
            if (_user) {
                req.user = _user;
                return next();
            }
            return res.sendStatus(403);
        });
    } else {
        res.sendStatus(401);
    }
};

app.use((error, _, res, __) => {
    console.error(
        `Error processing request ${error}. See next message for details`
    );
    console.error(error);

    return res.status(500).json({ error: "internal server error" });
});

app.post(
    '/movies',
    authenticateJWT,
    async (req, res) => {
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'title field is required.' });
        }
        try {
            const user = req.user;
            if (user.role == "basic") {
                const today = new Date();
                const count = await Movie.find({
                    user: user.id,
                    createdAt: { $gte: new Date(today.getFullYear(), today.getMonth(), 1) }
                }).count();
                if (count >= 5) {
                    return res.status(400).json({ error: 'basic user can make only 5 times.' });
                }
            }
            const { data } = await axios.get('https://www.omdbapi.com/', {
                params: {
                    apikey: OMDB_API_KEY,
                    t: title
                }
            });
            await Movie.findOneAndUpdate(
                { imdbID: data.imdbID }, {
                user: user.id,
                Title: data.Title,
                Released: data.Released,
                Genre: data.Genre,
                Director: data.Director,
                imdbID: data.imdbID
            }, { upsert: true });

            return res.json({
                success: true, data: {
                    Title: data.Title,
                    Released: data.Released,
                    Genre: data.Genre,
                    Director: data.Director,
                }
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal Server Error." });
        }
    }
)

app.get(
    '/movies',
    async (req, res) => {
        try {
            const movies = await Movie.find().select(['Title', 'Released', 'Genre', 'Director']);
            return res.json(movies);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal Server Error." });
        }
    }
)

app.listen(PORT, () => {
    console.log(`auth svc running at port ${PORT}`);
});
