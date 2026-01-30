import { jsPDF } from 'jspdf';
import { Project, Area, getProjectStats, getAreaStats, getLocationStats } from '@/types';

export async function generateProjectPDF(project: Project): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const columnWidth = (contentWidth - 10) / 2; // Two columns with 10mm gap
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

  // Areas - Two column layout
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

    // Two-column layout for locations
    let currentColumn = 0; // 0 = left, 1 = right
    let leftColumnY = yPos;
    let rightColumnY = yPos;

    for (const location of area.locations) {
      // Calculate which column to use and position
      const xPos = currentColumn === 0 ? margin : margin + columnWidth + 10;
      const startY = currentColumn === 0 ? leftColumnY : rightColumnY;

      // Estimate height needed for this location
      let estimatedHeight = 15; // header + stats
      for (const item of location.items) {
        estimatedHeight += 8; // item header
        for (const checkpoint of item.checkpoints) {
          estimatedHeight += 6;
          if (checkpoint.comments) estimatedHeight += 4;
          if (checkpoint.photos.length > 0) estimatedHeight += 25; // photo row
        }
      }

      // Check if we need a new page
      if (startY + estimatedHeight > pageHeight - margin && currentColumn === 1) {
        pdf.addPage();
        leftColumnY = margin;
        rightColumnY = margin;
        currentColumn = 0;
      } else if (startY + estimatedHeight > pageHeight - margin && currentColumn === 0) {
        // Try right column first
        if (rightColumnY + estimatedHeight <= pageHeight - margin) {
          currentColumn = 1;
        } else {
          pdf.addPage();
          leftColumnY = margin;
          rightColumnY = margin;
          currentColumn = 0;
        }
      }

      const columnX = currentColumn === 0 ? margin : margin + columnWidth + 10;
      let columnY = currentColumn === 0 ? leftColumnY : rightColumnY;

      // Location header
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(columnX, columnY - 4, columnWidth, 7, 'F');
      pdf.text(location.name, columnX + 2, columnY);

      const locStats = getLocationStats(location);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const statsText = `OK: ${locStats.ok}  Issues: ${locStats.issues}`;
      pdf.text(statsText, columnX + columnWidth - pdf.getTextWidth(statsText) - 2, columnY);
      columnY += 8;

      // Items
      for (const item of location.items) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        const itemText = `• ${item.name}`;
        const truncatedItem = itemText.length > 35 ? itemText.substring(0, 32) + '...' : itemText;
        pdf.text(truncatedItem, columnX + 2, columnY);
        columnY += 5;

        // Checkpoints
        for (const checkpoint of item.checkpoints) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');

          const statusSymbol = checkpoint.status === 'ok' ? '✓' : checkpoint.status === 'needsReview' ? '✗' : '○';
          const statusColor = checkpoint.status === 'ok' ? [34, 197, 94] : checkpoint.status === 'needsReview' ? [249, 115, 22] : [156, 163, 175];

          pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
          pdf.text(statusSymbol, columnX + 4, columnY);
          pdf.setTextColor(0, 0, 0);

          const checkpointText = checkpoint.name.length > 30 ? checkpoint.name.substring(0, 27) + '...' : checkpoint.name;
          pdf.text(checkpointText, columnX + 10, columnY);
          columnY += 4;

          if (checkpoint.comments) {
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            const commentLines = pdf.splitTextToSize(`"${checkpoint.comments}"`, columnWidth - 15);
            const truncatedComments = commentLines.slice(0, 2);
            pdf.text(truncatedComments, columnX + 10, columnY);
            columnY += truncatedComments.length * 3;
            pdf.setTextColor(0, 0, 0);
          }

          // Photos inline
          if (checkpoint.photos.length > 0) {
            const photoSize = 15;
            const photosPerRow = Math.floor((columnWidth - 12) / (photoSize + 2));
            const photoRows = Math.ceil(checkpoint.photos.length / photosPerRow);

            for (let row = 0; row < photoRows; row++) {
              const startIdx = row * photosPerRow;
              const endIdx = Math.min(startIdx + photosPerRow, checkpoint.photos.length);

              for (let i = startIdx; i < endIdx; i++) {
                const photo = checkpoint.photos[i];
                const photoX = columnX + 10 + (i - startIdx) * (photoSize + 2);

                try {
                  // Use thumbnail for PDF (smaller file size)
                  pdf.addImage(photo.thumbnail, 'JPEG', photoX, columnY, photoSize, photoSize);
                } catch (e) {
                  // If image fails, draw placeholder
                  pdf.setFillColor(200, 200, 200);
                  pdf.rect(photoX, columnY, photoSize, photoSize, 'F');
                  pdf.setFontSize(6);
                  pdf.text('IMG', photoX + 3, columnY + 8);
                }
              }
              columnY += photoSize + 2;
            }
          }

          columnY += 1;
        }

        columnY += 2;
      }

      columnY += 5;

      // Update column position
      if (currentColumn === 0) {
        leftColumnY = columnY;
        currentColumn = 1;
      } else {
        rightColumnY = columnY;
        currentColumn = 0;
      }
    }
  }

  // Issues summary page with photos
  const allIssues: { area: string; location: string; item: string; checkpoint: string; comment: string; photos: { thumbnail: string; imageData: string }[] }[] = [];
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
              photos: checkpoint.photos.map(p => ({ thumbnail: p.thumbnail, imageData: p.imageData })),
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
      checkNewPage(30);

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

      // Add photos for issues
      if (issue.photos.length > 0) {
        const photoSize = 25;
        const photosPerRow = Math.floor(contentWidth / (photoSize + 5));

        for (let j = 0; j < issue.photos.length; j++) {
          if (j % photosPerRow === 0 && j > 0) {
            yPos += photoSize + 3;
            checkNewPage(photoSize + 5);
          }

          const photoX = margin + (j % photosPerRow) * (photoSize + 5);

          try {
            pdf.addImage(issue.photos[j].thumbnail, 'JPEG', photoX, yPos, photoSize, photoSize);
          } catch (e) {
            pdf.setFillColor(200, 200, 200);
            pdf.rect(photoX, yPos, photoSize, photoSize, 'F');
          }
        }
        yPos += photoSize + 5;
      }

      yPos += 5;
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
