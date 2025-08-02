// middleware/upload.js
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { uploadToStorage } = require('../utils/firebase-admin');
const { createValidationError, asyncHandler } = require('./errorHandler');
const logger = require('../utils/logger');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    // Allowed image types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createValidationError('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
    }
  } else {
    cb(createValidationError('Only image files are allowed'), false);
  }
};

// Basic multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 1,
    fields: 10,
    fieldNameSize: 50,
    fieldSize: 1024,
    headerPairs: 20
  },
  fileFilter: fileFilter
});

// Error handling for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.warn('Multer error:', {
      error: err.message,
      code: err.code,
      field: err.field,
      endpoint: req.originalUrl,
      ip: req.ip
    });

    let message = 'File upload error';
    let code = 'UPLOAD_ERROR';

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size is 5MB';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Only 1 file allowed';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        code = 'UNEXPECTED_FILE';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many form parts';
        code = 'TOO_MANY_PARTS';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        code = 'FIELD_NAME_TOO_LONG';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        code = 'FIELD_VALUE_TOO_LONG';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        code = 'TOO_MANY_FIELDS';
        break;
    }

    return res.status(400).json({
      success: false,
      error: message,
      code: code
    });
  }
  
  next(err);
};

// Image processing middleware
const processImage = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const startTime = Date.now();
    
    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const fileName = `${uuidv4()}${fileExtension}`;
    
    // Process image with sharp
    let processedBuffer;
    const metadata = await sharp(req.file.buffer).metadata();
    
    logger.info('Processing image:', {
      originalName: req.file.originalname,
      size: req.file.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    });

    // Resize and optimize image
    if (metadata.width > 800 || metadata.height > 800) {
      // Resize large images
      processedBuffer = await sharp(req.file.buffer)
        .resize(800, 800, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();
    } else {
      // Just optimize smaller images
      processedBuffer = await sharp(req.file.buffer)
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();
    }

    // Create thumbnail
    const thumbnailBuffer = await sharp(req.file.buffer)
      .resize(150, 150, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Add processed data to request
    req.processedFile = {
      original: {
        buffer: processedBuffer,
        filename: fileName,
        mimetype: 'image/jpeg',
        size: processedBuffer.length
      },
      thumbnail: {
        buffer: thumbnailBuffer,
        filename: `thumb_${fileName}`,
        mimetype: 'image/jpeg',
        size: thumbnailBuffer.length
      },
              metadata: {
        originalName: req.file.originalname,
        originalSize: req.file.size,
        processedSize: processedBuffer.length,
        thumbnailSize: thumbnailBuffer.length,
        dimensions: {
          width: metadata.width,
          height: metadata.height
        },
        processingTime: Date.now() - startTime
      }
    };

    logger.logPerformance('image_processing', Date.now() - startTime, {
      originalSize: req.file.size,
      processedSize: processedBuffer.length,
      compressionRatio: ((req.file.size - processedBuffer.length) / req.file.size * 100).toFixed(2) + '%'
    });

    next();
  } catch (error) {
    logger.error('Error processing image:', error);
    throw createValidationError('Failed to process image. Please try with a different image.');
  }
});

// Upload to Firebase Storage middleware
const uploadToFirebase = asyncHandler(async (req, res, next) => {
  if (!req.processedFile) {
    return next();
  }

  try {
    const startTime = Date.now();

    // Upload original image
    const originalUrl = await uploadToStorage(
      req.processedFile.original.buffer,
      `images/${req.processedFile.original.filename}`,
      req.processedFile.original.mimetype
    );

    // Upload thumbnail
    const thumbnailUrl = await uploadToStorage(
      req.processedFile.thumbnail.buffer,
      `thumbnails/${req.processedFile.thumbnail.filename}`,
      req.processedFile.thumbnail.mimetype
    );

    // Add URLs to request
    req.uploadedFiles = {
      original: {
        url: originalUrl,
        filename: req.processedFile.original.filename,
        size: req.processedFile.original.size
      },
      thumbnail: {
        url: thumbnailUrl,
        filename: req.processedFile.thumbnail.filename,
        size: req.processedFile.thumbnail.size
      },
      metadata: req.processedFile.metadata
    };

    logger.logPerformance('firebase_upload', Date.now() - startTime, {
      filesUploaded: 2,
      totalSize: req.processedFile.original.size + req.processedFile.thumbnail.size
    });

    logger.info('Files uploaded to Firebase Storage:', {
      originalUrl,
      thumbnailUrl,
      processingTime: req.processedFile.metadata.processingTime,
      uploadTime: Date.now() - startTime
    });

    next();
  } catch (error) {
    logger.error('Error uploading to Firebase Storage:', error);
    throw createValidationError('Failed to upload image. Please try again.');
  }
});

