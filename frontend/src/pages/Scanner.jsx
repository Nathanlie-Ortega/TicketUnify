// src/pages/Scanner.jsx
import React, { useState } from 'react';
import { useTickets } from '../contexts/TicketContext';
import QRScanner from '../components/QRScanner';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { QrCode, CheckCircle, AlertCircle, Scan } from 'lucide-react';
import { formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';


// Format time helper function
const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch (error) {
    return timeString;
  }
};


export default function Scanner() {
const { updateTicketCheckin, findTicket, getTicketFromFirestore } = useTickets();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);



const handleScanSuccess = async (scannedData) => {
  setLoading(true);
  try {
    console.log(' Scanned raw data:', scannedData);
    
    // Extract ticket ID from URL or use as-is
    let ticketId = scannedData;
    
    // If scanned data is a URL (e.g., http://localhost:3000/validate/TICKET-XXX)
    if (scannedData.includes('/validate/')) {
      ticketId = scannedData.split('/validate/')[1];
      console.log(' Extracted ticket ID from URL:', ticketId);
    }
    
    console.log(' Final ticket ID to validate:', ticketId);
    
    // First try local tickets (fast)
    let ticket = findTicket(ticketId);
    
    // If not found locally, query Firestore (for other users' tickets)
    if (!ticket) {
      console.log(' Ticket not in local cache, querying Firestore...');
      ticket = await getTicketFromFirestore(ticketId);
      
      if (ticket) {
        console.log(' Found ticket in Firestore:', ticket);
      } else {
        console.log('Ticket not found in Firestore either');
      }
    }

    if (!ticket) {
      console.log(' Final result: Ticket not found anywhere. Ticket ID:', ticketId);
      setScanResult({
        success: false,
        message: 'Ticket not found',
        ticketId
      });
      toast.error('Ticket not found');
      return;
    }

    // Check if already checked in
    if (ticket.checkedIn) {
      setScanResult({
        success: false,
        message: 'Ticket already checked in',
        ticket,
        ticketId
      });
      toast.error('This ticket has already been checked in');
      return;
    }

    // Check in the ticket
    await updateTicketCheckin(ticket.id, true);
    
    setScanResult({
      success: true,
      message: '',
      ticket: { ...ticket, checkedIn: true },
      ticketId
    });
    toast.success(' Ticket validated successfully!');
    
  } catch (error) {
    console.error(' Error processing ticket:', error);
    setScanResult({
      success: false,
      message: error.message || 'Failed to validate ticket',
      ticketId
    });
    toast.error('Failed to validate ticket');
  } finally {
    setLoading(false);
    setIsScanning(false);
  }
};





  const handleScanError = (error) => {
    console.error('Scan error:', error);
    toast.error('Failed to scan QR code');
    setIsScanning(false);
  };

  const resetScan = () => {
    setScanResult(null);
    setIsScanning(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Ticket Scanner</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Scan QR codes to validate and check in attendees
        </p>
      </div>

      {/* Scanner Controls */}
      <div className="bg-white dark:bg-gray-800 border border-blue-600 dark:border-gray-700 rounded-xl shadow-lg p-6 transition-colors">
        {!scanResult ? (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 bg-blue-300 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto">
              <QrCode size={48} className="text-blue-600 dark:text-blue-400" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Ready to Scan
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Click the button below to start scanning QR codes
              </p>
            </div>

            <Button
              onClick={() => setIsScanning(true)}
              size="lg"
              className="w-full sm:w-auto"
            >
              <Scan size={20} className="mr-2" />
              Start Scanning
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-6">
            {/* Result Icon */}
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto ${
              scanResult.success ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
            }`}>
              {scanResult.success ? (
                <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle size={48} className="text-red-600 dark:text-red-400" />
              )}
            </div>

            {/* Result Message */}
            <div>
              <h2 className={`text-xl font-semibold mb-2 ${
                scanResult.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
              }`}>
                {scanResult.success ? 'Check-in Successful!' : 'Check-in Failed'}
              </h2>
              <p className={`${
                scanResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {scanResult.message}
              </p>
            </div>

            {/* Ticket Details */}
            {scanResult.ticket && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-blue-600 dark:border-gray-600 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ticket Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Attendee Name:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{scanResult.ticket.fullName || scanResult.ticket.userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Event:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{scanResult.ticket.eventName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatDate(scanResult.ticket.eventDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Time:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{scanResult.ticket.eventTime ? formatTime(scanResult.ticket.eventTime) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Location:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{scanResult.ticket.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ticket Type:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{scanResult.ticket.ticketType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`font-medium ${
                      scanResult.ticket.checkedIn 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {scanResult.ticket.checkedIn ? 'Checked In' : 'Valid - Entry Confirmed'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ticket ID:</span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white">{scanResult.ticketId}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={resetScan} variant="outline" className="flex-1">
                Back
              </Button>
              <Button onClick={() => setIsScanning(true)} className="flex-1">
                <Scan size={16} className="mr-2" />
                Scan Again
              </Button>
            </div>
          </div>
          
        )}

        {loading && (
          <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center rounded-lg">
            <LoadingSpinner text="Processing ticket..." />
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-600 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Scanning Instructions</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Make sure the QR code is clearly visible and well-lit</li>
          <li>• Hold the device steady while scanning</li>
          <li>• You can also upload an image or PDF of the QR code</li>
          <li>• Each ticket can only be checked in once</li>
        </ul>
      </div>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={isScanning}
        onClose={() => setIsScanning(false)}
        onScanSuccess={handleScanSuccess}
        onScanError={handleScanError}
      />
    </div>
  );
}