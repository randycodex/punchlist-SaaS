import { jsPDF } from 'jspdf';
import { Project, getProjectStats, getAreaStats, getLocationStats } from '@/types';

// Load logo as base64 for PDF
async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/uai-logo.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateProjectPDF(project: Project): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const columnWidth = (contentWidth - 8) / 2; // Two columns with 8mm gap
  const columnGap = 8;

  // Load logo
  const logoBase64 = await loadLogoBase64();

  // Cover page
  let coverY = 25;

  // Add logo at top
  if (logoBase64) {
    try {
      pdf.addImage(logoBase64, 'PNG', pageWidth / 2 - 15, coverY, 30, 30);
      coverY += 40;
    } catch (e) {
      coverY += 10;
    }
  }

  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PunchList Report', pageWidth / 2, coverY, { align: 'center' });
  coverY += 20;

  pdf.setFontSize(18);
  pdf.text(project.projectName, pageWidth / 2, coverY, { align: 'center' });
  coverY += 15;

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');

  if (project.address) {
    pdf.text(`Address: ${project.address}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 8;
  }

  if (project.inspector) {
    pdf.text(`Inspector: ${project.inspector}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 8;
  }

  pdf.text(`Date: ${new Date(project.date).toLocaleDateString()}`, pageWidth / 2, coverY, { align: 'center' });
  coverY += 8;

  if (project.gcName) {
    pdf.text(`GC: ${project.gcName}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 8;
  }

  // Stats
  const stats = getProjectStats(project);
  coverY += 15;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Summary', pageWidth / 2, coverY, { align: 'center' });
  coverY += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Areas: ${stats.areas}  |  Total: ${stats.total}  |  OK: ${stats.ok}  |  Issues: ${stats.issues}`, pageWidth / 2, coverY, { align: 'center' });

  // Content pages - Two column layout, continuous flow (no separate page per area)
  pdf.addPage();
  let leftColumnY = margin;
  let rightColumnY = margin;
  let currentColumn = 0; // 0 = left, 1 = right

  function getColumnX(col: number): number {
    return col === 0 ? margin : margin + columnWidth + columnGap;
  }

  function getCurrentY(): number {
    return currentColumn === 0 ? leftColumnY : rightColumnY;
  }

  function setCurrentY(y: number) {
    if (currentColumn === 0) {
      leftColumnY = y;
    } else {
      rightColumnY = y;
    }
  }

  function switchColumn() {
    if (currentColumn === 0) {
      currentColumn = 1;
    } else {
      currentColumn = 0;
    }
  }

  function needsNewPage(neededHeight: number): boolean {
    const currentY = getCurrentY();
    if (currentY + neededHeight > pageHeight - margin) {
      // Try the other column first
      const otherY = currentColumn === 0 ? rightColumnY : leftColumnY;
      if (otherY + neededHeight <= pageHeight - margin) {
        switchColumn();
        return false;
      }
      // Both columns full, need new page
      pdf.addPage();
      leftColumnY = margin;
      rightColumnY = margin;
      currentColumn = 0;
      return true;
    }
    return false;
  }

  // Process all areas continuously
  for (const area of project.areas) {
    // Estimate height for area header
    needsNewPage(20);

    const columnX = getColumnX(currentColumn);
    let y = getCurrentY();

    // Area header with background
    pdf.setFillColor(59, 130, 246); // Blue background
    pdf.rect(columnX, y - 4, columnWidth, 8, 'F');
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(area.name, columnX + 2, y);
    pdf.setTextColor(0, 0, 0);

    const areaStats = getAreaStats(area);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(255, 255, 255);
    const areaStatsText = `${areaStats.ok}/${areaStats.total}`;
    pdf.text(areaStatsText, columnX + columnWidth - pdf.getTextWidth(areaStatsText) - 2, y);
    pdf.setTextColor(0, 0, 0);
    y += 8;
    setCurrentY(y);

    // Process locations within this area
    for (const location of area.locations) {
      // Estimate height for this location
      let estimatedHeight = 10;
      for (const item of location.items) {
        estimatedHeight += 6;
        for (const checkpoint of item.checkpoints) {
          estimatedHeight += 5;
          if (checkpoint.comments) estimatedHeight += 4;
          if (checkpoint.photos.length > 0) estimatedHeight += 18;
        }
      }

      needsNewPage(Math.min(estimatedHeight, 50)); // At least fit header + some items

      const locColumnX = getColumnX(currentColumn);
      let locY = getCurrentY();

      // Location header
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(locColumnX, locY - 3, columnWidth, 6, 'F');
      pdf.text(location.name, locColumnX + 2, locY);

      const locStats = getLocationStats(location);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      const locStatsText = `OK:${locStats.ok} X:${locStats.issues}`;
      pdf.text(locStatsText, locColumnX + columnWidth - pdf.getTextWidth(locStatsText) - 2, locY);
      locY += 6;

      // Items
      for (const item of location.items) {
        if (locY > pageHeight - margin - 20) {
          setCurrentY(locY);
          needsNewPage(20);
          locY = getCurrentY();
        }

        const itemColumnX = getColumnX(currentColumn);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        const itemText = item.name.length > 30 ? item.name.substring(0, 27) + '...' : item.name;
        pdf.text(`• ${itemText}`, itemColumnX + 2, locY);
        locY += 4;

        // Checkpoints
        for (const checkpoint of item.checkpoints) {
          if (locY > pageHeight - margin - 15) {
            setCurrentY(locY);
            needsNewPage(15);
            locY = getCurrentY();
          }

          const cpColumnX = getColumnX(currentColumn);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');

          const statusSymbol = checkpoint.status === 'ok' ? '✓' : checkpoint.status === 'needsReview' ? '✗' : '○';
          const statusColor: [number, number, number] = checkpoint.status === 'ok' ? [34, 197, 94] : checkpoint.status === 'needsReview' ? [249, 115, 22] : [156, 163, 175];

          pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
          pdf.text(statusSymbol, cpColumnX + 6, locY);
          pdf.setTextColor(0, 0, 0);

          const cpText = checkpoint.name.length > 25 ? checkpoint.name.substring(0, 22) + '...' : checkpoint.name;
          pdf.text(cpText, cpColumnX + 12, locY);
          locY += 3.5;

          if (checkpoint.comments) {
            pdf.setFontSize(6);
            pdf.setTextColor(100, 100, 100);
            const comment = checkpoint.comments.length > 40 ? checkpoint.comments.substring(0, 37) + '...' : checkpoint.comments;
            pdf.text(`"${comment}"`, cpColumnX + 12, locY);
            locY += 3;
            pdf.setTextColor(0, 0, 0);
          }

          // Photos inline (smaller)
          if (checkpoint.photos.length > 0) {
            const photoSize = 12;
            const maxPhotos = Math.min(checkpoint.photos.length, 4);
            for (let i = 0; i < maxPhotos; i++) {
              const photo = checkpoint.photos[i];
              const photoX = cpColumnX + 12 + i * (photoSize + 2);
              try {
                pdf.addImage(photo.thumbnail, 'JPEG', photoX, locY, photoSize, photoSize);
              } catch (e) {
                pdf.setFillColor(200, 200, 200);
                pdf.rect(photoX, locY, photoSize, photoSize, 'F');
              }
            }
            locY += photoSize + 2;
          }
        }
        locY += 2;
      }
      locY += 3;
      setCurrentY(locY);
    }

    // Add spacing after area, then switch column for next area
    setCurrentY(getCurrentY() + 5);
    switchColumn();
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
    let yPos = margin;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Issues Summary', margin, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    for (let i = 0; i < allIssues.length; i++) {
      if (yPos > pageHeight - margin - 30) {
        pdf.addPage();
        yPos = margin;
      }

      const issue = allIssues[i];
      pdf.setFont('helvetica', 'bold');
      const issueHeader = `${i + 1}. ${issue.area} > ${issue.location} > ${issue.item}`;
      const truncatedHeader = issueHeader.length > 70 ? issueHeader.substring(0, 67) + '...' : issueHeader;
      pdf.text(truncatedHeader, margin, yPos);
      yPos += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`   ${issue.checkpoint}`, margin, yPos);
      yPos += 4;

      if (issue.comment) {
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        const commentLines = pdf.splitTextToSize(`   "${issue.comment}"`, contentWidth - 10);
        const limitedLines = commentLines.slice(0, 2);
        pdf.text(limitedLines, margin, yPos);
        yPos += limitedLines.length * 3.5;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
      }

      // Add photos for issues
      if (issue.photos.length > 0) {
        const photoSize = 20;
        const photosPerRow = Math.floor(contentWidth / (photoSize + 5));

        for (let j = 0; j < issue.photos.length; j++) {
          if (j % photosPerRow === 0 && j > 0) {
            yPos += photoSize + 3;
            if (yPos > pageHeight - margin - photoSize) {
              pdf.addPage();
              yPos = margin;
            }
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
