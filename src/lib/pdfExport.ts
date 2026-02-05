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

// Get image dimensions to maintain aspect ratio
function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = base64;
  });
}

type LogoAssets = {
  base64: string | null;
  width: number;
  height: number;
};

async function loadLogoAssets(): Promise<LogoAssets> {
  const base64 = await loadLogoBase64();
  let width = 30;
  let height = 30;

  if (base64) {
    try {
      const dims = await getImageDimensions(base64);
      const maxLogoHeight = 25;
      const aspectRatio = dims.width / dims.height;
      height = maxLogoHeight;
      width = maxLogoHeight * aspectRatio;
    } catch {
      // Use defaults
    }
  }

  return { base64, width, height };
}

function addFooter(pdf: jsPDF, margin: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }
}

function renderProjectToPdf(pdf: jsPDF, project: Project, logo: LogoAssets) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const columnGap = 6;
  const columnCount = 3;
  const columnWidth = (contentWidth - columnGap * (columnCount - 1)) / columnCount;
  const statusIconRadius = 1.6;

  // Collect all photos with references
  const allPhotos: {
    ref: number;
    areaId: string;
    locationId: string;
    itemId: string;
    checkpointId: string;
    area: string;
    location: string;
    item: string;
    checkpoint: string;
    thumbnail: string;
    imageData: string;
  }[] = [];
  let photoRefCounter = 1;

  const allFiles: {
    ref: number;
    areaId: string;
    locationId: string;
    itemId: string;
    checkpointId: string;
    area: string;
    location: string;
    item: string;
    checkpoint: string;
    name: string;
    mimeType: string;
    size: number;
  }[] = [];
  let fileRefCounter = 1;

  function drawStatusIcon(status: 'pending' | 'ok' | 'needsReview', x: number, y: number) {
    const centerY = y - 1.5;
    pdf.setLineWidth(0.35);

    if (status === 'ok') {
      pdf.setDrawColor(34, 197, 94);
      pdf.setFillColor(34, 197, 94);
      pdf.circle(x, centerY, statusIconRadius, 'F');
    } else if (status === 'needsReview') {
      pdf.setDrawColor(249, 115, 22);
      pdf.circle(x, centerY, statusIconRadius, 'S');
      pdf.line(x - 1.1, centerY - 1.1, x + 1.1, centerY + 1.1);
      pdf.line(x - 1.1, centerY + 1.1, x + 1.1, centerY - 1.1);
    } else {
      pdf.setDrawColor(156, 163, 175);
      pdf.circle(x, centerY, statusIconRadius, 'S');
    }

    pdf.setDrawColor(0, 0, 0);
    pdf.setFillColor(0, 0, 0);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  // Cover page
  let coverY = 25;

  // Add logo at top (maintaining proportions)
  if (logo.base64) {
    try {
      pdf.addImage(logo.base64, 'PNG', pageWidth / 2 - logo.width / 2, coverY, logo.width, logo.height);
      coverY += logo.height + 15;
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

  // Each area starts on a new page
  for (const area of project.areas) {
    pdf.addPage();
    const columnYs = Array.from({ length: columnCount }, () => margin);
    let currentColumn = 0;

    function getColumnX(col: number): number {
      return margin + col * (columnWidth + columnGap);
    }

    function getCurrentY(): number {
      return columnYs[currentColumn];
    }

    function setCurrentY(y: number) {
      columnYs[currentColumn] = y;
    }

    function switchColumn() {
      currentColumn = (currentColumn + 1) % columnCount;
    }

    function needsNewPage(neededHeight: number): boolean {
      const currentY = getCurrentY();
      if (currentY + neededHeight > pageHeight - margin) {
        for (let i = 0; i < columnCount; i++) {
          if (i === currentColumn) continue;
          if (columnYs[i] + neededHeight <= pageHeight - margin) {
            currentColumn = i;
            return false;
          }
        }
        pdf.addPage();
        for (let i = 0; i < columnCount; i++) {
          columnYs[i] = margin;
        }
        currentColumn = 0;
        return true;
      }
      return false;
    }

    // Area header with background
    const columnX = getColumnX(currentColumn);
    let y = getCurrentY();

    pdf.setFillColor(59, 130, 246);
    pdf.rect(margin, y - 4, contentWidth, 10, 'F');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(area.name, margin + 3, y + 2);

    const areaStats = getAreaStats(area);
    pdf.setFontSize(10);
    const areaStatsText = `OK: ${areaStats.ok}  |  Issues: ${areaStats.issues}  |  Total: ${areaStats.total}`;
    pdf.text(areaStatsText, pageWidth - margin - pdf.getTextWidth(areaStatsText) - 3, y + 2);
    pdf.setTextColor(0, 0, 0);

    for (let i = 0; i < columnCount; i++) {
      columnYs[i] = y + 12;
    }

    // Process locations within this area
    for (const location of area.locations) {
      let estimatedHeight = 10;
      for (const item of location.items) {
        estimatedHeight += 6;
        for (const checkpoint of item.checkpoints) {
          estimatedHeight += 5;
          if (checkpoint.comments) estimatedHeight += 4;
        }
      }

      needsNewPage(Math.min(estimatedHeight, 50));

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

          drawStatusIcon(checkpoint.status, cpColumnX + 6, locY);

          const cpText = checkpoint.name.length > 22 ? checkpoint.name.substring(0, 19) + '...' : checkpoint.name;
          pdf.text(cpText, cpColumnX + 12, locY);

          // Add photo references if photos exist
          let photoRefs: number[] = [];
          if (checkpoint.photos.length > 0) {
            for (const photo of checkpoint.photos) {
              allPhotos.push({
                ref: photoRefCounter,
                areaId: area.id,
                locationId: location.id,
                itemId: item.id,
                checkpointId: checkpoint.id,
                area: area.name,
                location: location.name,
                item: item.name,
                checkpoint: checkpoint.name,
                thumbnail: photo.thumbnail,
                imageData: photo.imageData,
              });
              photoRefs.push(photoRefCounter);
              photoRefCounter++;
            }
          }

          let fileRefs: number[] = [];
          const checkpointFiles = checkpoint.files ?? [];
          if (checkpointFiles.length > 0) {
            for (const file of checkpointFiles) {
              allFiles.push({
                ref: fileRefCounter,
                areaId: area.id,
                locationId: location.id,
                itemId: item.id,
                checkpointId: checkpoint.id,
                area: area.name,
                location: location.name,
                item: item.name,
                checkpoint: checkpoint.name,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
              });
              fileRefs.push(fileRefCounter);
              fileRefCounter++;
            }
          }

          if (photoRefs.length > 0 || fileRefs.length > 0) {
            pdf.setFontSize(6);
            pdf.setTextColor(59, 130, 246);
            const refParts: string[] = [];
            if (photoRefs.length > 0) refParts.push(`Photo ${photoRefs.join(', ')}`);
            if (fileRefs.length > 0) refParts.push(`File ${fileRefs.join(', ')}`);
            const refText = `[${refParts.join(' | ')}]`;
            pdf.text(refText, cpColumnX + columnWidth - pdf.getTextWidth(refText) - 2, locY);
            pdf.setTextColor(0, 0, 0);
          }

          locY += 3.5;

          if (checkpoint.comments) {
            pdf.setFontSize(6);
            pdf.setTextColor(100, 100, 100);
            const comment = checkpoint.comments.length > 40 ? checkpoint.comments.substring(0, 37) + '...' : checkpoint.comments;
            pdf.text(`"${comment}"`, cpColumnX + 12, locY);
            locY += 3;
            pdf.setTextColor(0, 0, 0);
          }
        }
        locY += 2;
      }
      locY += 3;
      setCurrentY(locY);
      switchColumn();
    }
  }

  // Issues summary page with photos
  const allIssues: {
    area: string;
    location: string;
    item: string;
    checkpoint: string;
    comment: string;
    photoRefs: number[];
    fileRefs: number[];
  }[] = [];

  for (const area of project.areas) {
    for (const location of area.locations) {
      for (const item of location.items) {
        for (const checkpoint of item.checkpoints) {
          if (checkpoint.status === 'needsReview') {
            const photoRefs = allPhotos
              .filter(p =>
                p.areaId === area.id &&
                p.locationId === location.id &&
                p.itemId === item.id &&
                p.checkpointId === checkpoint.id
              )
              .map(p => p.ref);
            const fileRefs = allFiles
              .filter(f =>
                f.areaId === area.id &&
                f.locationId === location.id &&
                f.itemId === item.id &&
                f.checkpointId === checkpoint.id
              )
              .map(f => f.ref);
            allIssues.push({
              area: area.name,
              location: location.name,
              item: item.name,
              checkpoint: checkpoint.name,
              comment: checkpoint.comments,
              photoRefs,
              fileRefs,
            });
          }
        }
      }
    }
  }

  if (allIssues.length > 0 || allPhotos.length > 0 || allFiles.length > 0) {
    pdf.addPage();
    let yPos = margin;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Issues Summary', margin, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    for (let i = 0; i < allIssues.length; i++) {
      if (yPos > pageHeight - margin - 25) {
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
      let checkpointLine = `   ${issue.checkpoint}`;
      const refParts: string[] = [];
      if (issue.photoRefs.length > 0) refParts.push(`Photo ${issue.photoRefs.join(', ')}`);
      if (issue.fileRefs.length > 0) refParts.push(`File ${issue.fileRefs.join(', ')}`);
      if (refParts.length > 0) {
        checkpointLine += ` [${refParts.join(' | ')}]`;
      }
      pdf.text(checkpointLine, margin, yPos);
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

      yPos += 5;
    }

    // Photo appendix - larger photos at end
    if (allPhotos.length > 0) {
      pdf.addPage();
      yPos = margin;

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Photo Appendix', margin, yPos);
      yPos += 12;

      const photoSize = 60; // Larger photos
      const photosPerRow = 2;
      const photoSpacing = (contentWidth - (photosPerRow * photoSize)) / (photosPerRow + 1);

      for (let i = 0; i < allPhotos.length; i++) {
        const photo = allPhotos[i];
        const col = i % photosPerRow;

        if (col === 0 && i > 0) {
          yPos += photoSize + 20;
        }

        if (yPos + photoSize + 15 > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }

        const photoX = margin + photoSpacing + col * (photoSize + photoSpacing);

        // Photo reference number
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Photo ${photo.ref}`, photoX, yPos);

        // Photo caption
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        const caption = `${photo.location} > ${photo.item} > ${photo.checkpoint}`;
        const truncatedCaption = caption.length > 40 ? caption.substring(0, 37) + '...' : caption;
        pdf.text(truncatedCaption, photoX, yPos + 4);

        // Add photo
        try {
          pdf.addImage(photo.imageData || photo.thumbnail, 'JPEG', photoX, yPos + 7, photoSize, photoSize);
        } catch (e) {
          pdf.setFillColor(200, 200, 200);
          pdf.rect(photoX, yPos + 7, photoSize, photoSize, 'F');
          pdf.setFontSize(10);
          pdf.text('Image Error', photoX + 15, yPos + 37);
        }
      }
    }

    if (allFiles.length > 0) {
      pdf.addPage();
      yPos = margin;

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('File Attachments', margin, yPos);
      yPos += 10;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      for (const file of allFiles) {
        if (yPos > pageHeight - margin - 12) {
          pdf.addPage();
          yPos = margin;
        }

        const header = `File ${file.ref}: ${file.name} (${formatFileSize(file.size)})`;
        const locationLine = `${file.area} > ${file.location} > ${file.item} > ${file.checkpoint}`;
        const headerLines = pdf.splitTextToSize(header, contentWidth);
        pdf.text(headerLines, margin, yPos);
        yPos += headerLines.length * 4;

        pdf.setTextColor(100, 100, 100);
        const locLines = pdf.splitTextToSize(locationLine, contentWidth);
        pdf.text(locLines, margin, yPos);
        yPos += locLines.length * 4 + 2;
        pdf.setTextColor(0, 0, 0);
      }
    }
  }

}

export async function generateProjectPDF(project: Project): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogoAssets();
  renderProjectToPdf(pdf, project, logo);
  addFooter(pdf, 15);

  return pdf.output('blob');
}

export async function generateMultiProjectPDF(projects: Project[]): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogoAssets();

  projects.forEach((project, index) => {
    if (index > 0) {
      pdf.addPage();
    }
    renderProjectToPdf(pdf, project, logo);
  });

  addFooter(pdf, 15);
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
