const mongoose = require('mongoose');

const { Schema } = mongoose;

const MovieSchema = new Schema(
    {
        user: { type: Number, required: true },
        Title: { type: String, required: true },
        Released: { type: String, required: true },
        Genre: { type: String, required: true },
        Director: { type: String, required: true },
        imdbID: { type: String, required: true, index: { unique: true } }
    },
    { timestamps: true, },
);

const Movie = mongoose.model('Movie', MovieSchema);

module.exports = Movie;