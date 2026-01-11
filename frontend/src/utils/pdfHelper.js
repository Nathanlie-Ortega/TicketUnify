import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generateTicketPDFBuffer = async (ticketElement) => {
  try {
    console.log('📄 Generating PDF from ticket element...');
    
    const canvas = await html2canvas(ticketElement, {
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
    
    // Get PDF as base64 string
    const pdfBase64 = pdf.output('dataurlstring').split(',')[1];
    
    console.log('✅ PDF generated successfully');
    return pdfBase64;
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
};