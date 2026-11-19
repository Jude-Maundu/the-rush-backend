require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { isConfigured } = require('./services/supabase');
const { HttpError } = require('./services/http');
const userRoutes = require('./routes/UserRoutes');
const movieRoutes = require('./routes/MovieRoutes');
const reviewRoutes = require('./routes/ReviewRoutes');
const adminRoutes = require('./routes/AdminRoutes');
const memberRoutes = require('./routes/MemberRoutes');

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || 'https://the-rush-9513.onrender.com')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

function isLocalDevelopmentOrigin(origin) {
    try {
        const url = new URL(origin);
        return url.protocol === 'http:'
            && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch {
        return false;
    }
}

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin(origin)) {
            return callback(null, true);
        }
        callback(new HttpError(403, 'This origin is not allowed by the API.'));
    }
}));
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (req, res) => {
    res.json({ ok: true, supabaseConfigured: isConfigured() });
});
app.use('/api', userRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/members', memberRoutes);

app.use((req, res) => {
    res.status(404).json({ error: 'API route not found.' });
});

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
        error: status >= 500 ? 'The server could not complete the request.' : error.message
    });
});

const port = Number(process.env.PORT) || 5000;
app.listen(port, () => {
    console.log(`Movie API listening on port ${port} (Supabase ${isConfigured() ? 'configured' : 'not configured'}).`);
});