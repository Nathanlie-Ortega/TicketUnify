// src/components/TicketPreview.jsx
import React, { useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Calendar, MapPin, User, Ticket } from 'lucide-react';
import { format } from 'date-fns';

export default function TicketPreview({ ticketData, avatarFile, showDownload = false }) {
  const ticketRef = useRef(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Generate QR code and avatar preview
  React.useEffect(() => {
    const generateQRCode = async () => {
      try {
        const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const qr = await QRCode.toDataURL(ticketId, {
          width: 200,
          margin: 2,
          color: {
            dark: '#1f2937',
            light: '#ffffff'
          }
        });
        setQrCodeUrl(qr);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQRCode();
  }, [ticketData]);

  React.useEffect(() => {
    if (avatarFile) {
      const url = URL.createObjectURL(avatarFile);
      setAvatarPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAvatarPreview('');
    }
  }, [avatarFile]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'EEEE, MMMM do, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const downloadAsPDF = async () => {
    if (!ticketRef.current) return;
    
    setDownloading(true);
    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`${ticketData.eventName || 'conference'}-ticket.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const downloadAsImage = async () => {
    if (!ticketRef.current) return;
    
    setDownloading(true);
    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      const link = document.createElement('a');
      link.download = `${ticketData.eventName || 'conference'}-ticket.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ticket Preview</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This is how your ticket will look
        </p>
      </div>

      {/* Ticket Design */}
      <div
        ref={ticketRef}
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-lg mx-auto"
        style={{ aspectRatio: '1.4/1', minHeight: '320px' }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700">
          <div className="absolute inset-0 opacity-20">
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative p-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-white font-bold text-lg leading-tight mb-1">
                {ticketData.eventName || 'Event Name'}
              </h2>
              <div className="flex items-center text-blue-100 text-sm">
                <Calendar size={14} className="mr-1" />
                {formatDate(ticketData.eventDate) || 'Event Date'}
              </div>
            </div>
            
            {/* Avatar */}
            <div className="ml-4">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full border-3 border-white/20 object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-3 border-white/20 bg-white/10 flex items-center justify-center">
                  <User size={24} className="text-white/60" />
                </div>
              )}
            </div>
          </div>

          {/* Attendee Info */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-blue-100 text-xs uppercase tracking-wide mb-1">Attendee</p>
              <p className="text-white font-semibold text-lg">
                {ticketData.fullName || 'Your Name'}
              </p>
            </div>

            <div className="flex items-center text-blue-100 text-sm">
              <MapPin size={14} className="mr-2 flex-shrink-0" />
              <span>{ticketData.eventLocation || 'Event Location'}</span>
            </div>

            <div className="flex items-center text-blue-100 text-sm">
              <Ticket size={14} className="mr-2 flex-shrink-0" />
              <span>{ticketData.ticketType || 'Standard'} Ticket</span>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-blue-100 text-xs uppercase tracking-wide mb-1">
                  Ticket ID
                </p>
                <p className="text-white font-mono text-sm">
                  #{Math.random().toString(36).substr(2, 8).toUpperCase()}
                </p>
              </div>
              
              {qrCodeUrl && (
                <div className="ml-4 bg-white p-2 rounded-lg">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-16 h-16"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-1/2 -left-4 w-8 h-8 bg-gray-50 rounded-full transform -translate-y-1/2"></div>
        <div className="absolute top-1/2 -right-4 w-8 h-8 bg-gray-50 rounded-full transform -translate-y-1/2"></div>
      </div>

      {/* Download Buttons */}
      {showDownload && (
        <div className="flex gap-3 justify-center">
          <button
            onClick={downloadAsPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={downloadAsImage}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {downloading ? 'Generating...' : 'Download PNG'}
          </button>
        </div>
      )}
    </div>
  );
}