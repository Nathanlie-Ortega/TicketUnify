const PDFDocument = require('pdfkit');

const generateTicketPDF = async (ticketData) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(' Generating simple PDF for ticket:', ticketData.ticketId);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        console.log(' PDF generated successfully');
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc.rect(0, 0, doc.page.width, 150).fill('#667eea');
      
      doc.fillColor('#ffffff')
         .fontSize(32)
         .font('Helvetica-Bold')
         .text('TICKET CONFIRMATION', 50, 50, { align: 'center' });

      doc.fontSize(14)
         .text(`Ticket ID: ${ticketData.ticketId}`, 50, 100, { align: 'center' });

      // Event Details
      doc.fillColor('#000000')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('Event Details', 50, 180);

      doc.moveTo(50, 205).lineTo(550, 205).stroke();

      let yPos = 220;

      const details = [
        ['Attendee Name:', ticketData.fullName],
        ['Event:', ticketData.eventName],
        ['Date:', ticketData.eventDate],
        ['Time:', ticketData.eventTime || 'TBA'],
        ['Location:', ticketData.location || 'TBA'],
        ['Ticket Type:', ticketData.ticketType],
        ['Email:', ticketData.email]
      ];

      details.forEach(([label, value]) => {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text(label, 50, yPos);
        doc.font('Helvetica')
           .text(value, 200, yPos);
        yPos += 25;
      });

      // Footer
      doc.fontSize(10)
         .fillColor('#666666')
         .text('Please present this ticket at the event entrance.', 50, 700, { align: 'center' });
      
      doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 720, { align: 'center' });

      doc.end();

    } catch (error) {
      console.error('PDF generation error:', error);
      reject(error);
    }
  });
};

const generateEventReport = async (eventData) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(' Generating event report PDF');

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.rect(0, 0, doc.page.width, 100).fill('#667eea');
      
      doc.fillColor('#ffffff')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('EVENT REPORT', 50, 40, { align: 'center' });

      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica')
         .text(`Event: ${eventData.eventName}`, 50, 130);

      doc.text(`Total Tickets: ${eventData.totalTickets}`, 50, 160);
      doc.text(`Checked In: ${eventData.checkedIn}`, 50, 180);
      doc.text(`Revenue: $${eventData.revenue}`, 50, 200);

      doc.fontSize(10)
         .fillColor('#666666')
         .text(`Generated: ${new Date().toLocaleString()}`, 50, 750);

      doc.end();

    } catch (error) {
      console.error('Report generation error:', error);
      reject(error);
    }
  });
};

module.exports = {
  generateTicketPDF,
  generateEventReport
};