// Validation middleware for uploaded files
const validateUploadedFile = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  // Additional file validation
  const file = req.file;
  
  // Check file size again (just in case)
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw createValidationError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
  }

  // Check for malicious file types by examining file headers
  const fileHeader = file.buffer.slice(0, 4).toString('hex');
  const validHeaders = {
    'ffd8ffe0': 'image/jpeg',
    'ffd8ffe1': 'image/jpeg',
    'ffd8ffe2': 'image/jpeg',
    'ffd8ffe3': 'image/jpeg',
    'ffd8ffe8': 'image/jpeg',
    '89504e47': 'image/png',
    '47494638': 'image/gif',
    '52494646': 'image/webp'
  };

  const isValidHeader = Object.keys(validHeaders).some(header => 
    fileHeader.startsWith(header)
  );

  if (!isValidHeader) {
    logger.warn('Invalid file header detected:', {
      filename: file.originalname,
      mimetype: file.mimetype,
      header: fileHeader,
      ip: req.ip
    });
    throw createValidationError('Invalid file format detected');
  }

  // Check filename for suspicious patterns
  const suspiciousPatterns = [
    /\.php$/i,
    /\.jsp$/i,
    /\.asp$/i,
    /\.js$/i,
    /\.html$/i,
    /\.exe$/i,
    /\.bat$/i,
    /\.sh$/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
    logger.warn('Suspicious filename detected:', {
      filename: file.originalname,
      ip: req.ip
    });
    throw createValidationError('Invalid filename');
  }

  next();
});

// Cleanup middleware (removes temporary files if upload fails)
const cleanupOnError = (err, req, res, next) => {
  if (err && req.uploadedFiles) {
    // In a real implementation, you might want to delete uploaded files
    // For Firebase Storage, this would involve calling deleteFromStorage
    logger.warn('Upload failed, cleanup may be needed:', {
      error: err.message,
      uploadedFiles: req.uploadedFiles
    });
  }
  next(err);
};

// Complete upload chain middleware
const uploadChain = [
  upload.single('avatar'),
  handleMulterError,
  validateUploadedFile,
  processImage,
  uploadToFirebase,
  cleanupOnError
];

// Avatar-specific upload middleware
const uploadAvatar = [
  upload.single('avatar'),
  handleMulterError,
  validateUploadedFile,
  processImage,
  uploadToFirebase,
  cleanupOnError
];

// Multiple files upload (for future use)
const uploadMultiple = (fieldName, maxFiles = 5) => [
  upload.array(fieldName, maxFiles),
  handleMulterError,
  validateUploadedFile,
  // Note: processImage and uploadToFirebase would need modification for multiple files
  cleanupOnError
];

// Export configured upload middleware
module.exports = {
  // Basic upload instance
  upload,
  
  // Middleware functions
  handleMulterError,
  processImage,
  uploadToFirebase,
  validateUploadedFile,
  cleanupOnError,
  
  // Complete chains
  uploadChain,
  uploadAvatar,
  uploadMultiple,
  
  // Single middleware for simple usage
  single: (fieldName) => upload.single(fieldName),
  array: (fieldName, maxFiles) => upload.array(fieldName, maxFiles),
  fields: (fields) => upload.fields(fields),
  none: () => upload.none()
};