import { jsPDF } from 'jspdf';
import { Project, Area, getProjectStats, getAreaStats, getLocationStats } from '@/types';

export async function generateProjectPDF(project: Project): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Helper to add new page if needed
  function checkNewPage(neededHeight: number) {
    if (yPos + neededHeight > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
      return true;
    }
    return false;
  }

  // Cover page
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PunchList Report', pageWidth / 2, 40, { align: 'center' });

  pdf.setFontSize(18);
  pdf.text(project.projectName, pageWidth / 2, 60, { align: 'center' });

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  let infoY = 80;

  if (project.address) {
    pdf.text(`Address: ${project.address}`, pageWidth / 2, infoY, { align: 'center' });
    infoY += 8;
  }

  if (project.inspector) {
    pdf.text(`Inspector: ${project.inspector}`, pageWidth / 2, infoY, { align: 'center' });
    infoY += 8;
  }

  pdf.text(`Date: ${new Date(project.date).toLocaleDateString()}`, pageWidth / 2, infoY, { align: 'center' });
  infoY += 8;

  if (project.gcName) {
    pdf.text(`GC: ${project.gcName}`, pageWidth / 2, infoY, { align: 'center' });
    infoY += 8;
  }

  // Stats
  const stats = getProjectStats(project);
  infoY += 10;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary', pageWidth / 2, infoY, { align: 'center' });
  infoY += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Areas: ${stats.areas}  |  Total: ${stats.total}  |  OK: ${stats.ok}  |  Issues: ${stats.issues}`, pageWidth / 2, infoY, { align: 'center' });

  // Areas
  for (const area of project.areas) {
    pdf.addPage();
    yPos = margin;

    // Area header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(area.name, margin, yPos);
    yPos += 8;

    const areaStats = getAreaStats(area);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total: ${areaStats.total}  |  OK: ${areaStats.ok}  |  Issues: ${areaStats.issues}`, margin, yPos);
    yPos += 10;

    // Locations
    for (const location of area.locations) {
      checkNewPage(20);

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPos - 4, contentWidth, 8, 'F');
      pdf.text(location.name, margin + 2, yPos);

      const locStats = getLocationStats(location);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const statsText = `OK: ${locStats.ok}  Issues: ${locStats.issues}`;
      pdf.text(statsText, pageWidth - margin - pdf.getTextWidth(statsText), yPos);
      yPos += 10;

      // Items
      for (const item of location.items) {
        checkNewPage(15);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`• ${item.name}`, margin + 4, yPos);
        yPos += 5;

        // Checkpoints
        for (const checkpoint of item.checkpoints) {
          checkNewPage(10);

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');

          const statusSymbol = checkpoint.status === 'ok' ? '✓' : checkpoint.status === 'needsReview' ? '✗' : '○';
          const statusColor = checkpoint.status === 'ok' ? [34, 197, 94] : checkpoint.status === 'needsReview' ? [249, 115, 22] : [156, 163, 175];

          pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
          pdf.text(statusSymbol, margin + 8, yPos);
          pdf.setTextColor(0, 0, 0);
          pdf.text(checkpoint.name, margin + 14, yPos);

          if (checkpoint.comments) {
            yPos += 4;
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            const commentLines = pdf.splitTextToSize(`Note: ${checkpoint.comments}`, contentWidth - 20);
            pdf.text(commentLines, margin + 14, yPos);
            yPos += commentLines.length * 3;
            pdf.setTextColor(0, 0, 0);
          }

          yPos += 5;
        }

        yPos += 2;
      }

      yPos += 5;
    }
  }

  // Issues summary page
  const allIssues: { area: string; location: string; item: string; checkpoint: string; comment: string }[] = [];
  for (const area of project.areas) {
    for (const location of area.locations) {
      for (const item of location.items) {
        for (const checkpoint of item.checkpoints) {
          if (checkpoint.status === 'needsReview') {
            allIssues.push({
              area: area.name,
              location: location.name,
              item: item.name,
              checkpoint: checkpoint.name,
              comment: checkpoint.comments,
            });
          }
        }
      }
    }
  }

  if (allIssues.length > 0) {
    pdf.addPage();
    yPos = margin;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Issues Summary', margin, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    for (let i = 0; i < allIssues.length; i++) {
      checkNewPage(15);

      const issue = allIssues[i];
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${i + 1}. ${issue.area} > ${issue.location} > ${issue.item}`, margin, yPos);
      yPos += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`   ${issue.checkpoint}`, margin, yPos);
      yPos += 4;

      if (issue.comment) {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        const commentLines = pdf.splitTextToSize(`   "${issue.comment}"`, contentWidth - 10);
        pdf.text(commentLines, margin, yPos);
        yPos += commentLines.length * 3.5;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
      }

      yPos += 3;
    }
  }

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  return pdf.output('blob');
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
