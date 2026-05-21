// Imports moved inside function to be SSR-safe

export const generateResumePDF = async (elementId: string, filename: string = 'My_Elite_Resume.pdf') => {
  const jsPDF = (await import('jspdf')).default;
  const html2canvas = (await import('html2canvas')).default;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Resume element not found');
    return false;
  }

  try {
    await document.fonts?.ready;

    // 1. Capture the element as a high-resolution canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution for printing
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    
    // 2. Initialize jsPDF (A4 Paper Size)
    // A4 dimensions: 210mm x 297mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    // 3. Add image to PDF
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    // 4. Trigger Download
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return false;
  }
};
