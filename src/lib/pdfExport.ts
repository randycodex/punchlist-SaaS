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

  type AreaIssue = {
    location: string;
    item: string;
    checkpoint: string;
    comment: string;
    photoRefs: number[];
    fileRefs: number[];
    photoData: string[];
    fileNames: string[];
  };

  const areaIssuesById = new Map<string, AreaIssue[]>();
  const photoRefsByCheckpoint = new Map<string, number[]>();
  let photoRefCounter = 1;

  const fileRefsByCheckpoint = new Map<string, number[]>();
  let fileRefCounter = 1;

  function drawStatusIcon(status: 'pending' | 'ok' | 'needsReview', x: number, y: number) {
    const centerY = y - 1.5;
    pdf.setLineWidth(0.35);

    if (status === 'ok') {
      pdf.setDrawColor(34, 197, 94);
      pdf.setFillColor(34, 197, 94);
      pdf.circle(x, centerY, statusIconRadius, 'F');
    } else if (status === 'needsReview') {
      pdf.setDrawColor(239, 68, 68);
      pdf.setFillColor(239, 68, 68);
      pdf.circle(x, centerY, statusIconRadius, 'F');
    } else {
      pdf.setDrawColor(156, 163, 175);
      pdf.circle(x, centerY, statusIconRadius, 'S');
    }

    pdf.setDrawColor(0, 0, 0);
    pdf.setFillColor(0, 0, 0);
  }

  function renderAreaIssuesSummary(areaName: string, issues: AreaIssue[], generalNotes: string) {
    if (issues.length === 0) return;

    const photoSize = 18;
    const photosPerRow = 4;
    const photoGap = 3;
    const photoRowHeight = photoSize + 2;
    const photoStartX = margin + 4;

    function drawAreaIssueHeader(y: number, continuation: boolean) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      const headerText = continuation ? `Issues Summary - ${areaName} (cont.)` : `Issues Summary - ${areaName}`;
      pdf.text(headerText, margin, y);
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
      return y + 8;
    }

    pdf.addPage();
    let yPos = drawAreaIssueHeader(margin, false);

    const trimmedNotes = generalNotes.trim();
    if (trimmedNotes) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('General Notes', margin + 1, yPos);
      yPos += 4.5;

      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'normal');
      const noteLines = pdf.splitTextToSize(trimmedNotes, contentWidth - 4) as string[];
      pdf.text(noteLines, margin + 2, yPos);
      yPos += noteLines.length * 3.6 + 2.5;

      pdf.setDrawColor(232, 232, 232);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;
    }

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const refParts: string[] = [];
      if (issue.photoRefs.length > 0) refParts.push(`Photo ${issue.photoRefs.join(', ')}`);
      if (issue.fileRefs.length > 0) refParts.push(`File ${issue.fileRefs.join(', ')}`);
      const refsText = refParts.length > 0 ? ` [${refParts.join(' | ')}]` : '';

      const title = `${i + 1}. ${issue.location} > ${issue.item}`;
      const titleLines = pdf.splitTextToSize(title, contentWidth - 4).slice(0, 1) as string[];
      const checkpointLine = `${issue.checkpoint}${refsText}`;
      const checkpointLines = pdf.splitTextToSize(checkpointLine, contentWidth - 8).slice(0, 1) as string[];
      const commentLines = issue.comment
        ? (pdf.splitTextToSize(`"${issue.comment}"`, contentWidth - 10).slice(0, 2) as string[])
        : [];
      const fileLine = issue.fileNames.length > 0 ? `Files: ${issue.fileNames.join(', ')}` : '';
      const fileLines = fileLine ? (pdf.splitTextToSize(fileLine, contentWidth - 10).slice(0, 1) as string[]) : [];

      const previewPhotos = issue.photoData.slice(0, 8);
      const photoRows = Math.ceil(previewPhotos.length / photosPerRow);
      const photoSectionHeight = photoRows > 0 ? 3 + photoRows * photoRowHeight : 0;
      const textHeight = 4 + titleLines.length * 4 + checkpointLines.length * 3.5 + commentLines.length * 3.2 + fileLines.length * 3.2;
      const extraMorePhotosHeight = issue.photoData.length > 8 ? 3 : 0;
      const issueHeight = textHeight + photoSectionHeight + extraMorePhotosHeight + 2;

      if (yPos + issueHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = drawAreaIssueHeader(margin, true);
      }

      let rowY = yPos;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(titleLines, margin + 2, rowY);
      rowY += 4.2;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(checkpointLines, margin + 4, rowY);
      rowY += 3.8;

      if (commentLines.length > 0) {
        pdf.setTextColor(100, 100, 100);
        pdf.text(commentLines, margin + 4, rowY);
        rowY += commentLines.length * 3.2;
        pdf.setTextColor(0, 0, 0);
      }

      if (fileLines.length > 0) {
        pdf.setTextColor(80, 80, 80);
        pdf.text(fileLines, margin + 4, rowY);
        rowY += 3.2;
        pdf.setTextColor(0, 0, 0);
      }

      if (previewPhotos.length > 0) {
        rowY += 1.5;
        for (let j = 0; j < previewPhotos.length; j++) {
          const col = j % photosPerRow;
          const row = Math.floor(j / photosPerRow);
          const x = photoStartX + col * (photoSize + photoGap);
          const y = rowY + row * photoRowHeight;
          try {
            pdf.addImage(previewPhotos[j], 'JPEG', x, y, photoSize, photoSize);
          } catch {
            pdf.setFillColor(225, 225, 225);
            pdf.rect(x, y, photoSize, photoSize, 'F');
          }
        }
        rowY += photoRows * photoRowHeight;
      }

      if (issue.photoData.length > 8) {
        pdf.setFontSize(7);
        pdf.setTextColor(90, 90, 90);
        pdf.text(`+${issue.photoData.length - 8} more photos`, margin + 4, rowY + 1.5);
        pdf.setTextColor(0, 0, 0);
      }

      pdf.setDrawColor(232, 232, 232);
      pdf.line(margin, yPos + issueHeight, pageWidth - margin, yPos + issueHeight);
      yPos += issueHeight + 3;
    }
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
              photoRefs.push(photoRefCounter);
              const existingRefs = photoRefsByCheckpoint.get(checkpoint.id) ?? [];
              existingRefs.push(photoRefCounter);
              photoRefsByCheckpoint.set(checkpoint.id, existingRefs);
              photoRefCounter++;
            }
          }

          let fileRefs: number[] = [];
          const checkpointFiles = checkpoint.files ?? [];
          if (checkpointFiles.length > 0) {
            for (const file of checkpointFiles) {
              fileRefs.push(fileRefCounter);
              const existingRefs = fileRefsByCheckpoint.get(checkpoint.id) ?? [];
              existingRefs.push(fileRefCounter);
              fileRefsByCheckpoint.set(checkpoint.id, existingRefs);
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

          if (checkpoint.status === 'needsReview') {
            const areaIssues = areaIssuesById.get(area.id) ?? [];
            areaIssues.push({
              location: location.name,
              item: item.name,
              checkpoint: checkpoint.name,
              comment: checkpoint.comments,
              photoRefs,
              fileRefs,
              photoData: checkpoint.photos.map((photo) => photo.imageData || photo.thumbnail),
              fileNames: checkpointFiles.map((file) => file.name),
            });
            areaIssuesById.set(area.id, areaIssues);
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

    const areaIssues = areaIssuesById.get(area.id) ?? [];
    renderAreaIssuesSummary(area.name, areaIssues, area.notes ?? '');
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
