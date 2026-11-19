const multer = require('multer');
const { HttpError } = require('../services/http');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(req, file, callback) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return callback(new HttpError(400, 'Choose a JPG, PNG, or WebP image.'));
        }
        callback(null, true);
    }
}).single('portrait');

function memberPortraitUpload(req, res, next) {
    upload(req, res, error => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Portrait images must be 5 MB or smaller.'
                : 'The portrait upload could not be processed.';
            return next(new HttpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message));
        }
        next(error);
    });
}

module.exports = { memberPortraitUpload };
