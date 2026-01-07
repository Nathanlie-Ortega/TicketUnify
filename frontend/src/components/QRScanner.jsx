// src/components/QRScanner.jsx - WITH REAL QR CODE SCANNING
import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Upload, X } from 'lucide-react';
import Button from './ui/Button';
import Modal from './ui/Modal';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export default function QRScanner({ onScanSuccess, onScanError, isOpen, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const scanIntervalRef = useRef(null);

  // Start camera
  const startCamera = async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setStream(mediaStream);
      setIsScanning(true);
      
      // Start scanning loop
      scanIntervalRef.current = setInterval(scanFromVideo, 100);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  // Scan QR code from video - REAL SCANNING
  const scanFromVideo = () => {
  if (!videoRef.current || !canvasRef.current || !isScanning) return;

  const video = videoRef.current;
  const canvas = canvasRef.current;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

  // Use full resolution for better QR detection
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  
  // Try with more aggressive detection options
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth", // Try both normal and inverted
  });

  if (code) {
    console.log('✅ QR Code detected from camera:', code.data);
    
    // Extract ticket ID from URL
    const ticketId = extractTicketId(code.data);
    
    if (ticketId) {
      console.log('✅ Extracted ticket ID:', ticketId);
      stopCamera();
      onScanSuccess?.(ticketId);
    } else {
      console.warn('⚠️ Could not extract ticket ID from QR:', code.data);
    }
  }
};




  // Extract ticket ID from QR code data
  const extractTicketId = (qrData) => {
    try {
      // QR code contains URL like: http://localhost:3000/validate/TICKET-91TZVY
      if (qrData.includes('/validate/')) {
        const parts = qrData.split('/validate/');
        return parts[1];
      }
      
      // Or just the ticket ID directly
      if (qrData.startsWith('TICKET-') || qrData.startsWith('#TICKET-')) {
        return qrData.replace('#', '');
      }
      
      return qrData;
    } catch (error) {
      console.error('Error extracting ticket ID:', error);
      return null;
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  console.log('📁 File selected:', file.name, file.type);

  // Check if it's a PDF
  if (file.type === 'application/pdf') {
    await handlePDFUpload(file);
  } else {
    await handleImageUpload(file);
  }
};

// ADD THIS NEW FUNCTION - Handle IMAGE upload
const handleImageUpload = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          console.log('✅ QR Code from image:', code.data);
          const ticketId = extractTicketId(code.data);
          
          if (ticketId) {
            onScanSuccess?.(ticketId);
            resolve(true);
          } else {
            onScanError?.('Could not read ticket ID from QR code');
            resolve(false);
          }
        } else {
          onScanError?.('No QR code found in image');
          resolve(false);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

//Handle PDF upload
const handlePDFUpload = async (file) => {
  try {
    console.log('📄 Processing PDF...');
    
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    console.log('✅ PDF loaded, pages:', pdf.numPages);
    
    const page = await pdf.getPage(1);
    
    // Try multiple scales to improve QR detection
    const scales = [4.0, 3.0, 2.0];
    
    for (const scale of scales) {
      console.log(`🎨 Trying scale ${scale}...`);
      
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      console.log('✅ PDF rendered, scanning for QR code...');

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Try with different jsQR options
      let code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth", // Try both normal and inverted
      });

      if (code) {
        console.log('✅ QR Code from PDF found at scale', scale, ':', code.data);
        const ticketId = extractTicketId(code.data);
        
        if (ticketId) {
          console.log('✅ Ticket ID extracted:', ticketId);
          onScanSuccess?.(ticketId);
          return; // Success!
        }
      }
      
      console.log(`❌ No QR code found at scale ${scale}, trying next...`);
    }
    
    // If we get here, no QR code was found at any scale
    console.error('❌ No QR code found in PDF after trying all scales');
    onScanError?.('No QR code found in PDF. Make sure the QR code is clearly visible.');
    
  } catch (error) {
    console.error('❌ Error processing PDF:', error);
    onScanError?.(`Failed to process PDF: ${error.message}`);
  }
};


  



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start camera when modal opens
useEffect(() => {
  if (!isOpen) {
    stopCamera();
  }
  // Removed auto-start
}, [isOpen]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Scan QR Code"
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Camera View */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          
          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-white border-dashed w-64 h-64 rounded-lg">
                <div className="w-full h-full border-4 border-blue-500 rounded-lg animate-pulse" />
              </div>
            </div>
          )}

          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
              <div className="text-center text-white">
                <Camera size={48} className="mx-auto mb-2 opacity-50" />
                <p>Camera not active</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for QR processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isScanning ? (
            <Button onClick={startCamera} className="flex-1">
              <Camera size={16} className="mr-2" />
              Start Camera
            </Button>
          ) : (
            <Button onClick={stopCamera} variant="outline" className="flex-1">
              Stop Scanning
            </Button>
          )}

          <div className="flex-1">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload-input"
            />
            <label htmlFor="file-upload-input" className="block cursor-pointer">
              <div className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium text-sm flex items-center justify-center transition-colors">
                <Upload size={16} className="mr-2" />
                Upload File
              </div>
            </label>
          </div>


        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600 space-y-2">
          <p>• Point your camera at the QR code on the ticket</p>
          <p>• Make sure the QR code is clearly visible and well-lit</p>
          <p>• Alternatively, upload an image or PDF of the QR code</p>
        </div>
      </div>
    </Modal>
  );
}