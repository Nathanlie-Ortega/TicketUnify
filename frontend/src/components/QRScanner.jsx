// src/components/QRScanner.jsx
import React, { useRef, useEffect, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import Button from './ui/Button';
import Modal from './ui/Modal';

export default function QRScanner({ onScanSuccess, onScanError, isOpen, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');

  // Start camera
  const startCamera = async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera if available
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
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  // Scan QR code from video
  const scanFromVideo = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // This is a simplified QR detection - in production, use a proper QR library
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // For now, we'll simulate QR detection
      // In a real app, you'd use libraries like 'qr-scanner' or 'jsqr'
      setTimeout(() => {
        // Simulate successful scan
        const mockTicketId = 'TICKET-' + Math.random().toString(36).substr(2, 9);
        onScanSuccess?.(mockTicketId);
      }, 1000);
    } catch (err) {
      console.error('Error scanning QR code:', err);
      onScanError?.('Failed to scan QR code');
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      // Simulate QR code detection from image
      setTimeout(() => {
        const mockTicketId = 'TICKET-' + Math.random().toString(36).substr(2, 9);
        onScanSuccess?.(mockTicketId);
      }, 500);
    };
    reader.readAsDataURL(file);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
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
            <Button onClick={scanFromVideo} className="flex-1">
              Scan QR Code
            </Button>
          )}

          <div className="flex-1">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="outline" className="w-full">
                <Upload size={16} className="mr-2" />
                Upload Image
              </Button>
            </label>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600 space-y-2">
          <p>• Point your camera at the QR code on the ticket</p>
          <p>• Make sure the QR code is clearly visible and well-lit</p>
          <p>• Alternatively, upload an image of the QR code</p>
        </div>
      </div>
    </Modal>
  );
}