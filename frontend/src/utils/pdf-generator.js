// src/utils/pdf-generator.js
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export class PDFGenerator {
  constructor() {
    this.pdf = null;
  }

  async generateFromElement(element, filename = 'ticket.pdf') {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
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
      pdf.save(filename);
      
      return pdf;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  async generateTicketPDF(ticketData) {
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [100, 60]
      });

      // Add ticket content
      pdf.setFontSize(16);
      pdf.text(ticketData.eventName || 'Event Name', 5, 10);
      
      pdf.setFontSize(12);
      pdf.text(`Attendee: ${ticketData.fullName || 'Name'}`, 5, 20);
      pdf.text(`Date: ${ticketData.eventDate || 'Date'}`, 5, 25);
      pdf.text(`Location: ${ticketData.eventLocation || 'Location'}`, 5, 30);
      pdf.text(`Type: ${ticketData.ticketType || 'Standard'}`, 5, 35);
      
      // Add QR code placeholder
      pdf.setFontSize(8);
      pdf.text('QR Code: ' + (ticketData.id || 'TICKET-ID'), 5, 45);

      return pdf;
    } catch (error) {
      console.error('Error generating ticket PDF:', error);
      throw error;
    }
  }
}

export const pdfGenerator = new PDFGenerator();
