// services/storageService.js
const { getStorage } = require('../utils/firebase-admin');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Storage configuration
const STORAGE_CONFIG = {
  bucketName: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  folders: {
    avatars: 'uploads/avatars',
    tickets: 'uploads/tickets', 
    pdfs: 'uploads/pdfs',
    temp: 'uploads/temp'
  }
};

// @desc    Upload file to Firebase Storage
const uploadFile = async (buffer, filename, options = {}) => {
  try {
    const startTime = Date.now();
    const bucket = getStorage().bucket();
    
    const {
      folder = 'temp',
      contentType = 'application/octet-stream',
      metadata = {},
      makePublic = true
    } = options;

    // Generate unique filename if not provided
    const finalFilename = filename || `${uuidv4()}-${Date.now()}`;
    const filePath = `${STORAGE_CONFIG.folders[folder] || folder}/${finalFilename}`;
    
    const file = bucket.file(filePath);
    
    // Upload file
    await file.save(buffer, {
      metadata: {
        contentType,
        metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          originalSize: buffer.length
        }
      },
      resumable: false
    });

    // Make file public if requested
    if (makePublic) {
      await file.makePublic();
    }

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${STORAGE_CONFIG.bucketName}/${filePath}`;

    logger.logPerformance('file_upload', Date.now() - startTime, {
      filename: finalFilename,
      size: buffer.length,
      folder
    });

    logger.info('File uploaded successfully', {
      filename: finalFilename,
      size: `${(buffer.length / 1024).toFixed(2)}KB`,
      url: publicUrl,
      folder
    });

    return {
      filename: finalFilename,
      path: filePath,
      url: publicUrl,
      size: buffer.length,
      contentType,
      folder
    };

  } catch (error) {
    logger.error('Error uploading file to storage:', {
      error: error.message,
      filename,
      options
    });
    throw new Error(`File upload failed: ${error.message}`);
  }
};

// @desc    Upload and process image
const uploadImage = async (buffer, options = {}) => {
  try {
    const startTime = Date.now();
    
    const {
      folder = 'avatars',
      resize = { width: 800, height: 800 },
      quality = 90,
      generateThumbnail = true,
      thumbnailSize = { width: 150, height: 150 }
    } = options;

    // Process main image
    const processedBuffer = await sharp(buffer)
      .resize(resize.width, resize.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    // Generate unique filename
    const filename = `${uuidv4()}.jpg`;
    
    // Upload main image
    const mainImage = await uploadFile(processedBuffer, filename, {
      folder,
      contentType: 'image/jpeg',
      metadata: {
        processed: true,
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        dimensions: resize
      }
    });

    let thumbnail = null;
    if (generateThumbnail) {
      // Generate thumbnail
      const thumbnailBuffer = await sharp(buffer)
        .resize(thumbnailSize.width, thumbnailSize.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Upload thumbnail
      const thumbnailFilename = `thumb_${filename}`;
      thumbnail = await uploadFile(thumbnailBuffer, thumbnailFilename, {
        folder: `${folder}/thumbnails`,
        contentType: 'image/jpeg',
        metadata: {
          thumbnail: true,
          parentFile: filename,
          dimensions: thumbnailSize
        }
      });
    }

    logger.logPerformance('image_upload_processing', Date.now() - startTime, {
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      compressionRatio: ((buffer.length - processedBuffer.length) / buffer.length * 100).toFixed(2) + '%'
    });

    return {
      main: mainImage,
      thumbnail,
      metadata: {
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        processingTime: Date.now() - startTime
      }
    };

  } catch (error) {
    logger.error('Error uploading and processing image:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

// @desc    Delete file from storage
const deleteFile = async (filePath) => {
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn(`File does not exist: ${filePath}`);
      return { success: false, message: 'File not found' };
    }

    // Delete file
    await file.delete();
    
    logger.info('File deleted successfully', { filePath });
    
    return { success: true, message: 'File deleted successfully' };

  } catch (error) {
    logger.error('Error deleting file:', {
      error: error.message,
      filePath
    });
    throw new Error(`File deletion failed: ${error.message}`);
  }
};

// @desc    Get file metadata
const getFileMetadata = async (filePath) => {
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    
    const [metadata] = await file.getMetadata();
    
    return {
      name: metadata.name,
      size: parseInt(metadata.size),
      contentType: metadata.contentType,
      created: metadata.timeCreated,
      updated: metadata.updated,
      md5Hash: metadata.md5Hash,
      crc32c: metadata.crc32c,
      customMetadata: metadata.metadata || {}
    };

  } catch (error) {
    logger.error('Error getting file metadata:', error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
};

// @desc    Generate signed URL for private file access
const generateSignedUrl = async (filePath, expirationTime = 60) => {
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    
    const options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + expirationTime * 60 * 1000, // Convert minutes to milliseconds
    };

    const [url] = await file.getSignedUrl(options);
    
    logger.info('Signed URL generated', {
      filePath,
      expiresIn: `${expirationTime} minutes`
    });
    
    return {
      url,
      expiresAt: new Date(Date.now() + expirationTime * 60 * 1000).toISOString()
    };

  } catch (error) {
    logger.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

// @desc    Copy file to different location
const copyFile = async (sourcePath, destinationPath) => {
  try {
    const bucket = getStorage().bucket();
    const sourceFile = bucket.file(sourcePath);
    const destinationFile = bucket.file(destinationPath);
    
    await sourceFile.copy(destinationFile);
    
    logger.info('File copied successfully', {
      from: sourcePath,
      to: destinationPath
    });
    
    return {
      success: true,
      sourcePath,
      destinationPath
    };

  } catch (error) {
    logger.error('Error copying file:', error);
    throw new Error(`File copy failed: ${error.message}`);
  }
};

// @desc    List files in a folder
const listFiles = async (folderPath, options = {}) => {
  try {
    const bucket = getStorage().bucket();
    const { maxResults = 100, pageToken } = options;
    
    const [files, nextQuery] = await bucket.getFiles({
      prefix: folderPath,
      maxResults,
      pageToken
    });
    
    const fileList = files.map(file => ({
      name: file.name,
      size: file.metadata.size ? parseInt(file.metadata.size) : 0,
      contentType: file.metadata.contentType,
      created: file.metadata.timeCreated,
      updated: file.metadata.updated
    }));
    
    return {
      files: fileList,
      hasMore: !!nextQuery,
      nextPageToken: nextQuery?.pageToken
    };

  } catch (error) {
    logger.error('Error listing files:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
};

// @desc    Upload PDF document
const uploadPDF = async (buffer, filename, metadata = {}) => {
  try {
    return await uploadFile(buffer, filename, {
      folder: 'pdfs',
      contentType: 'application/pdf',
      metadata: {
        ...metadata,
        documentType: 'pdf',
        pages: metadata.pages || 'unknown'
      }
    });

  } catch (error) {
    logger.error('Error uploading PDF:', error);
    throw new Error(`PDF upload failed: ${error.message}`);
  }
};

// @desc    Clean up old temporary files
const cleanupTempFiles = async (olderThanHours = 24) => {
  try {
    const startTime = Date.now();
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const { files } = await listFiles(STORAGE_CONFIG.folders.temp);
    
    let deletedCount = 0;
    const deletePromises = files
      .filter(file => new Date(file.created) < cutoffTime)
      .map(async (file) => {
        try {
          await deleteFile(file.name);
          deletedCount++;
        } catch (error) {
          logger.warn(`Failed to delete temp file ${file.name}:`, error);
        }
      });

    await Promise.all(deletePromises);
    
    logger.info('Temp files cleanup completed', {
      deletedCount,
      olderThanHours,
      processingTime: Date.now() - startTime
    });
    
    return {
      deletedCount,
      olderThanHours,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error during temp files cleanup:', error);
    throw new Error(`Cleanup failed: ${error.message}`);
  }
};

// @desc    Get storage usage statistics
const getStorageStats = async () => {
  try {
    const stats = {
      folders: {},
      total: { files: 0, size: 0 }
    };

    // Get stats for each folder
    for (const [folderName, folderPath] of Object.entries(STORAGE_CONFIG.folders)) {
      try {
        const { files } = await listFiles(folderPath, { maxResults: 1000 });
        
        const folderStats = {
          files: files.length,
          size: files.reduce((total, file) => total + file.size, 0)
        };
        
        stats.folders[folderName] = folderStats;
        stats.total.files += folderStats.files;
        stats.total.size += folderStats.size;
        
      } catch (error) {
        logger.warn(`Error getting stats for folder ${folderName}:`, error);
        stats.folders[folderName] = { files: 0, size: 0, error: error.message };
      }
    }

    // Convert sizes to human readable format
    const formatSize = (bytes) => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Add formatted sizes
    Object.values(stats.folders).forEach(folder => {
      if (!folder.error) {
        folder.sizeFormatted = formatSize(folder.size);
      }
    });
    stats.total.sizeFormatted = formatSize(stats.total.size);

    return stats;

  } catch (error) {
    logger.error('Error getting storage statistics:', error);
    throw new Error(`Failed to get storage stats: ${error.message}`);
  }
};

// @desc    Health check for storage service
const healthCheck = async () => {
  try {
    const bucket = getStorage().bucket();
    
    // Test with a small file upload and delete
    const testData = Buffer.from('test-health-check');
    const testFilename = `health-check-${Date.now()}.txt`;
    
    const startTime = Date.now();
    
    // Upload test file
    const uploadResult = await uploadFile(testData, testFilename, {
      folder: 'temp',
      contentType: 'text/plain',
      makePublic: false
    });
    
    // Delete test file
    await deleteFile(uploadResult.path);
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      bucket: bucket.name,
      testFileSize: testData.length
    };

  } catch (error) {
    logger.error('Storage health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

module.exports = {
  uploadFile,
  uploadImage,
  uploadPDF,
  deleteFile,
  getFileMetadata,
  generateSignedUrl,
  copyFile,
  listFiles,
  cleanupTempFiles,
  getStorageStats,
  healthCheck,
  STORAGE_CONFIG
};