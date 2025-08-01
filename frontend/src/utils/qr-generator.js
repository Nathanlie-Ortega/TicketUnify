// src/utils/qr-generator.js
import QRCode from 'qrcode';

export class QRGenerator {
  constructor() {
    this.defaultOptions = {
      width: 200,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    };
  }

  async generateQRCode(data, options = {}) {
    try {
      const mergedOptions = { ...this.defaultOptions, ...options };
      return await QRCode.toDataURL(data, mergedOptions);
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  async generateTicketQR(ticketId, options = {}) {
    const ticketUrl = `${window.location.origin}/ticket/${ticketId}`;
    return this.generateQRCode(ticketUrl, options);
  }

  async generateValidationQR(ticketId, options = {}) {
    const validationData = {
      id: ticketId,
      timestamp: Date.now(),
      type: 'ticket_validation'
    };
    return this.generateQRCode(JSON.stringify(validationData), options);
  }

  async generateToCanvas(canvasElement, data, options = {}) {
    try {
      const mergedOptions = { ...this.defaultOptions, ...options };
      await QRCode.toCanvas(canvasElement, data, mergedOptions);
    } catch (error) {
      console.error('Error generating QR code to canvas:', error);
      throw error;
    }
  }
}

export const qrGenerator = new QRGenerator();
