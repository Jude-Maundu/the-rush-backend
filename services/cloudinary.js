const cloudinary = require('cloudinary').v2;
const { HttpError } = require('./http');

function getCloudinary() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new HttpError(503, 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend.');
    }

    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET
    });
    return cloudinary;
}

function uploadImage(buffer) {
    return new Promise((resolve, reject) => {
        const client = getCloudinary();
        const stream = client.uploader.upload_stream({
            folder: 'the-rush/cast-crew',
            resource_type: 'image'
        }, (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url || !result?.public_id) {
                return reject(new Error('Cloudinary did not return the uploaded image details.'));
            }
            resolve({ image: result.secure_url, image_public_id: result.public_id });
        });
        stream.end(buffer);
    });
}

async function deleteImage(publicId) {
    if (!publicId) return;
    const result = await getCloudinary().uploader.destroy(publicId, {
        invalidate: true,
        resource_type: 'image'
    });
    if (!['ok', 'not found'].includes(result.result)) {
        throw new Error(`Cloudinary could not remove image ${publicId}.`);
    }
}

module.exports = { uploadImage, deleteImage };
