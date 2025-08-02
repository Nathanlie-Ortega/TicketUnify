// services/qrService.js
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// QR Code generation options
const qrOptions = {
  errorCorrectionLevel: 'M',
  type: 'image/png',
  quality: 0.92,
  margin: 1,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  },
  width: 256
};

// Generate QR code for ticket
const generateTicketQR = async (ticketId, options = {}) => {
  try {
    const startTime = Date.now();
    
    // Create QR code data - could be just the ticket ID or a full URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrData = options.useUrl ? 
      `${baseUrl}/verify/${ticketId}` : 
      ticketId;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      ...qrOptions,
      ...options
    });

    // Also generate as buffer for other uses
    const qrCodeBuffer = await QRCode.toBuffer(qrData, {
      ...qrOptions,
      ...options
    });

    logger.logPerformance('qr_generation', Date.now() - startTime, {
      ticketId,
      dataSize: qrCodeBuffer.length
    });

    logger.info('QR code generated successfully', {
      ticketId,
      qrSize: `${(qrCodeBuffer.length / 1024).toFixed(2)}KB`,
      generationTime: `${Date.now() - startTime}ms`
    });

    return {
      dataUrl: qrCodeDataUrl,
      buffer: qrCodeBuffer,
      text: qrData,
      size: qrCodeBuffer.length
    };

  } catch (error) {
    logger.error('Error generating QR code:', {
      error: error.message,
      ticketId,
      options
    });
    throw new Error('Failed to generate QR code');
  }
};

// Generate QR code with custom styling
const generateStyledQR = async (ticketId, style = {}) => {
  try {
    const customOptions = {
      ...qrOptions,
      width: style.size || 256,
      margin: style.margin || 1,
      color: {
        dark: style.foreground || '#000000',
        light: style.background || '#FFFFFF'
      }
    };

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrData = `${baseUrl}/verify/${ticketId}`;

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, customOptions);
    const qrCodeBuffer = await QRCode.toBuffer(qrData, customOptions);

    return {
      dataUrl: qrCodeDataUrl,
      buffer: qrCodeBuffer,
      text: qrData,
      style: customOptions
    };

  } catch (error) {
    logger.error('Error generating styled QR code:', error);
    throw new Error('Failed to generate styled QR code');
  }
};

// Generate QR code as SVG
const generateQRSVG = async (ticketId, options = {}) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrData = options.useUrl ? 
      `${baseUrl}/verify/${ticketId}` : 
      ticketId;

    const svgString = await QRCode.toString(qrData, {
      type: 'svg',
      width: options.width || 256,
      margin: options.margin || 1,
      color: {
        dark: options.foreground || '#000000',
        light: options.background || '#FFFFFF'
      }
    });

    return {
      svg: svgString,
      text: qrData
    };

  } catch (error) {
    logger.error('Error generating QR SVG:', error);
    throw new Error('Failed to generate QR SVG');
  }
};

// Batch generate QR codes for multiple tickets
const generateBatchQR = async (ticketIds, options = {}) => {
  try {
    const startTime = Date.now();
    const results = [];

    for (const ticketId of ticketIds) {
      try {
        const qrResult = await generateTicketQR(ticketId, options);
        results.push({
          ticketId,
          success: true,
          ...qrResult
        });
      } catch (error) {
        logger.warn(`Failed to generate QR for ticket ${ticketId}:`, error);
        results.push({
          ticketId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logger.logPerformance('batch_qr_generation', Date.now() - startTime, {
      totalTickets: ticketIds.length,
      successful: successCount,
      failed: failureCount
    });

    return {
      results,
      summary: {
        total: ticketIds.length,
        successful: successCount,
        failed: failureCount
      }
    };

  } catch (error) {
    logger.error('Error in batch QR generation:', error);
    throw new Error('Failed to generate batch QR codes');
  }
};

// Validate QR code data
const validateQRData = (qrData) => {
  try {
    // Check if it's a URL
    if (qrData.startsWith('http')) {
      const url = new URL(qrData);
      const pathParts = url.pathname.split('/');
      
      // Extract ticket ID from URL path
      if (pathParts.includes('verify') && pathParts.length >= 3) {
        const ticketIdIndex = pathParts.indexOf('verify') + 1;
        return {
          isValid: true,
          ticketId: pathParts[ticketIdIndex],
          format: 'url'
        };
      }
    }
    
    // Check if it's a direct ticket ID (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(qrData)) {
      return {
        isValid: true,
        ticketId: qrData,
        format: 'id'
      };
    }

    return {
      isValid: false,
      error: 'Invalid QR data format'
    };

  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
};

// Parse QR code from image buffer (for scanning)
const parseQRFromImage = async (imageBuffer) => {
  try {
    // Note: This would require a QR code scanning library like jsQR
    // For now, we'll return a placeholder implementation
    logger.warn('QR code parsing from image not implemented - requires jsQR library');
    
    return {
      success: false,
      error: 'QR code parsing from image not implemented'
    };

  } catch (error) {
    logger.error('Error parsing QR from image:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate verification URL for ticket
const generateVerificationUrl = (ticketId) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/verify/${ticketId}`;
};

// Generate scanner URL for admin/staff
const generateScannerUrl = () => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/scanner`;
};

// Health check for QR service
const healthCheck = async () => {
  try {
    const testTicketId = 'test-health-check-' + Date.now();
    const startTime = Date.now();
    
    const qrResult = await generateTicketQR(testTicketId);
    const responseTime = Date.now() - startTime;

    // Validate the generated QR
    const validation = validateQRData(qrResult.text);

    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      qrSize: `${(qrResult.size / 1024).toFixed(2)}KB`,
      validation: validation.isValid ? 'passed' : 'failed'
    };

  } catch (error) {
    logger.error('QR service health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Generate QR code with logo/branding
const generateBrandedQR = async (ticketId, logoOptions = {}) => {
  try {
    // This is a simplified version - for advanced branding, you'd need additional libraries
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrData = `${baseUrl}/verify/${ticketId}`;

    // Generate with higher error correction for logo overlay
    const brandedOptions = {
      ...qrOptions,
      errorCorrectionLevel: 'H', // High error correction for logo overlay
      width: logoOptions.size || 300,
      margin: logoOptions.margin || 2,
      color: {
        dark: logoOptions.foreground || '#4f46e5',
        light: logoOptions.background || '#FFFFFF'
      }
    };

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, brandedOptions);
    const qrCodeBuffer = await QRCode.toBuffer(qrData, brandedOptions);

    // Note: Logo overlay would require additional image processing
    // This could be implemented using canvas or sharp for more advanced branding

    return {
      dataUrl: qrCodeDataUrl,
      buffer: qrCodeBuffer,
      text: qrData,
      branded: true,
      logoOptions
    };

  } catch (error) {
    logger.error('Error generating branded QR code:', error);
    throw new Error('Failed to generate branded QR code');
  }
};

module.exports = {
  generateTicketQR,
  generateStyledQR,
  generateQRSVG,
  generateBatchQR,
  generateBrandedQR,
  validateQRData,
  parseQRFromImage,
  generateVerificationUrl,
  generateScannerUrl,
  healthCheck
};